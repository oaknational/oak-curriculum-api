import type { GraphQLClient } from 'graphql-request';
import type * as z from 'zod/v4';
import type { Context } from '@/lib/context';
import { protectedProcedure, v0Procedure } from '@/lib/protect';
import { router } from '@/lib/trpc';
import { errorResponses } from '@/lib/errorResponses';
import type { UnitVariantLessonsView } from 'lib/owaClient';
import { getClient, gql, unitVariantLessonsView } from 'lib/owaClient';

import {
  keyStageSubjectLessonsRequestSchema,
  keyStageSubjectLessonsResponseSchema,
} from './schemas';
import { nextPageLink } from '@/lib/pagination';
import {
  getLessonsAssetRestrictionStatuses,
  getLessonsRestrictionStatuses,
} from '@/lib/queryGate';
import {
  checkRestrictedLessonsAnyResponseSchema,
  checkRestrictedLessonsResponseSchema,
  detailedQuerySchema,
  isDetailed,
} from '../lesson/schemas';

const checkRestrictedDescription = `Use when you want the third-party content restriction status of every published lesson in a key stage + subject. Returns an object keyed by lesson slug, each with a restriction status of \`ogl-compatible\` or \`restricted\`. Pass unit to restrict to one. Supports offset/limit pagination; Link: rel="next" header signals more pages.

Not for: checking a list of lessons you already have (POST /lessons/check-restricted); listing the lessons themselves (GET /key-stages/{keyStage}/subject/{subject}/lessons).

Example: keyStage=ks3, subject=maths, unit=perimeter-and-area.`;

/**
 * The lesson slugs a key stage + subject check-restricted request covers, one
 * page of them, setting the `Link` header when there may be another page.
 */
async function keyStageSubjectLessonSlugs(
  client: GraphQLClient,
  input: z.infer<typeof keyStageSubjectLessonsRequestSchema>,
  ctx: Context,
): Promise<string[]> {
  const keyStage = decodeURIComponent(input.keyStage);
  const subject = decodeURIComponent(input.subject);
  const unit = input.unit || null;

  const offset = input.offset ?? 0;
  const limit = input.limit;

  const unitFilter = unit ? `unit_slug: {_eq: "${unit}"}` : '';

  const query = gql`
      query ($filter: jsonb!, $offset: Int! $limit: Int!) {
        ${unitVariantLessonsView}(
          where: {
            programme_fields: {
              _contains: $filter
            }
            is_legacy: { _eq: false }
            ${unitFilter}
          },
          offset: $offset,
          limit: $limit,
          order_by: {unit_slug: asc}
        ) {
          lesson_slug: lesson_data(path: "slug")
        }
      }
    `;

  const variables: {
    filter: {
      keystage_slug: string;
      subject_slug?: string;
      subject_parent?: string;
    };
    offset: number;
    limit: number;
  } = {
    filter: {
      subject_slug: subject,
      keystage_slug: keyStage,
    },
    offset,
    limit,
  };

  if (keyStage === 'ks4' && subject === 'science') {
    delete variables.filter.subject_slug;
    variables.filter.subject_parent = 'Science';
  }

  const res: UnitVariantLessonsView = await client.request(query, variables);

  const lessons = res[unitVariantLessonsView];

  if (lessons.length === 0) {
    return [];
  }

  if (lessons.length === limit) {
    const next = nextPageLink(
      ctx.major,
      ctx.req.url,
      offset,
      limit,
      unit ? { unit } : undefined,
    );

    ctx.resHeaders.set('link', `<${next}>; rel="next"`);
  }

  return lessons.map((lesson) => lesson.lesson_slug);
}

