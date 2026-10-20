import { gql } from 'graphql-request';
import type { GraphQLClient } from 'graphql-request';
import {
  LessonRestrictionLevel,
  type LessonRestrictionView,
  lessonRestrictionView,
} from './owaClient';
import { getLessonSubjectSlugs } from './lessonSubjects';
import { subjectSlugs } from './keyStageAndSubjects';
import { childSubjects } from './oakConsts';
import {
  type GatedAssetType,
  allGatedAssetTypes,
  getAssetRestrictionsForLessons,
  getLayerRestrictedAssetTypes,
  restrictsAssetType,
  restrictsEveryDownload,
} from './queryGateData/assetTypeRestrictions';

const commonError =
  'Learn more about Oak errors: https://open-api.thenational.academy/docs/about-oaks-api/errors';

export const collapsedRestrictionStatuses = [
  'ogl-compatible',
  'restricted',
] as const;

export type CollapsedRestrictionStatus =
  (typeof collapsedRestrictionStatuses)[number];

// Custom result class that requires explicit narrowing via type guards
class GateWithReason {
  readonly blocked: boolean;
  readonly reason: string;
  /**
   * The asset types withheld from a lesson the gate allows, for callers that
   * list a lesson's assets rather than serve one.
   */
  readonly withheldAssetTypes: GatedAssetType[];
  /**
   * The lesson belongs to a subject this API does not serve. It counts as
   * blocked too, so a caller that asks only `isBlocked` still withholds it,
   * while a caller that can tell the difference answers "not found" rather
   * than reporting a restriction.
   */
  readonly notFound: boolean;

  constructor(
    blocked: boolean,
    reason = '',
    withheldAssetTypes: GatedAssetType[] = [],
    notFound = false,
  ) {
    this.blocked = blocked;
    this.reason = reason;
    this.withheldAssetTypes = withheldAssetTypes;
    this.notFound = notFound;
  }

  /** The gate's answer for a lesson of a subject this API does not serve. */
  static unsupportedSubject(lessonSlug: string): GateWithReason {
    return new GateWithReason(
      true,
      `Lesson not found: "${lessonSlug}"`,
      [],
      true,
    );
  }

  toString() {
    return this.reason || String(this.blocked);
  }

  isAllowed(): this is GateWithReason & { blocked: false } {
    return this.blocked === false;
  }

  isBlocked(): this is GateWithReason & { blocked: true } {
    return this.blocked === true;
  }

  isNotFound(): this is GateWithReason & { notFound: true } {
    return this.notFound === true;
  }
}

export function isRestricted(
  restriction: LessonRestrictionLevel | undefined,
): boolean {
  return (
    restriction === LessonRestrictionLevel.RESTRICTED ||
    restriction === LessonRestrictionLevel.HIGHLY_RESTRICTED
  );
}

export function highestRestrictionLevel(
  restrictions: (LessonRestrictionLevel | null | undefined)[],
): LessonRestrictionLevel {
  return (
    [
      LessonRestrictionLevel.HIGHLY_RESTRICTED,
      LessonRestrictionLevel.RESTRICTED,
      LessonRestrictionLevel.OGL_COMPATIBLE,
      LessonRestrictionLevel.OGL_EQUIVALENT,
    ].find((level) => restrictions.includes(level)) ??
    LessonRestrictionLevel.OGL_COMPATIBLE
  );
}

export function collapsedRestrictionStatus(
  restriction: LessonRestrictionLevel,
): CollapsedRestrictionStatus {
  switch (restriction) {
    case LessonRestrictionLevel.RESTRICTED:
    case LessonRestrictionLevel.HIGHLY_RESTRICTED:
      return 'restricted';
    default:
      return 'ogl-compatible';
  }
}

export function isSubjectAllowed(subject: string): boolean {
  const allowed = [...subjectSlugs, ...childSubjects];
  return allowed.includes(subject);
}

/**
 * Takes a map of subject to lesson slugs and returns the set of lessons whose
 * subject this API does not support (such as financial education)
 */
function unsupportedSubjectLessons(
  subjectsByLesson: Map<string, string>,
): Set<string> {
  const unsupported = new Set<string>();

  for (const [lessonSlug, subjectSlug] of subjectsByLesson) {
    if (!isSubjectAllowed(subjectSlug)) {
      unsupported.add(lessonSlug);
    }
  }

  return unsupported;
}

/**
 * The restriction status of each of the given lessons from its own restriction
 * levels alone, with the layer over them left out, and the lessons the view
 * flags as having a copyright conflict. Lessons with no published row in the
 * restriction view are left out of both.
 *
 * The conflict flag rides along on this query so that every caller of the gate
 * gets it en masse, without a request of its own.
 */
