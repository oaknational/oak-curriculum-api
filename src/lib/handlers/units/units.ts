import { v0Procedure } from '@/lib/protect';
import { router } from '@/lib/trpc';
import { TRPCError } from '@trpc/server';
import type { SequenceView } from 'lib/owaClient';
import {
  getClient,
  gql,
  sequenceView,
  sequenceViewWhereInput,
} from 'lib/owaClient';
import { errorResponses } from '@/lib/errorResponses';

import {
  doesUnitExist,
  formatUnitSummary,
  sortSequencesByProgrammeSpecificity,
  testIfUnitVariant,
} from './helpers';
import { unitSummaryRequestSchema, unitSummaryResponseSchema } from './schemas';

interface StringEq {
  _eq: string;
}

interface UnitWhere {
  slug: StringEq;
  non_curriculum: { _eq: boolean };
  examboard_slug?: StringEq;
  pathway_slug?: StringEq;
  tier_slug?: StringEq;
  subject_slug?: StringEq;
  subject_parent?: StringEq;
}

export const getUnits = router({
  getUnit: v0Procedure
    .meta({
      openapi: {
        method: 'GET',
        tags: ['units'],
        path: '/units/{unit}/summary',
        summary: 'Unit summary by slug',
        description: `Use when you have a unit slug and need the unit summary: title, description, key stage, subject, year, threads, prior-knowledge requirements, national-curriculum statements, and the lessons inside. Unit variant slugs (ending in -1, -2, etc.) resolve to that specific variant.

Not for: listing every unit in a key stage + subject (GET /key-stages/{keyStage}/subject/{subject}/units); all units across a sequence (GET /sequences/{sequence}/units); units in one programme (GET /programmes/{programme}/units); units in a thread (GET /threads/{threadSlug}/units); lessons inside the unit (GET /key-stages/{keyStage}/subject/{subject}/lessons with unit={unit}).`,
        errorResponses,
      },
    })
    .input(unitSummaryRequestSchema)
    .output(unitSummaryResponseSchema)
    .query(async ({ input }) => {
      let { unit: slug } = input;
      const { childSubject, examBoard, pathway, tier } = input;
      const client = getClient();

      const isUnitVariant = testIfUnitVariant(slug);
      const originalSlug = slug;

      if (isUnitVariant) {
        // we'll get the base unit for variants, then reconstruct later
        slug = slug.replace(/-\d+$/, '');
      }

      const exists = await doesUnitExist(client, slug);

      if (!exists) {
        // there's a nasty bit here where a top level unit can "look like" a unit variant because of the slug structure, so we need to do a quick check to see if the unit exists at all before we do any blocking checks, otherwise we might end up blocking a real 404 which is not ideal from an API consumer perspective

        if (originalSlug === slug) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Unit not found' });
        }

        const doubleCheck = await doesUnitExist(client, originalSlug);

        if (!doubleCheck) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Unit not found' });
        } else {
          // move the original slug back to the original for the rest of the function
          slug = originalSlug;
        }
      }

      // Ensure that non-curriculum units don't come through. Programme-factor
      // filters are applied at the database layer so the response is already
      // narrowed; the client-side sort below is only a deterministic
      // tiebreaker when multiple rows still match (e.g. shared slug across
      // subject_parent variants).
      const where: UnitWhere = {
        slug: { _eq: slug },
        non_curriculum: { _eq: false },
      };

      if (examBoard) {
        where.examboard_slug = { _eq: examBoard };
      }

      if (pathway) {
        where.pathway_slug = { _eq: pathway };
      }

      if (tier) {
        where.tier_slug = { _eq: tier };
      }

      if (childSubject) {
        where.subject_slug = { _eq: childSubject };
        where.subject_parent = { _eq: 'Science' };
      }

      const query = gql`
        query getUnit($where: ${sequenceViewWhereInput}) @cached(ttl: 300) {
          ${sequenceView}(where: $where) {
            title
            slug
            description
            keystage_slug
            lessons
            notes
            phase_slug
            pathway
            pathway_slug
            subject
            subject_parent
            subject_slug
            tier
            tier_slug
            unit_options
            why_this_why_now
            threads
            year
            examboard
            examboard_slug
            subjectcategories

            prior_knowledge_requirements
            national_curriculum_content
          }
        }
      `;

      const res: SequenceView = await client.request(query, { where });
      if (res[sequenceView].length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: childSubject
            ? `Unit not found for childSubject "${childSubject}". The childSubject filter is only available for science units and must match an available science child subject for the requested programme factors.`
            : 'Unit not found',
        });
      }

      const sequenceData = [...res[sequenceView]].sort(
        sortSequencesByProgrammeSpecificity,
      )[0];

      if (isUnitVariant) {
        // move the unit variant data into the root
        const unitOption = sequenceData.unit_options.find(
          (option) => option.slug === originalSlug,
        );

        if (unitOption) {
          // loop through all the keys in unitOption and copy them to sequenceData
          Object.keys(unitOption).forEach((key) => {
            if (key in sequenceData) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
              (sequenceData as any)[key] =
                unitOption[key as keyof typeof unitOption];
            }
          });
        }
      }

      return formatUnitSummary(originalSlug, sequenceData);
    }),
});
