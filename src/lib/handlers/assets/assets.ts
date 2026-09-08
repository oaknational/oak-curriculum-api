import { TRPCError } from '@trpc/server';
import { gql } from 'graphql-request';
import { errorResponses } from '@/lib/errorResponses';
import { protectedProcedure } from '@/lib/protect';
import { router } from '@/lib/trpc';
import type {
  Download,
  DownloadView,
  LessonView,
  UnitVariantLessonsView,
  SequenceView,
} from '@/lib/owaClient';
import {
  downloadView,
  getClient,
  lessonView,
  unitVariantLessonsView,
  sequenceView,
  sequenceViewWhereInput,
} from '@/lib/owaClient';
import { subjectSlugs } from '@/lib/keyStageAndSubjects';
import { baseUrl } from '@/lib/baseUrl';
import { getOakUrlForLesson } from '@/lib/canonicalUrls';

import { getLessonsRestrictions, isLessonRestricted } from '@/lib/queryGate';
import { sequenceWhere } from '../sequences/sequences';
import { nextPageLink } from '@/lib/pagination';
import { downloadTypeEnum } from './types';
import type { DownloadTypeEnum, LessonAssetsType } from './types';
import { getAttribution } from './helpers';

import {
  subjectAssetsRequestSchema,
  subjectAssetsResponseSchema,
  programmeAssetsRequestSchema,
  programmeAssetsResponseSchema,
  sequenceAssetsRequestSchema,
  sequenceAssetsResponseSchema,
  lessonAssetRequestSchema,
  lessonAssetResponseSchema,
  lessonAssetsRequestSchema,
  lessonAssetsResponseSchema,
} from './schemas';

import placeholderVideoLessons from '@/lib/queryGateData/placeholderVideoLessons.json' with { type: 'json' };

type Attribution = (string | undefined)[] | undefined;

interface AssetsForLesson {
  assets: Download;
  attribution: Attribution;
}

export async function assetsForLesson(
  lessonSlug: string,
): Promise<AssetsForLesson> {
  const graphqlClient = getClient();
  const gateTest = await isLessonRestricted(graphqlClient, lessonSlug);

  if (gateTest.isBlocked()) {
    throw new TRPCError({
      message: `Lesson not available: "${lessonSlug}"`,
      code: 'BAD_REQUEST',
      cause: gateTest.reason,
    });
  }

  const queryDownloads = gql`
    query GetDownloads($lessonSlug: String!) {
      ${downloadView}(
        where: {
          lessonSlug: { _eq: $lessonSlug }
        }
      ) {
        lessonSlug
        lessonTitle
        exitQuiz
        exitQuizAnswers
        slideDeck: slidedeck
        starterQuizAnswers
        starterQuiz: starter_quiz
        supplementaryResource
        video: videos
        worksheet
        worksheetAnswers
      }
    }
  `;

  const variables = {
    lessonSlug,
  };

  const lessonDetailViewResult: DownloadView = await graphqlClient.request(
    queryDownloads,
    variables,
  );

  const res = lessonDetailViewResult[downloadView];

  if (!res || res.length === 0 || !res[0]) {
    throw new TRPCError({
      message: 'No lessons found',
      code: 'NOT_FOUND',
    });
  }

  const tpcQuery = gql`
    query GetTPC($lessonSlug: String!) {
      ${lessonView}(
        where: {
          lessonSlug: { _eq: $lessonSlug }
        }
      ) {
        subjectSlug
        lessonSlug
        tpcWorks
        tpcMedia
      }
    }
  `;

  const tpcViewResult: LessonView = await graphqlClient.request(tpcQuery, {
    lessonSlug,
  });

  const attribution = tpcViewResult[lessonView][0];

  // validate the subject
  if (
    !attribution.subjectSlug ||
    !subjectSlugs.includes(attribution.subjectSlug)
  ) {
    throw new TRPCError({
      message: 'Lesson not found',
      code: 'NOT_FOUND',
    });
  }

  let mappedAttribution: Attribution = [];

  if (attribution) {
    mappedAttribution = [
      ...(attribution.tpcWorks?.map((_) => _.attribution) || []),
      ...(attribution.tpcMedia?.map((_) => _.attribution) || []),
    ].filter(Boolean);
  }

  return {
    attribution: mappedAttribution.length ? mappedAttribution : undefined,
    assets: res[0],
  };
}

