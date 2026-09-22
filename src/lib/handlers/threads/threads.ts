import { v0Procedure } from '@/lib/protect';
import { router } from '@/lib/trpc';
import * as z from 'zod/v4';
import type { SequenceView, ThreadView } from '@/lib/owaClient';
import {
  getClient,
  gql,
  sequenceView,
  sequenceViewWhereInput,
  threadView,
} from '@/lib/owaClient';
import { TRPCError } from '@trpc/server';
import {
  allThreadsResponseSchema,
  threadUnitsRequestSchema,
  threadUnitsResponseSchema,
} from './schemas';
import { errorResponses } from '@/lib/errorResponses';
// import {
//   getUnitProgrammeFactorsFromSequence,
//   type UnitProgrammeFactors,
// } from '@/lib/handlers/unitProgrammeFactors';

export const getThreads = router({
  getAllThreads: v0Procedure
    .meta({
      openapi: {
        tags: ['lists'],
        method: 'GET',
        summary: 'All threads',
        path: '/threads',
        errorResponses,
        description: `Use when you want the catalogue of every thread. A thread is an attribute on a unit that groups units across the curriculum to build a common body of knowledge — making vertical connections across year groups. Returns all threads with published units, sorted alphabetically — each with title, slug, and unitCount.

Not for: the units inside a thread (GET /threads/{threadSlug}/units).`,
      },
    })
    .output(allThreadsResponseSchema)
    .input(z.void())
    .query(async () => {
      const client = getClient();

      const query = gql`
        query {
          ${threadView} {
            title
            slug
            unit_count
          }
        }
      `;

      const res: ThreadView = await client.request(query);
      const threads = res[threadView];

      return threads
        .sort((a, b) => a.title.localeCompare(b.title))
        .map(({ title, slug, unit_count }) => ({
          title,
          slug,
          unitCount: unit_count,
        }));
    }),
  getThreadUnits: v0Procedure
    .meta({
      openapi: {
        tags: ['lists'],
        method: 'GET',
        path: '/threads/{threadSlug}/units',
        summary: 'Units in a thread',
        description: `Use when you want every unit in a thread. A thread is an attribute on a unit that groups units across the curriculum to build a common body of knowledge — for example, number and place value or scientific method. Units in a thread span multiple programmes and key stages; thread order is independent of unit sequence order within any individual programme. Returns units in thread order with unitTitle, unitSlug, and unitOrder.

Not for: the catalogue of threads (GET /threads); all units across a sequence (GET /sequences/{sequence}/units); units in one programme (GET /programmes/{programme}/units); a single unit (GET /units/{unit}/summary).

Example: 'threadSlug=number-and-place-value'.`,
        errorResponses,
      },
    })
    .input(threadUnitsRequestSchema)
    .output(threadUnitsResponseSchema)
    .query(async ({ input }) => {
      const client = getClient();
      const { threadSlug } = input;

      const threadQuery = gql`
        query ($threadSlug: String!) {
          ${threadView}(
            where: {
              slug: { _eq: $threadSlug }
            }
          ) {
            slug
          }
        }
      `;

      const threadRes: ThreadView = await client.request(threadQuery, {
        threadSlug,
      });
      const threads = threadRes[threadView];

      if (!threads.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Thread not found',
        });
      }

      const query = gql`
        query getThreadUnits($where: ${sequenceViewWhereInput}) {
          ${sequenceView}(
            where: $where
          ) {
            slug
            title
            # examboard
            # examboard_slug
            # pathway
            # pathway_slug
            # tier
            # tier_slug
          }
        }
      `;

      const where = {
        non_curriculum: { _eq: false },
        state: { _eq: 'published' },
        threads: {
          _contains: [{ slug: threadSlug }],
        },
      };

      const res: SequenceView = await client.request(query, { where });

      const units = res[sequenceView];

      // The sequence view is row-per-(unit, programme variant), so the same
      // unit slug can appear multiple times across exam boards / tiers /
      // pathways. We currently surface one entry per unit slug and leave the
      // programme-factor fields disabled until the API is ready to expose them.
      const seen = new Set<string>();
      const result: {
        unitSlug: string;
        unitTitle: string;
        // programmeFactors?: UnitProgrammeFactors;
      }[] = [];

      for (const unit of units) {
        // const programmeFactors = getUnitProgrammeFactorsFromSequence(unit);

        if (seen.has(unit.slug)) {
          // const existing = result.find((r) => r.unitSlug === unit.slug);
          // if (existing) {
          //   existing.programmeFactors = {
          //     ...existing.programmeFactors,
          //     ...programmeFactors,
          //   };
          // }
          continue;
        }
        seen.add(unit.slug);

        result.push({
          unitSlug: unit.slug,
          unitTitle: unit.title,
          // ...(programmeFactors ? { programmeFactors } : {}),
        });
      }

      return result;
    }),
});