async function restrictionStatusesFromLevels(
  client: GraphQLClient,
  lessonSlugs: string[],
): Promise<{
  statuses: Record<string, CollapsedRestrictionStatus>;
  copyrightConflicts: Set<string>;
}> {
  const query = gql`
  query ($slugs: [String!]!) @cached(ttl: 300) {
    ${lessonRestrictionView}(
      where: { _state:{_eq:"published"}, slug: { _in: $slugs } }
    ) {
      slug
      tpc_downloadablefiles_max_restriction
      tpc_media_max_restriction
      tpc_quizimages_max_restriction
      tpc_works_max_restriction
      features
    }
  }
  `;

  const restrictions: LessonRestrictionView = await client.request(query, {
    slugs: lessonSlugs,
  });

  const statuses: Record<string, CollapsedRestrictionStatus> = {};
  const copyrightConflicts = new Set<string>();

  for (const lesson of restrictions[lessonRestrictionView]) {
    statuses[lesson.slug] = collapsedRestrictionStatus(
      highestRestrictionLevel([
        lesson.tpc_downloadablefiles_max_restriction,
        lesson.tpc_media_max_restriction,
        lesson.tpc_quizimages_max_restriction,
        lesson.tpc_works_max_restriction,
      ]),
    );

    if (lesson.features?.has_copyright_conflict === true) {
      copyrightConflicts.add(lesson.slug);
    }
  }

  return { statuses, copyrightConflicts };
}

/**
 * The gate's bulk answer before anything is hidden: each lesson's restriction
 * status, from its own restriction levels and the layer over them, and the
 * lessons whose subject this API does not serve.
 *
 * Lessons with no published row in the restriction view are left out, unless
 * the layer restricts them.
 */
async function restrictionStatusesWithUnsupported(
  client: GraphQLClient,
  lessonSlugs: string[],
  assetType?: GatedAssetType,
): Promise<{
  statuses: Record<string, CollapsedRestrictionStatus>;
  unsupportedLessons: Set<string>;
}> {
  const { statuses, copyrightConflicts } = await restrictionStatusesFromLevels(
    client,
    lessonSlugs,
  );

  const subjectsByLesson = await getLessonSubjectSlugs(client, lessonSlugs);

  const layerRestrictions = getAssetRestrictionsForLessons(
    subjectsByLesson,
    lessonSlugs,
    assetType,
  );

  // the layer only ever restricts further, and it stands on its own: a lesson
  // it restricts stays restricted even with no row in the restriction view
  for (const [slug, status] of layerRestrictions) {
    if (status === 'restricted') {
      statuses[slug] = status;
    }
  }

  // a copyright conflict restricts every asset type, so it restricts whatever
  // asset type was asked about
  for (const slug of copyrightConflicts) {
    statuses[slug] = 'restricted';
  }

  return {
    statuses,
    unsupportedLessons: unsupportedSubjectLessons(subjectsByLesson),
  };
}

/**
 * The restriction status of each of the given lessons. The single source of
 * truth for the gate's bulk answer: the asset endpoints read it as a boolean
 * through `getLessonsRestrictions`, and the check-restricted endpoints return
 * it.
 */
export async function getLessonsRestrictionStatuses(
  client: GraphQLClient,
  lessonSlugs: string[],
  assetType?: GatedAssetType,
): Promise<Record<string, CollapsedRestrictionStatus>> {
  const { statuses, unsupportedLessons } =
    await restrictionStatusesWithUnsupported(client, lessonSlugs, assetType);

  const result: Record<string, CollapsedRestrictionStatus> = {};

  // a lesson of a subject this API does not serve is left out altogether: the
  // answer a caller gets for it is the one it gets for a slug that is not there
  for (const [slug, status] of Object.entries(statuses)) {
    if (!unsupportedLessons.has(slug)) {
      result[slug] = status;
    }
  }

  return result;
}

export async function getLessonsRestrictions(
  client: GraphQLClient,
  lessonSlugs: string[],
  assetType?: GatedAssetType,
): Promise<Record<string, boolean>> {
  const { statuses, unsupportedLessons } =
    await restrictionStatusesWithUnsupported(client, lessonSlugs, assetType);

  const result: Record<string, boolean> = {};

  for (const [slug, status] of Object.entries(statuses)) {
    result[slug] = status === 'restricted';
  }

  // this sort of doesn't make sense, because really we shouldn't even have
  // unsupported lessons getting this far into the code, i.e. this is saying
  // that a financial lesson is restricted, even though it's actually a 404.
  // but it's because the lessons aren't blocked at the database, and still
  // get surfaced to the API.
  for (const slug of unsupportedLessons) {
    result[slug] = true;
  }

  return result;
}

