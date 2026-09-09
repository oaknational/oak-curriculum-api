import { protectedProcedure } from '@/lib/protect';
import { router } from '@/lib/trpc';

import type { UnitVariantLessonsView } from 'lib/owaClient';
import { getClient, gql, unitVariantLessonsView } from 'lib/owaClient';

import { keywordsRequestSchema, keywordsResponseSchema } from './schemas';
import { phaseToKeyStageMap } from '@/lib/oakConsts';
import { nextPageLink } from '@/lib/pagination';

export const getKeywords = router({
  getKeywords: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        tags: ['lists'],
        path: '/keywords',
        summary: 'Keywords by subject and key stage',
        description: `Use when you want the vocabulary for a key stage, subject, unit, lesson, or phase — e.g. to build a glossary or attach definitions to content. Returns keywords with definition, the subject + key stage they appear in, and the lessons that use them, sorted alphabetically. All filters are optional, but pass at least one of keyStage, subject, unit, lesson, or phase.`,
        errorResponses: [],
      },
    })
    .input(keywordsRequestSchema)
    .output(keywordsResponseSchema)
    .query(async ({ input, ctx }) => {
      const { offset, limit } = input;
      const keyStage = decodeURIComponent(input.keyStage || '') || undefined;
      const subject = decodeURIComponent(input.subject || '') || undefined;
      const unit = input.unit ? decodeURIComponent(input.unit) : undefined;
      const lesson = input.lesson
        ? decodeURIComponent(input.lesson)
        : undefined;
      const phase = input.phase ? decodeURIComponent(input.phase) : undefined;

      const phaseKeyStages = phase ? phaseToKeyStageMap[phase] : undefined;

      const client = getClient();

      const unitFilter = unit ? `unit_slug: { _eq: $unit }` : '';
      const lessonFilter = lesson ? `lesson_slug: { _eq: $lesson }` : '';

      const query = gql`
        query ($filter: jsonb!${unit ? ', $unit: String' : ''}${lesson ? ', $lesson: String' : ''}) {
          ${unitVariantLessonsView}(
            where: {
              is_legacy: { _eq: false }
              programme_fields: {
                _contains: $filter
              }
              ${unitFilter}
              ${lessonFilter}
            },
            order_by: {lesson_slug: asc}
          ) {
            lesson_slug: lesson_data(path: "slug")
            keywords: lesson_data(path: "keywords")
            subject_slug:programme_fields(path:"subject_slug")
            keystage_slug:programme_fields(path:"keystage_slug")
          }
        }
      `;

      const variables = {
        filter: {
          subject_slug: subject,
          keystage_slug: keyStage,
        },
        ...(unit && { unit }),
        ...(lesson && { lesson }),
      };

      const res: UnitVariantLessonsView = await client.request(
        query,
        variables,
      );

      let lessons = res[unitVariantLessonsView];

      if (phaseKeyStages) {
        lessons = lessons.filter((l) =>
          phaseKeyStages.includes(l.keystage_slug),
        );
      }

      if (lessons.length === 0) {
        return [];
      }

      const keywordMap: Record<
        string,
        {
          description: string;
          subjectSlug: string;
          keyStageSlug: string;
          lessonSlugs: Set<string>;
        }
      > = {};

      lessons.forEach((lesson) => {
        const keywords = lesson.keywords || [];
        keywords.forEach((keywordObj) => {
          const { keyword, description } = keywordObj;
          if (!keywordMap[keyword]) {
            keywordMap[keyword] = {
              description,
              subjectSlug: lesson.subject_slug,
              keyStageSlug: lesson.keystage_slug,
              lessonSlugs: new Set(),
            };
          }
          keywordMap[keyword].lessonSlugs.add(lesson.lesson_slug);
        });
      });

      const keywords = Object.entries(keywordMap)
        .toSorted(
          // sort by the keyword
          (a, b) => a[0].localeCompare(b[0]),
        )
        .map(([keyword, { lessonSlugs, ...data }]) => ({
          keyword,
          lessonSlugs: Array.from(lessonSlugs),
          ...data,
        }));

      // Keywords are deduplicated across every matching lesson, so the page is
      // taken after that rather than from the lessons query.
      if (offset + limit < keywords.length) {
        ctx.resHeaders.set(
          'link',
          `<${nextPageLink(ctx.major, ctx.req.url, offset, limit)}>; rel="next"`,
        );
      }

      return keywords.slice(offset, offset + limit);
    }),
});
