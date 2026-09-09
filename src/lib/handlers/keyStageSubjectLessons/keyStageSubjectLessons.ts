import { v0Procedure } from '@/lib/protect';
import { router } from '@/lib/trpc';
import { errorResponses } from '@/lib/errorResponses';
import type {
  LessonRestrictionView,
  UnitVariantLessonsView,
} from 'lib/owaClient';
import {
  getClient,
  gql,
  lessonRestrictionView,
  unitVariantLessonsView,
} from 'lib/owaClient';

import {
  keyStageSubjectLessonsRequestSchema,
  keyStageSubjectLessonsResponseSchema,
} from './schemas';
import { nextPageLink } from '@/lib/pagination';
import {
  collapsedRestrictionStatus,
  highestRestrictionLevel,
} from '@/lib/queryGate';
import {
  checkRestrictedLessonsResponseSchema,
  RestrictionOutput,
} from '../lesson/lesson';

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

      let next = null;
      if (lessons.length === limit) {
        next = nextPageLink(
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
      openapi: {
        method: 'GET',
        tags: ['lists', 'lessons'],
        path: '/key-stages/{keyStage}/subject/{subject}/check-restricted',
        summary: 'List lesson TPC restrictions in a key stage and subject',
        description: `Use when you want every published lesson in a key stage + subject, grouped by unit, without programme structure or unit sequence order. Returns an array of units, each with slug, title, and the lessons inside. Pass unit to restrict to one. Supports offset/limit pagination; Link: rel="next" header signals more pages.
Not for: finding a lesson from a search term (GET /search/lessons); a single lesson's metadata (GET /lessons/{lesson}/summary); all units across a sequence (GET /sequences/{sequence}/units); units in one programme (GET /programmes/{programme}/units).

Example: keyStage=ks3, subject=maths, unit=perimeter-and-area.`,
        errorResponses,
      },
    })
    .input(keyStageSubjectLessonsRequestSchema)
    .output(checkRestrictedLessonsResponseSchema)
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
        return {};
      }

      let next = null;
      if (lessons.length === limit) {
        next = nextPageLink(
          ctx.major,
          ctx.req.url,
          offset,
          limit,
          unit ? { unit } : undefined,
        );

        ctx.resHeaders.set('link', `<${next}>; rel="next"`);
      }

      const lessonSlugs = lessons.map((lesson) => lesson.lesson_slug);

      const tpcQuery = gql`
        query ($slugs: [String!]!) {
          ${lessonRestrictionView}(
            where: { slug: { _in: $slugs }, _state: { _eq: "published" } }
          ) {
            slug
            tpc_downloadablefiles_max_restriction
            tpc_media_max_restriction
            tpc_quizimages_max_restriction
            tpc_works_max_restriction
          }
        }
      `;

      const resRestrictions: LessonRestrictionView = await client.request(
        tpcQuery,
        {
          slugs: lessonSlugs,
        },
      );

      const results = resRestrictions[lessonRestrictionView].reduce(
        (acc, curr) => {
          acc[curr.slug] = collapsedRestrictionStatus(
            highestRestrictionLevel([
              curr.tpc_downloadablefiles_max_restriction,
              curr.tpc_media_max_restriction,
              curr.tpc_quizimages_max_restriction,
              curr.tpc_works_max_restriction,
            ]),
          );

          return acc;
        },
        {} as Record<string, RestrictionOutput>,
      );

      return results;
    }),
});