export const getKeyStageSubjectLessons = router({
  getKeyStageSubjectLessons: v0Procedure
    .meta({
      openapi: {
        method: 'GET',
        tags: ['lists', 'lessons'],
        path: '/key-stages/{keyStage}/subject/{subject}/lessons',
        summary: 'List lessons in a key stage and subject',
        description: `Use when you want every published lesson in a key stage + subject, grouped by unit, without programme structure or unit sequence order. Returns an array of units, each with slug, title, and the lessons inside. Pass unit to restrict to one. Supports offset/limit pagination; Link: rel="next" header signals more pages.

Not for: finding a lesson from a search term (GET /search/lessons); a single lesson's metadata (GET /lessons/{lesson}/summary); all units across a sequence (GET /sequences/{sequence}/units); units in one programme (GET /programmes/{programme}/units).

Example: keyStage=ks3, subject=maths, unit=perimeter-and-area.`,
        errorResponses,
      },
    })
    .input(keyStageSubjectLessonsRequestSchema)
    .output(keyStageSubjectLessonsResponseSchema)
    .query(async ({ input, ctx }) => {
      const keyStage = decodeURIComponent(input.keyStage);
      const subject = decodeURIComponent(input.subject);
      const unit = input.unit || null;

      const offset = input.offset ?? 0;
      const limit = input.limit;

      const client = getClient();

      const unitFilter = unit ? `unit_slug: {_eq: "${unit}"}` : '';

      const query = gql`
        query ($filter: jsonb!, $offset: Int! $limit: Int!) {
          ${unitVariantLessonsView}(
            where: {
              programme_fields: {
                _contains: $filter
              }
              is_legacy: { _eq: false }
              ${unitFilter}
            },
            offset: $offset,
            limit: $limit,
            order_by: {unit_slug: asc}
          ) {
            lesson_slug: lesson_data(path: "slug")
            lesson_title: lesson_data(path: "title")
            unit_slug
            unit_title:unit_data(path:"title")
          }
        }
      `;

      const variables: {
        filter: {
          keystage_slug: string;
          subject_slug?: string;
          subject_parent?: string;
        };
        offset: number;
        limit: number;
      } = {
        filter: {
          subject_slug: subject,
          keystage_slug: keyStage,
        },
        offset,
        limit,
      };

      if (keyStage === 'ks4' && subject === 'science') {
        delete variables.filter.subject_slug;
        variables.filter.subject_parent = 'Science';
      }

      const res: UnitVariantLessonsView = await client.request(
        query,
        variables,
      );

      const lessons = res[unitVariantLessonsView];

      if (lessons.length === 0) {
        return [];
      }

      if (lessons.length === limit) {
        const next = nextPageLink(
          ctx.major,
          ctx.req.url,
          offset,
          limit,
          unit ? { unit } : undefined,
        );

        ctx.resHeaders.set('link', `<${next}>; rel="next"`);
      }

      // transform to be an array of the units with a list of lessons
      const units = lessons.reduce(
        (
          acc,
          {
            unit_slug: unitSlug,
            unit_title: unitTitle,
            lesson_slug: lessonSlug,
            lesson_title: lessonTitle,
          },
        ) => {
          const unit = acc.find((u) => u.unitSlug === unitSlug);

          // this is never true, but keeps TypeScript quiet
          if (!lessonSlug || !lessonTitle || !unitSlug || !unitTitle) {
            return acc;
          }

          const res = {
            lessonSlug,
            lessonTitle,
          };

          if (unit) {
            unit.lessons.push(res);
          } else {
            acc.push({
              unitSlug,
              unitTitle,
              lessons: [res],
            });
          }

          return acc;
        },
        [] as {
          unitSlug: string;
          unitTitle: string;
          lessons: { lessonSlug: string; lessonTitle: string }[];
        }[],
      );

      return units;
    }),

  getKeyStageSubjectLessonRestrictions: v0Procedure
    .meta({
      removedIn: 'v1',
      openapi: {
        method: 'GET',
        tags: ['lists', 'lessons'],
        path: '/key-stages/{keyStage}/subject/{subject}/check-restricted',
        summary: 'List lesson TPC restrictions in a key stage and subject',
        description: checkRestrictedDescription,
        errorResponses,
      },
    })
    .input(keyStageSubjectLessonsRequestSchema)
    .output(checkRestrictedLessonsResponseSchema)
    .query(async ({ input, ctx }) => {
      const client = getClient();
      const lessonSlugs = await keyStageSubjectLessonSlugs(client, input, ctx);

      if (!lessonSlugs.length) {
        return {};
      }

      // no asset type: this answers for the lesson as a whole rather than for
      // one of its assets, so it takes the gate's default reading
      return getLessonsRestrictionStatuses(client, lessonSlugs);
    }),
  // supersedes getKeyStageSubjectLessonRestrictions from v1, adding `detailed`
  getKeyStageSubjectLessonRestrictionsV1: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        tags: ['lists', 'lessons'],
        path: '/key-stages/{keyStage}/subject/{subject}/check-restricted',
        operationId:
          'getKeyStageSubjectLessonsGetKeyStageSubjectLessonRestrictions',
        summary: 'List lesson TPC restrictions in a key stage and subject',
        description: `${checkRestrictedDescription}

Pass \`detailed=true\` to get, for each lesson, the restriction status of every asset type (as served by GET /lessons/{lesson}/assets/{type}, GET /lessons/{lesson}/transcript and GET /lessons/{lesson}/quiz) in place of a single status for the whole lesson.`,
        errorResponses,
      },
    })
    .input(
      keyStageSubjectLessonsRequestSchema.extend({
        detailed: detailedQuerySchema,
      }),
    )
    .output(checkRestrictedLessonsAnyResponseSchema)
    .query(async ({ input, ctx }) => {
      const client = getClient();
      const lessonSlugs = await keyStageSubjectLessonSlugs(client, input, ctx);

      if (!lessonSlugs.length) {
        return {};
      }

      return isDetailed(input.detailed)
        ? getLessonsAssetRestrictionStatuses(client, lessonSlugs)
        : getLessonsRestrictionStatuses(client, lessonSlugs);
    }),
});
