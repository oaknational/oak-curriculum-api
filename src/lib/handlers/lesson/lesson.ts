import groupBy from 'object.groupby';
import { v0Procedure } from '@/lib/protect';
import { router } from '@/lib/trpc';
import { TRPCError } from '@trpc/server';
import {
  getClient,
  gql,
  LessonRestrictionView,
  lessonRestrictionView,
  lessonSearchView,
  lessonView,
} from 'lib/owaClient';
import type { LessonSearchView, LessonView } from 'lib/owaClient';
import * as z from 'zod/v4';
import { errorResponses } from '@/lib/errorResponses';

import {
  collapsedRestrictionStatus,
  collapsedRestrictionStatuses,
  highestRestrictionLevel,
  isLessonRestricted,
  isSubjectAllowed,
} from '@/lib/queryGate';
import {
  getUnitProgrammeFactorsFromLesson,
  getUnitProgrammeFactorsSignature,
  type UnitProgrammeFactors,
} from '@/lib/handlers/unitProgrammeFactors';

import {
  lessonSearchRequestSchema,
  lessonSearchResponseSchema,
  lessonSummaryRequestSchema,
  lessonSummaryResponseSchema,
  type LessonSearchResultType,
} from './schemas';
import {
  getCanonicalUrlForLesson,
  getOakUrlForLesson,
} from '@/lib/canonicalUrls';

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
groupBy.shim();

const restrictionEnum = z.enum(collapsedRestrictionStatuses);
export type RestrictionOutput = z.infer<typeof restrictionEnum>;
export const checkRestrictedLessonsResponseSchema = z
  .record(z.string(), restrictionEnum)
  .meta({
    example: {
      'joining-using-and': 'ogl-compatible',
      'restricted-lesson': 'restricted',
    },
  });