interface AssetDownload {
  label: string;
  type: DownloadTypeEnum;
  url: string;
}

function assetDownloads(
  lessonSlug: string,
  download: Download,
  filter?: DownloadTypeEnum,
): AssetDownload[] {
  const assetUrls = [];

  if (download.slideDeck && download.slideDeck.bucket_path) {
    assetUrls.push({
      label: download.slideDeck.label,
      type: downloadTypeEnum.enum.slideDeck,
      url: `${baseUrl}/lessons/${lessonSlug}/assets/slideDeck`,
    });
  }

  if (download.worksheet && download.worksheet.bucket_path) {
    assetUrls.push({
      label: download.worksheet.label,
      type: downloadTypeEnum.enum.worksheet,
      url: `${baseUrl}/lessons/${lessonSlug}/assets/worksheet`,
    });
  }

  if (download.worksheetAnswers && download.worksheetAnswers.bucket_path) {
    assetUrls.push({
      label: download.worksheetAnswers.label,
      type: downloadTypeEnum.enum.worksheetAnswers,
      url: `${baseUrl}/lessons/${lessonSlug}/assets/worksheetAnswers`,
    });
  }

  if (
    download.supplementaryResource &&
    download.supplementaryResource.bucket_path
  ) {
    assetUrls.push({
      label: download.supplementaryResource.label,
      type: downloadTypeEnum.enum.supplementaryResource,
      url: `${baseUrl}/lessons/${lessonSlug}/assets/supplementaryResource`,
    });
  }

  if (download.starterQuiz && download.starterQuiz.bucket_path) {
    assetUrls.push({
      label: download.starterQuiz.label,
      type: downloadTypeEnum.enum.starterQuiz,
      url: `${baseUrl}/lessons/${lessonSlug}/assets/starterQuiz`,
    });
  }

  if (download.starterQuizAnswers && download.starterQuizAnswers.bucket_path) {
    assetUrls.push({
      label: download.starterQuizAnswers.label,
      type: downloadTypeEnum.enum.starterQuizAnswers,
      url: `${baseUrl}/lessons/${lessonSlug}/assets/starterQuizAnswers`,
    });
  }

  if (download.exitQuiz && download.exitQuiz.bucket_path) {
    assetUrls.push({
      label: download.exitQuiz.label,
      type: downloadTypeEnum.enum.exitQuiz,
      url: `${baseUrl}/lessons/${lessonSlug}/assets/exitQuiz`,
    });
  }

  if (download.exitQuizAnswers && download.exitQuizAnswers.bucket_path) {
    assetUrls.push({
      label: download.exitQuizAnswers.label,
      type: downloadTypeEnum.enum.exitQuizAnswers,
      url: `${baseUrl}/lessons/${lessonSlug}/assets/exitQuizAnswers`,
    });
  }

  if (download.video && (download.video.download || download.video.stream)) {
    if (!placeholderVideoLessons.includes(lessonSlug)) {
      assetUrls.push({
        label: download.video.label,
        type: downloadTypeEnum.enum.video,
        url: `${baseUrl}/lessons/${lessonSlug}/assets/video`,
      });
    }
  }

  const result = assetUrls.filter((asset) => !filter || asset.type === filter);

  return result;
}

