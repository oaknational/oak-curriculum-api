import { protectedProcedure } from '@/lib/protect';
import { router } from '@/lib/trpc';
import * as z from 'zod/v4';
import { errorResponses } from '@/lib/errorResponses';
import {
  programmeUnitsRequestSchema,
  programmeUnitsResponseSchema,
  programmeResponseSchema,
  sequenceProgrammesResponseSchema,
} from './schemas';
import {
  getClient,
  programmesByYearView,
  SyntheticProgrammeByYear,
  SyntheticProgrammesByYearView,
  UnitVariantLessonsView,
  unitVariantLessonsView,
  gql,
} from '@/lib/owaClient';
import { TRPCError } from '@trpc/server';
import { subjectSlugSchema } from '@/lib/handlers/commonTypes';
import { isSubjectAllowed } from '@/lib/queryGate';

export const getAllProgrammesForSubject = router({
  getAllProgrammesForSubject: protectedProcedure
    .meta({
      openapi: {
        tags: ['programmes'],
        method: 'GET',
        path: '/subjects/{subject}/programmes',
        summary: 'Get all programmes for a subject slug',
        /* FIXME this is wrong, it references hallucinations */
        description: `Use when you need to discover the programmes within a subject — to get a programme's slug for use with GET /programmes/{programme} or its sub-endpoints. Returns programmes grouped by key stage, each with year group, slug (e.g. y7, y10-biology-foundation), and applicable programme factors (exam board, tier, child subject).

Not for: the metadata of one programme (GET /programmes/{programme}); the units, questions, or assets of one programme (GET /programmes/{programme}/units, GET /programmes/{programme}/questions, or GET /programmes/{programme}/assets); the sequence-level summary (GET /sequences/{sequence}).`,
        errorResponses,
      },
    })
    .input(z.object({ subject: subjectSlugSchema }))
    .output(sequenceProgrammesResponseSchema)
    .query(async ({ input }) => {
      const { subject } = input;

      const client = getClient();
      const query = gql`
        query ($subjectMatch: jsonb!) {
          ${programmesByYearView}(
            where: {
              _or: [
                { programme_fields: { _contains: $subjectMatch } }
              ]
              is_legacy: { _eq: false }
            }
          ) {
            programme_slug
          }
        }`;

      const res: SyntheticProgrammesByYearView = await client.request(query, {
        subjectMatch: {
          subject_slug: subject,
        },
      });

      const rows: SyntheticProgrammeByYear[] = res[programmesByYearView] ?? [];

      return rows
        .map((row) => row.programme_slug)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }),

  getProgramme: protectedProcedure
    .meta({
      openapi: {
        tags: ['programmes'],
        method: 'GET',
        path: '/programmes/{programme}',
        summary: 'Get a programme by slug',
        description: `Use when you need to get the metadata of one programme. Get programme slugs from GET /subjects/{subject}/programmes. Returns the programme's year group, slug (e.g. y7, y10-biology-foundation), and applicable programme factors (exam board, tier, child subject).

Not for: the units, questions, or assets of one programme (GET /programmes/{programme}/units, GET /programmes/{programme}/questions, or GET /programmes/{programme}/assets); the sequence-level summary (GET /sequences/{sequence}); all programmes for a subject (GET /subjects/{subject}/programmes).`,
        errorResponses,
      },
    })
    .input(programmeUnitsRequestSchema)
    .output(programmeResponseSchema)
    .query(async ({ input }) => {
      const { programme } = input;

      const client = getClient();
      const query = gql`
        query ($programme: String!) {
          ${programmesByYearView}(
            where: {
              programme_slug: { _eq: $programme }
              is_legacy: { _eq: false }
            }
          ) {
            programme_fields
          }
        }
      `;

      const res: SyntheticProgrammesByYearView = await client.request(query, {
        programme,
      });

      const rows: SyntheticProgrammeByYear[] = res[programmesByYearView] ?? [];

      if (rows.length === 0) {
        throw new Error(`Programme not found: ${programme}`);
      }

      const {
        tier: tierTitle,
        year: yearTitle,
        phase: phaseTitle,
        pathway: pathwayTitle,
        subject: subjectTitle,
        keystage: keystageTitle,
        examboard: examboardTitle,
        tier_slug: tierSlug,
        year_slug: yearSlug,
        phase_slug: phaseSlug,
        pathway_slug: pathwaySlug,
        subject_slug: subjectSlug,
        keystage_slug: keystageSlug,
        examboard_slug: examboardSlug,
      } = rows[0].programme_fields;

      // validate the subject
      if (!isSubjectAllowed(subjectSlug)) {
        throw new TRPCError({
          message: 'Programme not found',
          code: 'NOT_FOUND',
        });
      }

      return {
        examboardSlug,
        examboardTitle,
        keystageSlug,
        keystageTitle,
        pathwaySlug,
        pathwayTitle,
        phaseSlug,
        phaseTitle,
        subjectSlug,
        subjectTitle,
        tierSlug,
        tierTitle,
        yearSlug,
        yearTitle,
      };
    }),

  getProgrammeUnits: protectedProcedure
    .meta({
      openapi: {
        tags: ['programmes', 'units'],
        method: 'GET',
        path: '/programmes/{programme}/units',
        summary: 'Units in a programme',
        description: `Use when you need the unit sequence for one programme — units as an ordered arrangement designed to build knowledge progressively. Get programme slugs from GET /subjects/{subject}/programmes. Returns units in unit sequence order with title, slug, and any associated factors.

  Not for: every unit across the whole sequence (GET /sequences/{sequence}/units); a flat list of units for a key stage + subject without programme structure (GET /key-stages/{keyStage}/subject/{subject}/units); a single unit (GET /units/{unit}/summary); units in a thread (GET /threads/{threadSlug}/units).`,
        errorResponses,
      },
    })
    .input(programmeUnitsRequestSchema)
    .output(programmeUnitsResponseSchema)
    .query(async ({ input }) => {
      const { programme } = input;

      const client = getClient();
      const query = gql`
        query ($programme: String!) {
          ${unitVariantLessonsView}(
            where: {
              programme_slug: { _eq: $programme }
              is_legacy: { _eq: false }
            }
          ) {
            unit_slug
            unit_title: unit_data(path: "title")
            optionality: programme_fields(path: "optionality")
            subject_slug: programme_fields(path: "subject_slug")
            supplementary_data
          }
        }
      `;

      const res: UnitVariantLessonsView = await client.request(query, {
        programme,
      });

      const rows = res[unitVariantLessonsView];

      if (!rows || rows.length === 0) {
        throw new TRPCError({
          message: 'Programme not found',
          code: 'NOT_FOUND',
        });
      }

      // validate the subject
      if (!isSubjectAllowed(rows[0].subject_slug)) {
        throw new TRPCError({
          message: 'Programme not found',
          code: 'NOT_FOUND',
        });
      }

      // Deduplicate: the view has one row per lesson; we only need one row per
      // unit (the first encountered carries the order and title).
      const seen = new Map<
        string,
        { unitSlug: string; unitTitle: string; unitOrder: number }
      >();

      for (const row of rows) {
        if (seen.has(row.unit_slug)) continue;
        seen.set(row.unit_slug, {
          unitSlug: row.unit_slug,
          unitTitle: row.optionality ?? row.unit_title,
          unitOrder: row.supplementary_data.unit_order,
        });
      }

      return Array.from(seen.values()).sort(
        (a, b) => a.unitOrder - b.unitOrder,
      );
    }),
});