export async function isLessonRestricted(
  client: GraphQLClient,
  lessonSlug: string,
  assetType?: GatedAssetType,
  /**
   * With no asset type, `listing` asks the question a listing asks — is
   * anything left to list? — rather than "is any of it restricted?".
   * The types to withhold from the listing come back on the result.
   */
  { listing = false }: { listing?: boolean } = {},
): Promise<GateWithReason> {
  const subjectsByLesson = await getLessonSubjectSlugs(client, [lessonSlug]);

  // if the lesson belongs to a subject that this API does not serve, it is consider it a 404
  // examples of this is financial-education
  if (unsupportedSubjectLessons(subjectsByLesson).has(lessonSlug)) {
    return GateWithReason.unsupportedSubject(lessonSlug);
  }

  const layerRestrictedTypes =
    getLayerRestrictedAssetTypes(subjectsByLesson, [lessonSlug]).get(
      lessonSlug,
    ) ?? [];

  const restrictedByLayer =
    listing && !assetType
      ? restrictsEveryDownload(layerRestrictedTypes)
      : restrictsAssetType(layerRestrictedTypes, assetType);

  if (restrictedByLayer) {
    // This error is apparently intentionally vague. See git blame for info
    return new GateWithReason(true, 'This is not currently available.');
  }

  const query = gql`
  query ($slug: String!) {
    ${lessonRestrictionView}(
      where: { _state:{_eq:"published"}, slug: { _eq: $slug } }
    ) {
      tpc_downloadablefiles_max_restriction
      tpc_media_max_restriction
      tpc_quizimages_max_restriction
      tpc_works_max_restriction
      features
    }
  }
  `;

  const res: LessonRestrictionView = await client.request(query, {
    slug: lessonSlug,
  });

  // a copyright conflict is the same kind of block as a restricted subject: it
  // restricts every asset type, so it answers with the same vague reason
  if (
    res[lessonRestrictionView].some(
      (restriction) => restriction.features?.has_copyright_conflict === true,
    )
  ) {
    return new GateWithReason(true, 'This is not currently available.');
  }

  if (!res[lessonRestrictionView].length) {
    return new GateWithReason(
      false,
      'Lesson not in restrictions',
      layerRestrictedTypes,
    );
  }

  const restriction = res[lessonRestrictionView][0];

  const isAnyRestricted = isRestricted(
    highestRestrictionLevel([
      restriction.tpc_downloadablefiles_max_restriction,
      restriction.tpc_media_max_restriction,
      restriction.tpc_quizimages_max_restriction,
      restriction.tpc_works_max_restriction,
    ]),
  );

  return new GateWithReason(
    isAnyRestricted,
    isAnyRestricted
      ? 'Lesson contains restricted content and therefore blocked. ' +
          commonError
      : 'Lesson does not contain restricted content',
    layerRestrictedTypes,
  );
}

/**
 * The gate's answer for an asset listing: the lessons that may be listed, and
 * the asset types each of those must still withhold.
 *
 * A lesson of a partially restricted subject keeps its place in the listing and
 * loses only the asset types the layer restricts. A lesson left with nothing
 * downloadable, like one of a wholly restricted subject, is dropped.
 */
export async function getLessonsListingGate(
  client: GraphQLClient,
  lessonSlugs: string[],
  assetType?: GatedAssetType,
): Promise<{
  lessonsAllowed: string[];
  withheldAssetTypes: Map<string, GatedAssetType[]>;
}> {
  const { statuses: levelStatuses, copyrightConflicts } =
    await restrictionStatusesFromLevels(client, lessonSlugs);

  const subjectsByLesson = await getLessonSubjectSlugs(client, lessonSlugs);
  const unsupportedSubjects = unsupportedSubjectLessons(subjectsByLesson);

  const withheldAssetTypes = getLayerRestrictedAssetTypes(
    subjectsByLesson,
    lessonSlugs,
  );

  // a copyright conflict withholds every asset type, which leaves a listing
  // nothing to show and so drops the lesson in the filter below
  for (const slug of copyrightConflicts) {
    withheldAssetTypes.set(slug, allGatedAssetTypes);
  }

  const lessonsAllowed = lessonSlugs.filter((slug) => {
    if (unsupportedSubjects.has(slug) || levelStatuses[slug] === 'restricted') {
      return false;
    }

    const withheld = withheldAssetTypes.get(slug);

    return assetType
      ? !restrictsAssetType(withheld, assetType)
      : !restrictsEveryDownload(withheld);
  });

  return { lessonsAllowed, withheldAssetTypes };
}