export const getAssets = router({
  getSequenceAssets: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        tags: ['assets', 'sequences'],
        path: '/sequences/{sequence}/assets',
        errorResponses,
        summary: 'Downloadable assets in a sequence',
        description: `Use when you need every downloadable asset across a whole sequence — all programmes combined. Returns assets grouped by lesson in unit sequence order, with signed download URLs, asset type, lesson title and slug, and attribution. Pass year as an optional filter. Narrow further with type (one of: slideDeck, starterQuiz, starterQuizAnswers, exitQuiz, exitQuizAnswers, worksheet, worksheetAnswers, supplementaryResource, video). Lesson content is under OGL v3.0; assets are either Oak-owned or third-party under an OGL-compatible licence. Attribution required — see https://open-api.thenational.academy/docs/about-oaks-api/terms.

Not for: assets in a single programme (GET /programmes/{programme}/assets); a single lesson's downloads (GET /lessons/{lesson}/assets); streaming one file (GET /lessons/{lesson}/assets/{type}); assets for a key stage + subject without programme structure (GET /key-stages/{keyStage}/subject/{subject}/assets).`,
      },
    })
    .input(sequenceAssetsRequestSchema)
    .output(sequenceAssetsResponseSchema)
    .query(async ({ input }) => {
      const { sequence, type, year } = input;
      const client = getClient();

      // FIXME can I get finance education? I shouldn't be able to.
      const where = sequenceWhere(sequence, year ? year.toString() : undefined);

      const query = gql`
      query ($where: ${sequenceViewWhereInput}!) {
        ${sequenceView}(
          where: $where
          order_by: { order: asc }
        ) {
          slug
          lessons
        }
      }`;

      const res: SequenceView = await client.request(query, { where });
      const rawData = res[sequenceView];

      const lessonSlugs = Array.from(
        new Set(
          rawData
            .map((unit) => {
              return unit.lessons.map((lesson) => lesson.slug);
            })
            .flat(),
        ),
      );

      const restrictions = await getLessonsRestrictions(client, lessonSlugs);
      const lessonsAllowed = lessonSlugs.filter((slug) => !restrictions[slug]);

      const downloadsQuery = gql`
        query GetDownloads($lessonSlugs: [String!]!) {
          ${downloadView}(
            where: {
              lessonSlug: { _in: $lessonSlugs }
            }
          ) {
            lessonSlug
            lessonTitle
            exitQuiz
            exitQuizAnswers
            lessonSlug
            lessonTitle
            slideDeck: slidedeck
            starterQuizAnswers
            starterQuiz: starter_quiz
            supplementaryResource
            video: videos
            worksheet
            worksheetAnswers
          }
        }`;

      const downloadsViewResult: DownloadView = await client.request(
        downloadsQuery,
        { lessonSlugs: lessonsAllowed },
      );

      const downloads = downloadsViewResult[downloadView];

      const tpcQuery = gql`
        query GetTPC($lessonSlugs: [String!]!) {
          ${lessonView}(
            where: {
              lessonSlug: { _in: $lessonSlugs }
            }
          ) {
            lessonSlug
            tpcWorks
            tpcMedia
          }
        }
      `;

      const tpcViewResult: LessonView = await client.request(tpcQuery, {
        lessonSlugs: downloads.map((d) => d.lessonSlug),
      });

      const tpc = tpcViewResult[lessonView];

      const result = downloads.map((d) => {
        const lessonSlug = d.lessonSlug;

        const attribution = tpc.find((l) => l.lessonSlug === lessonSlug);
        let mappedAttribution: string[] = [];

        if (attribution) {
          mappedAttribution = getAttribution(attribution);
        }

        return {
          lessonSlug,
          lessonTitle: d.lessonTitle,
          attribution: mappedAttribution.length ? mappedAttribution : undefined,
          assets: assetDownloads(lessonSlug, d, type),
        };
      });

      return result;
    }),
  // getUnitAssets: protectedProcedure
  //   .meta({
  //     openapi: {
  //       method: 'GET',
  //       tags: ['assets'],
  //       path: '/units/{unit}/assets',
  //       description:
  //         'This endpoint returns signed download URLs and types for the assets currently available on Oak for a given unit',
  //       example: {
  //         request: {
  //           sequence: 'perimeter-and-area',
  //         },
  //       },
  //     },
  //   })
  //   .input(z.object({ unit: z.string() }))
  //   .output(z.any()) // lessonsAssetsType
  //   .query(async ({ input }) => {
  //     const { unit } = input;
  //     return { unit };
  //   }),
  getSubjectAssets: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        tags: ['assets'],
        errorResponses,
        summary: 'Downloadable assets by key stage and subject',
        path: '/key-stages/{keyStage}/subject/{subject}/assets',
        description: `Use when you want every downloadable asset for a key stage + subject, without programme structure or unit sequence order, optionally scoped to a unit or asset type. Returns assets grouped by lesson, each with signed download URLs, asset type, lesson title and slug, and attribution. Pass unit to restrict to one unit and type to restrict to one asset type (one of: slideDeck, starterQuiz, starterQuizAnswers, exitQuiz, exitQuizAnswers, worksheet, worksheetAnswers, supplementaryResource, video). Lesson content is under OGL v3.0; assets are either Oak-owned or third-party under an OGL-compatible licence. Attribution required — see https://open-api.thenational.academy/docs/about-oaks-api/terms.

Not for: assets across a sequence (GET /sequences/{sequence}/assets); assets in one programme (GET /programmes/{programme}/assets); a single lesson's downloads (GET /lessons/{lesson}/assets); streaming one file (GET /lessons/{lesson}/assets/{type}).`,
      },
    })
    .input(subjectAssetsRequestSchema)
    .output(subjectAssetsResponseSchema)
    .query(async ({ input, ctx }) => {
      const keyStage = input.keyStage;
      const subject = input.subject;
      const unit = input.unit || null;
      const offset = input.offset;
      const limit = input.limit;
      const typeFilter = input.type;
      const client = getClient();

      let unitFilter = '';
      let unitArg = '';

      if (unit) {
        unitFilter = 'unit_slug: { _eq: $unit }';
        unitArg = ', $unit: String!';
      }

      // step 1: find the slugs that match
      const lessonQuery = gql`
        query GetLessons($_contains: jsonb${unitArg}) {
          ${unitVariantLessonsView} (
            where: {
              is_legacy: { _eq: false }
              programme_fields: { _contains: $_contains }
              ${unitFilter}
            }
          ) {
            unit_slug
            lesson_slug
          }
        }
      `;

      interface LessonQueryVariables {
        _contains: {
          keystage_slug: string;
          subject_slug?: string;
          subject_parent?: string;
        };
        unit?: string;
        [key: string]: unknown;
      }

      const lessonQueryVariables: LessonQueryVariables = {
        _contains: {
          keystage_slug: keyStage,
          subject_slug: subject,
        },
      };

      if (keyStage === 'ks4' && subject === 'science') {
        delete lessonQueryVariables._contains.subject_slug;
        lessonQueryVariables._contains.subject_parent = 'Science';
      }

      if (unit) {
        lessonQueryVariables.unit = unit;
      }

      const lessonViewResult: UnitVariantLessonsView = await client.request(
        lessonQuery,
        lessonQueryVariables,
      );

      const res = lessonViewResult[unitVariantLessonsView];

      const allLessonSlugs = [...new Set(res.map((l) => l.lesson_slug))];
      const lessonSlugs = allLessonSlugs.slice(offset, offset + limit);

      if (lessonSlugs.length === 0) {
        return [];
      }

      if (offset + limit < allLessonSlugs.length) {
        ctx.resHeaders.set(
          'link',
          `<${nextPageLink(ctx.req.url, offset, limit, unit ? { unit } : undefined)}>; rel="next"`,
        );
      }

      const restrictions = await getLessonsRestrictions(client, lessonSlugs);
      const lessonsAllowed = lessonSlugs.filter((slug) => !restrictions[slug]);

      if (lessonsAllowed.length === 0) {
        return [];
      }

      const downloadsQuery = gql`
        query GetDownloads($lessonSlugs: [String!]!) {
          ${downloadView}(
            where: {
              lessonSlug: { _in: $lessonSlugs }
            }
          ) {
            lessonSlug
            lessonTitle
            exitQuiz
            exitQuizAnswers
            lessonSlug
            lessonTitle
            slideDeck: slidedeck
            starterQuizAnswers
            starterQuiz: starter_quiz
            supplementaryResource
            video: videos
            worksheet
            worksheetAnswers
          }
        }
      `;

      const downloadsViewResult: DownloadView = await client.request(
        downloadsQuery,
        {
          lessonSlugs: lessonsAllowed,
        },
      );

      const downloads = downloadsViewResult[downloadView];

      if (!downloads || downloads.length === 0 || !downloads[0]) {
        return [];
      }

      const tpcQuery = gql`
        query GetTPC($lessonSlugs: [String!]!) {
          ${lessonView}(
            where: {
              lessonSlug: { _in: $lessonSlugs }
            }
          ) {
            lessonSlug
            tpcWorks
            tpcMedia
          }
        }
      `;

      const tpcViewResult: LessonView = await client.request(tpcQuery, {
        lessonSlugs: lessonsAllowed,
      });

      const tpc = tpcViewResult[lessonView];

      const result = downloads.map((d) => {
        const lessonSlug = d.lessonSlug;

        const attribution = tpc.find((l) => l.lessonSlug === lessonSlug);
        let mappedAttribution: string[] = [];

        if (attribution) {
          mappedAttribution = getAttribution(attribution);
        }

        return {
          lessonSlug,
          lessonTitle: d.lessonTitle,
          attribution: mappedAttribution.length ? mappedAttribution : undefined,
          assets: assetDownloads(lessonSlug, d, typeFilter),
        };
      });

      return result;
    }),
  getLessonAssets: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        tags: ['assets', 'lessons'],
        summary: 'Downloadable assets for a lesson',
        path: '/lessons/{lesson}/assets',
        errorResponses,
        description: `Use when you have a lesson slug and need the list of what's downloadable. Returns every available asset type with a signed download URL per asset and attribution. The 9 type values are: slideDeck, starterQuiz, starterQuizAnswers, exitQuiz, exitQuizAnswers, worksheet, worksheetAnswers, supplementaryResource, video. Pass type to return only one. Lesson content is under OGL v3.0; assets are either Oak-owned or third-party under an OGL-compatible licence. Attribution required — see https://open-api.thenational.academy/docs/about-oaks-api/terms.

Not for: streaming the file itself (GET /lessons/{lesson}/assets/{type}); bulk asset retrieval across a key stage + subject (GET /key-stages/{keyStage}/subject/{subject}/assets), a sequence (GET /sequences/{sequence}/assets), or one programme (GET /programmes/{programme}/assets); lesson metadata (GET /lessons/{lesson}/summary).`,
      },
    })
    .input(lessonAssetsRequestSchema)
    .output(lessonAssetsResponseSchema)
    .query(async ({ input }) => {
      const { lesson: lessonSlug, type } = input;

      const { assets, attribution } = await assetsForLesson(lessonSlug);

      return {
        oakUrl: getOakUrlForLesson(lessonSlug),
        attribution,
        assets: assetDownloads(lessonSlug, assets, type),
      } as LessonAssetsType;
    }),
  getProgrammeAssets: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        tags: ['assets', 'programmes'],
        errorResponses,
        summary: 'Downloadable assets in a programme',
        path: '/programmes/{programme}/assets',
        description: `Use when you need every downloadable asset for a single programme (year group) within a subject. Returns assets grouped by lesson with signed download URLs, asset type, lesson title and slug, and attribution. Supports offset/limit pagination; Link: rel="next" header signals more pages. Optionally narrow by asset type (one of: slideDeck, starterQuiz, starterQuizAnswers, exitQuiz, exitQuizAnswers, worksheet, worksheetAnswers, supplementaryResource, video). Lesson content is under OGL v3.0; assets are either Oak-owned or third-party under an OGL-compatible licence. Attribution required — see https://open-api.thenational.academy/docs/about-oaks-api/terms.

Not for: assets across a whole sequence (GET /sequences/{sequence}/assets); assets for a key stage + subject without programme structure (GET /key-stages/{keyStage}/subject/{subject}/assets); a single lesson's downloads (GET /lessons/{lesson}/assets); streaming one file (GET /lessons/{lesson}/assets/{type}).`,
      },
    })
    .input(programmeAssetsRequestSchema)
    .output(programmeAssetsResponseSchema)
    .query(async ({ input, ctx }) => {
      const { programme, offset, limit } = input;
      const typeFilter = input.type;
      const client = getClient();

      // Step 1: get lesson slugs for this programme
      const lessonQuery = gql`
        query ($programme: String!) {
          ${unitVariantLessonsView}(
            where: {
              programme_slug: { _eq: $programme }
              is_legacy: { _eq: false }
            }
          ) {
            unit_slug
            lesson_slug
            subject_slug: programme_fields(path: "subject_slug")
          }
        }
      `;

      const lessonViewResult: UnitVariantLessonsView = await client.request(
        lessonQuery,
        { programme },
      );
      const rows = lessonViewResult[unitVariantLessonsView];

      if (rows.length === 0) {
        return [];
      }

      // validate the subject
      if (!subjectSlugs.includes(rows[0].subject_slug)) {
        throw new TRPCError({
          message: 'Programme not found',
          code: 'NOT_FOUND',
        });
      }

      // Deduplicate lesson slugs and apply pagination before fetching downloads.
      const uniqueSlugs = [...new Set(rows.map((l) => l.lesson_slug))];
      const lessonSlugs = uniqueSlugs.slice(offset, offset + limit);

      if (lessonSlugs.length === 0) {
        return [];
      }

      if (lessonSlugs.length === limit) {
        ctx.resHeaders.set(
          'link',
          `<${nextPageLink(ctx.req.url, offset, limit)}>; rel="next"`,
        );
      }

      // Step 2: fetch downloads
      const restrictions = await getLessonsRestrictions(client, lessonSlugs);
      const lessonsAllowed = lessonSlugs.filter((slug) => !restrictions[slug]);

      if (lessonsAllowed.length === 0) {
        return [];
      }

      const downloadsQuery = gql`
        query GetDownloads($lessonSlugs: [String!]!) {
          ${downloadView}(
            where: {
              lessonSlug: { _in: $lessonSlugs }
            }
          ) {
            lessonSlug
            lessonTitle
            exitQuiz
            exitQuizAnswers
            slideDeck: slidedeck
            starterQuizAnswers
            starterQuiz: starter_quiz
            supplementaryResource
            video: videos
            worksheet
            worksheetAnswers
          }
        }
      `;

      const downloadsViewResult: DownloadView = await client.request(
        downloadsQuery,
        { lessonSlugs: lessonsAllowed },
      );
      const downloads = downloadsViewResult[downloadView];

      if (!downloads || downloads.length === 0) {
        return [];
      }

      // Step 3: fetch TPC for attribution
      const tpcQuery = gql`
        query GetTPC($lessonSlugs: [String!]!) {
          ${lessonView}(
            where: {
              lessonSlug: { _in: $lessonSlugs }
            }
          ) {
            lessonSlug
            tpcWorks
            tpcMedia
          }
        }
      `;

      const tpcViewResult: LessonView = await client.request(tpcQuery, {
        lessonSlugs: lessonsAllowed,
      });
      const tpc = tpcViewResult[lessonView];

      return downloads.map((d) => {
        const lessonSlug = d.lessonSlug;
        const attribution = tpc.find((l) => l.lessonSlug === lessonSlug);
        let mappedAttribution: string[] = [];
        if (attribution) {
          mappedAttribution = getAttribution(attribution);
        }
        return {
          lessonSlug,
          lessonTitle: d.lessonTitle,
          attribution: mappedAttribution.length ? mappedAttribution : undefined,
          assets: assetDownloads(lessonSlug, d, typeFilter),
        };
      });
    }),
  getLessonAsset: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        tags: ['assets', 'lessons'],
        path: '/lessons/{lesson}/assets/{type}',
        summary: 'Download a lesson asset file',
        description: `Use when you want to download one specific asset for a lesson — slide deck, worksheet, etc. Responds with a 302 redirect: follow the \`Location\` header to fetch the file. Videos redirect to a CDN; every other asset type redirects to a signed storage URL that is valid for 15 minutes, so start the download promptly rather than storing the URL. Call GET /lessons/{lesson}/assets first to see which type values are available. Valid type values: slideDeck, starterQuiz, starterQuizAnswers, exitQuiz, exitQuizAnswers, worksheet, worksheetAnswers, supplementaryResource, video. Lesson content is under OGL v3.0; assets are either Oak-owned or third-party under an OGL-compatible licence. Attribution required — see https://open-api.thenational.academy/docs/about-oaks-api/terms.

Not for: listing which asset types a lesson has (GET /lessons/{lesson}/assets); fetching the transcript (GET /lessons/{lesson}/transcript).`,
        errorResponses,
      },
    })
    .input(lessonAssetRequestSchema)
    .output(lessonAssetResponseSchema) // no output, the request is redirected to the file
    .query(() => {
      // IMPORTANT - this endpoint redirects to the file (video, slides,
      // etc), but the actual execution isn't
      // done here, but in the handler at:
      // /src/app/api/v0/lessons/[lesson]/assets/[type]/route.ts
      //
      // this specific endpoint still exists to allow all the openapi
      // metadata to be generated correctly.
      return undefined;
    }),
});
