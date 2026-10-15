import { gql, type GraphQLClient } from 'graphql-request';
import { type LessonView, lessonView } from './owaClient';

/**
 * Get a lookup of lesson slugs to their corresponding subject slugs.
 */
export async function getLessonSubjectSlugs(
  client: GraphQLClient,
  lessonSlugs: string[],
): Promise<Map<string, string>> {
  const query = gql`
  query ($slugs: [String!]!) @cached(ttl: 300) {
    ${lessonView}(
      where: { lessonSlug: { _in: $slugs }, isLegacy: { _eq: false } }
      distinct_on: lessonSlug
    ) {
      lessonSlug
      subjectSlug
    }
  }
  `;

  const res: LessonView = await client.request(query, { slugs: lessonSlugs });

  const subjectSlugsByLesson = new Map<string, string>();

  for (const lesson of res[lessonView] ?? []) {
    if (lesson.lessonSlug && lesson.subjectSlug) {
      subjectSlugsByLesson.set(lesson.lessonSlug, lesson.subjectSlug);
    }
  }

  return subjectSlugsByLesson;
}
