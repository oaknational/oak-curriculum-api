import { gql } from 'graphql-request';
import type { GraphQLClient } from 'graphql-request';
import {
  LessonRestrictionLevel,
  type LessonRestrictionView,
  lessonRestrictionView,
} from './owaClient';
import { subjectSlugs } from './keyStageAndSubjects';

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

  constructor(blocked: boolean, reason = '') {
    this.blocked = blocked;
    this.reason = reason;
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

export const blockedSubjects = ['financial-education'];

export function isSubjectAllowed(subject: string): boolean {
  const allowed = [...subjectSlugs, 'combined-science'];
  return allowed.includes(subject);
}

export async function getLessonsRestrictions(
  client: GraphQLClient,
  lessonSlugs: string[],
): Promise<Record<string, boolean>> {
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
    }
  }
  `;

  const res: LessonRestrictionView = await client.request(query, {
    slugs: lessonSlugs,
  });

  const result: Record<string, boolean> = {};

  for (const lesson of res[lessonRestrictionView]) {
    result[lesson.slug] = isRestricted(
      highestRestrictionLevel([
        lesson.tpc_downloadablefiles_max_restriction,
        lesson.tpc_media_max_restriction,
        lesson.tpc_quizimages_max_restriction,
        lesson.tpc_works_max_restriction,
      ]),
    );
  }

  return result;
}

export async function isLessonRestricted(
  client: GraphQLClient,
  lessonSlug: string,
): Promise<GateWithReason> {
  const query = gql`
  query ($slug: String!) {
    ${lessonRestrictionView}(
      where: { _state:{_eq:"published"}, slug: { _eq: $slug } }
    ) {
      tpc_downloadablefiles_max_restriction
      tpc_media_max_restriction
      tpc_quizimages_max_restriction
      tpc_works_max_restriction
    }
  }
  `;

  const res: LessonRestrictionView = await client.request(query, {
    slug: lessonSlug,
  });

  if (!res[lessonRestrictionView].length) {
    return new GateWithReason(false, 'Lesson not in restrictions');
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
  );
}