export const getLessons = router({
  postCheckRestrictedLessons: v0Procedure
    .meta({
      openapi: {
        method: 'POST',
        tags: ['lessons'],
        summary: 'Check restrictions for a list of lessons',
        path: '/lessons/check-restricted',
        description: `Use when you have a list of lesson slugs and need to check if they are restricted. Returns a list of lessons with their restriction status and reasons.
Not for: checking a single lesson (GET /lessons/{lesson}/summary); searching lessons by title (GET /search/lessons); listing every lesson in a unit or subject (GET /key-stages/{keyStage}/subject/{subject}/lessons).`,
        errorResponses,
      },
    })
    .input(
      z.object({
        lessonSlugs: z
          .array(z.string())
          .min(1, 'At least one lesson slug is required'),
      }),
    )
    .output(checkRestrictedLessonsResponseSchema)
    .query(async ({ input }) => {
      const { lessonSlugs } = input;
      const client = getClient();

      const query = gql`
        query ($slugs: [String!]!) @cached(ttl: 300) {
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

      const res: LessonRestrictionView = await client.request(query, {
        slugs: lessonSlugs,
      });

      const results = res[lessonRestrictionView].reduce(
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
  getLesson: v0Procedure
    .meta({
      openapi: {
        method: 'GET',
        tags: ['lessons'],
        summary: 'Lesson summary by slug',
        path: '/lessons/{lesson}/summary',
        description: `Use when you have a lesson slug and need its full metadata: title, key stage, subject, unit, keywords, key learning points, misconceptions, pupil lesson outcome, teacher tips, content guidance, supervision level, and downloadsAvailable. Returns the lesson summary record.

Not for: finding a lesson from a search term (GET /search/lessons); searching what's said in lesson videos (GET /search/transcripts); listing every lesson in a unit or subject (GET /key-stages/{keyStage}/subject/{subject}/lessons); the transcript or assets (GET /lessons/{lesson}/transcript or GET /lessons/{lesson}/assets).

Example slug: imagining-you-are-the-characters-the-three-billy-goats-gruff.`,
        errorResponses,
      },
    })
    .input(lessonSummaryRequestSchema)
    .output(lessonSummaryResponseSchema)
    .query(async ({ input }) => {
      const slug = decodeURIComponent(input.lesson);
      const client = getClient();

      /** show lesson summary (regardless of tpc) - but Aakesh is going to find out if "highly restricted in works" means blocked on /summary */
      // const blocked = await isLessonRestricted(client, slug);

      // if (blocked.isBlocked()) {
      //   throw new TRPCError({
      //     message: `Lesson "${slug}" is restricted and cannot be accessed`,
      //     code: 'BAD_REQUEST',
      //     cause: blocked.reason,
      //   });
      // }

      const query = gql`
        query ($slug: String!) @cached(ttl: 300) {
          ${lessonView}(
            where: { lessonSlug: { _eq: $slug }, isLegacy: { _eq: false } }
          ) {
            lessonTitle
            unitSlug
            unitTitle
            examBoardSlug
            examBoardTitle
            tierSlug
            tierTitle
            subjectSlug
            subjectTitle
            keyStageSlug
            keyStageTitle
            lessonKeywords
            keyLearningPoints
            misconceptionsAndCommonMistakes
            pupilLessonOutcome
            teacherTips
            contentGuidance
            downloadsAvailable: hasDownloadableResources
            supervisionLevel
            programmeSlug
          }
        }
      `;

      const res: LessonView = await client.request(query, {
        slug,
      });

      const data = res[lessonView];

      if (data.length === 0) {
        throw new TRPCError({
          message: 'Lesson not found',
          code: 'NOT_FOUND',
        });
      }

      // validate the subject
      if (!data[0].subjectSlug || !isSubjectAllowed(data[0].subjectSlug)) {
        throw new TRPCError({
          message: 'Lesson not found',
          code: 'NOT_FOUND',
        });
      }

      try {
        // The same lesson can appear in multiple unit variants (e.g. AQA
        // foundation vs OCR higher), so collapse rows to a unique
        // (unitSlug, programmeFactors) set and surface them all in `units`.
        // The non-unit-scoped fields (lessonTitle, subject, key stage, etc.)
        // are consistent across variants so we read them from any row.
        const seen = new Set<string>();
        const units: {
          unitSlug: string;
          unitTitle: string;
          programmeFactors?: UnitProgrammeFactors;
        }[] = [];

        for (const row of data) {
          if (!row.unitSlug || !row.unitTitle) {
            continue;
          }

          const programmeFactors = getUnitProgrammeFactorsFromLesson(row);
          const dedupeKey = `${row.unitSlug}|${getUnitProgrammeFactorsSignature(programmeFactors)}`;

          if (seen.has(dedupeKey)) {
            continue;
          }
          seen.add(dedupeKey);

          units.push({
            unitSlug: row.unitSlug,
            unitTitle: row.unitTitle,
            ...(programmeFactors ? { programmeFactors } : {}),
          });
        }

        units.sort((a, b) => {
          const slugCmp = a.unitSlug.localeCompare(b.unitSlug);
          if (slugCmp !== 0) return slugCmp;
          return getUnitProgrammeFactorsSignature(
            a.programmeFactors,
          ).localeCompare(getUnitProgrammeFactorsSignature(b.programmeFactors));
        });

        const lesson = {
          ...data[0],
          units,
          canonicalUrl: getCanonicalUrlForLesson(slug),
          oakUrl: getOakUrlForLesson(slug),
        } as z.infer<typeof lessonSummaryResponseSchema>;

        if (lesson.downloadsAvailable) {
          const gated = await isLessonRestricted(client, slug);
          if (gated.isBlocked()) {
            lesson.downloadsAvailable = false;
          }
        }

        lessonSummaryResponseSchema.parse(lesson);

        return lesson;
      } catch {
        throw new TRPCError({
          message: 'Internal server error',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
  searchByTextSimilarity: v0Procedure
    .meta({
      openapi: {
        method: 'GET',
        tags: ['lessons', 'search'],
        path: '/search/lessons',
        summary: 'Lesson search by title',
        description: `Use when you want to find lessons whose titles match a search term. Returns up to 20 lessons ranked by title similarity — each with slug, title, URL, similarity score, and the unit(s) the lesson appears in. Optional keyStage, subject, and unit narrow the search.

Not for: searching what's said in lesson videos (GET /search/transcripts); metadata for a known lesson (GET /lessons/{lesson}/summary); listing every lesson in a key stage + subject without ranking (GET /key-stages/{keyStage}/subject/{subject}/lessons).

Example queries: KS3 science photosynthesis, fractions year 5, Macbeth soliloquy.`,
        errorResponses,
      },
    })
    .input(lessonSearchRequestSchema)
    .output(lessonSearchResponseSchema)
    .query(async ({ input }) => {
      // store q from input.q and sanitise for use as an sql query:
      const q = input.q;
      const unit = input.unit || null;
      const subject = input.subject || null;
      const keyStage = input.keyStage || null;

      interface SearchArgs {
        filter_keystage_slug?: string;
        filter_subject_slug?: string;
        filter_unit_slug?: string;
        search_term: string;
      }

      const args: SearchArgs = {
        search_term: q,
      };

      if (unit) {
        args.filter_unit_slug = unit;
      }

      if (subject) {
        args.filter_subject_slug = subject;
      }

      if (keyStage) {
        args.filter_keystage_slug = keyStage;
      }

      const client = getClient();

      const searchQuery = gql`
        query ($search_term: String!, $filter_unit_slug: String, $filter_subject_slug: String, $filter_keystage_slug: String) {
          ${lessonSearchView}(args: {
            search_term: $search_term,
            filter_unit_slug: $filter_unit_slug,
            filter_subject_slug: $filter_subject_slug,
            filter_keystage_slug: $filter_keystage_slug,
          }) {
            lessonSlug
            similarity
          }
        }
      `;

      const result: LessonSearchView = await client.request(searchQuery, {
        ...args,
      });

      const slugs = result[lessonSearchView].map(({ lessonSlug }) => {
        return lessonSlug;
      });

      type SimilarityMap = Record<string, number>;

      const similarity: SimilarityMap = result[lessonSearchView].reduce(
        (acc, { lessonSlug, similarity: sim }) => {
          acc[lessonSlug] = sim;
          return acc;
        },
        {} as SimilarityMap,
      );

      // reality is that this is never going to be string[]
      const variables: Record<string, string | number | string[]> = { slugs };

      const _and: string[] = ['lessonSlug: { _in: $slugs }'];
      const queryArgs = [];

      if (unit) {
        _and.push('unitSlug: { _eq: $unit }');
        queryArgs.push('$unit: String');
        variables.unit = unit;
      }

      if (subject) {
        _and.push('subjectSlug: { _eq: $subject }');
        queryArgs.push('$subject: String');
        variables.subject = subject;
      }

      if (keyStage) {
        _and.push('keyStageSlug: { _eq: $keyStage }');
        queryArgs.push('$keyStage: String');
        variables.keyStage = keyStage;
      }

      const where = `, _and: { ${_and.join(',')}}`;

      const query = gql`
        query ($slugs: [String!]!, ${queryArgs.join(',')}) {
          ${lessonView}(where: {${where}}) {
            lessonSlug
            lessonTitle
            keyStageSlug
            subjectSlug
            unitSlug
            unitTitle
            examBoardTitle
          }
        }
      `;

      interface LessonResult {
        lessonSlug: string;
        lessonTitle: string;
        keyStageSlug: string;
        subjectSlug: string;
        unitSlug: string;
        unitTitle: string;
        examBoardTitle: string;
      }

      interface LessonQueryResult {
        [lessonView]: LessonResult[];
      }

      const res: LessonQueryResult = await client.request(query, variables);

      if (res[lessonView].length === 0) {
        throw new TRPCError({
          message: 'No lessons found',
          code: 'NOT_FOUND',
        });
      }

      const groupedByLesson = Object.values(
        Object.groupBy(res[lessonView], ({ lessonSlug }) => lessonSlug),
      );

      return groupedByLesson
        .reduce((acc, res) => {
          // I can't see how this is ever true, but it's a TS thing.
          if (!res) {
            return acc;
          }

          const { lessonSlug, lessonTitle } = res[0];

          const units = res.map((_) => {
            return {
              unitSlug: _.unitSlug,
              unitTitle: _.unitTitle,
              examBoardTitle: _.examBoardTitle,
              keyStageSlug: _.keyStageSlug,
              subjectSlug: _.subjectSlug,
            };
          });

          acc.push({
            lessonSlug,
            lessonTitle,
            oakUrl: getOakUrlForLesson(lessonSlug),
            similarity: similarity[lessonSlug],
            units,
          });

          return acc;
        }, [] as LessonSearchResultType[])
        .toSorted((a, b) => b.similarity - a.similarity);
    }),
});
