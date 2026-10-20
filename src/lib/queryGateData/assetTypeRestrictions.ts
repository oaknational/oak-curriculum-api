/**
 * A hand-maintained layer over the third-party content (TPC) gate, restricting
 * more than the restriction levels in `lessonRestrictionView` do on their own:
 * `restrictedSubjectsMap`, the subjects restricted across some or all of the
 * asset types.
 *
 * A caller with no asset type to give means "any restriction at all applies",
 * so a partially restricted subject counts as restricted. The asset listings
 * are the exception: they keep the lesson and withhold the restricted types,
 * through `getLayerRestrictedAssetTypes`.
 *
 * Restrictions on an *individual* lesson are no longer kept here. They come
 * from the `features.has_copyright_conflict` flag on the lesson's row in
 * `lessonRestrictionView`, which restricts every asset type; it arrives with
 * the restriction levels, so `queryGate` merges it in beside this layer rather
 * than here. This module never queries anything.
 */
import z from 'zod';
import { downloadTypeEnum } from '@/lib/handlers/assets/types';
import type { CollapsedRestrictionStatus } from '@/lib/queryGate';

/**
 * The asset types the gate can be asked about: anything downloadable, plus the
 * transcript and the quiz, which are served by endpoints of their own.
 */
const gatedAssetTypes = z.enum([
  ...downloadTypeEnum.options,
  'transcript',
  'quiz',
]);
export type GatedAssetType = z.infer<typeof gatedAssetTypes>;

/** Every asset type the gate knows about: what a copyright conflict restricts. */
export const allGatedAssetTypes: GatedAssetType[] = gatedAssetTypes.options;

/**
 * Subjects where third-party content is restricted across a whole asset type,
 * irrespective of an individual lesson's restriction levels.
 */
const restrictedSubjectsMap = new Map<string, GatedAssetType[]>([
  ['art', gatedAssetTypes.options],
  ['music', gatedAssetTypes.options],
  ['religious-education', gatedAssetTypes.options],
  ['geography', gatedAssetTypes.options],
  ['french', gatedAssetTypes.options],
  ['german', gatedAssetTypes.options],
  ['spanish', gatedAssetTypes.options],
  ['english', gatedAssetTypes.extract(['video', 'transcript']).options],
]);

/**
 * The asset types this layer restricts for each of the given lessons, read
 * from the subjects the gate has already resolved. A lesson the layer says
 * nothing about is left out of the map.
 */
export function getLayerRestrictedAssetTypes(
  subjectsByLesson: Map<string, string>,
  lessonSlugs: string[],
): Map<string, GatedAssetType[]> {
  const res = new Map<string, GatedAssetType[]>();

  for (const lessonSlug of lessonSlugs) {
    const subject = subjectsByLesson.get(lessonSlug);
    const restrictions = subject
      ? restrictedSubjectsMap.get(subject)
      : undefined;

    if (restrictions?.length) {
      res.set(lessonSlug, restrictions);
    }
  }

  return res;
}

/**
 * Whether the layer's restricted types for a lesson cover the asset type being
 * asked about. With no asset type to go on, any restriction at all counts —
 * the callers that can be more precise ask for the types themselves.
 */
export function restrictsAssetType(
  restrictedTypes: GatedAssetType[] | undefined,
  assetType?: GatedAssetType,
): boolean {
  if (!restrictedTypes?.length) {
    return false;
  }

  return assetType ? restrictedTypes.includes(assetType) : true;
}

/** Whether every downloadable asset type of a lesson is restricted. */
export function restrictsEveryDownload(
  restrictedTypes: GatedAssetType[] | undefined,
): boolean {
  return downloadTypeEnum.options.every((type) =>
    restrictedTypes?.includes(type),
  );
}

export function getAssetRestrictionsForLessons(
  subjectsByLesson: Map<string, string>,
  lessonSlugs: string[],
  assetType?: GatedAssetType,
): Map<string, CollapsedRestrictionStatus> {
  const restrictedTypes = getLayerRestrictedAssetTypes(
    subjectsByLesson,
    lessonSlugs,
  );

  return new Map(
    lessonSlugs.map((lessonSlug) => [
      lessonSlug,
      restrictsAssetType(restrictedTypes.get(lessonSlug), assetType)
        ? 'restricted'
        : 'ogl-compatible',
    ]),
  );
}
