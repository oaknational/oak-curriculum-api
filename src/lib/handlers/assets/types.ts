import * as z from 'zod/v4';
import type { ApiMajor } from '@/lib/apiVersion';
import { API_MAJORS } from '@/lib/apiVersion';
import { oakUrlSchema } from '@/lib/handlers/commonTypes';

export const typeToMime = new Map([
  ['pdf', 'application/pdf'],
  [
    'pptx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],

  ['odp', 'application/vnd.oasis.opendocument.presentation'],
]);

export const downloadTypeEnum = z
  .enum([
    'slideDeck',
    'exitQuiz',
    'exitQuizAnswers',
    'starterQuiz', // note: graphql key is (currently) starter_quiz
    'starterQuizAnswers',
    'supplementaryResource',
    'video',
    'worksheet',
    'worksheetAnswers',
    'lessonGuide', // from /api/v1 only, see assetTypeAddedIn
  ])
  .describe(
    'Use this type and the lesson slug in conjunction to get a signed download URL to the asset type from the /api/lessons/{slug}/assets/{type} endpoint',
  )
  .meta({ example: 'slideDeck' });

export const assetType = z.object({
  type: downloadTypeEnum,
  label: z.string().meta({ description: 'The label for the asset' }),
  url: z.string().meta({ description: 'The download endpoint for the asset.' }),
});

export const lessonAssetsType = z.object({
  oakUrl: oakUrlSchema,
  attribution: z.array(z.string()).optional().meta({
    description:
      "Licence information for any third-party content contained in the lessons' downloadable resources",
  }),
  assets: z.array(assetType).optional().meta({ description: 'List of assets' }),
});

export type LessonAssetsType = z.infer<typeof lessonAssetsType>;

export const lessonsAssetsType = z.array(
  z.object({
    lessonSlug: z.string().meta({
      description: 'The unique slug identifier for the lesson',
    }),
    lessonTitle: z.string().meta({ description: 'The title for the lesson' }),
    attribution: z.array(z.string()).optional().meta({
      description:
        "Licence information for any third-party content contained in the lessons' downloadable resources",
    }),
    assets: z.array(assetType).meta({ description: 'List of assets' }),
  }),
);

export type DownloadTypeEnum = z.infer<typeof downloadTypeEnum>;

/**
 * Asset types added after `/api/v0` froze, and the major each arrived in.
 *
 * The type enum is shared by every major, so it names these everywhere. An
 * earlier major never lists or serves them, rejects them as a `type` filter,
 * and has them taken back out of its OpenAPI document.
 */
const assetTypeAddedIn: Partial<Record<DownloadTypeEnum, ApiMajor>> = {
  lessonGuide: 'v1',
};

/** Whether an asset type is served at a major. */
export function isAssetTypeServed(
  type: DownloadTypeEnum,
  major: ApiMajor,
): boolean {
  const addedIn = assetTypeAddedIn[type];

  return !addedIn || API_MAJORS.indexOf(major) >= API_MAJORS.indexOf(addedIn);
}
