import { prisma } from '@/lib/db';
import { v0Procedure } from '@/lib/protect';
import { router } from '@/lib/trpc';
import {
  searchTranscriptRequestSchema,
  searchTranscriptResponseSchema,
} from './schemas';
import { errorResponses } from '@/lib/errorResponses';
import { getClient } from '@/lib/owaClient';
import { getLessonsRestrictions } from '@/lib/queryGate';

/** The number of lessons the endpoint documents that it returns. */
const resultLimit = 5;

export const searchTranscripts = router({
  searchTranscripts: v0Procedure
    .meta({
      openapi: {
        method: 'GET',
        tags: ['search'],
        path: '/search/transcripts',
        summary: 'Lesson search by video transcript',
        errorResponses,
        description: `Use when you want to search the spoken content of lesson videos. Returns up to 5 lessons whose transcripts contain similar text, each with a transcript snippet showing the match. No filters; searches every published transcript.

Not for: terms in the lesson title (GET /search/lessons); metadata for a known lesson (GET /lessons/{lesson}/summary); a transcript by slug (GET /lessons/{lesson}/transcript).

Example queries: the mitochondria are the powerhouse, to be or not to be, carry the one.`,
      },
    })
    .input(searchTranscriptRequestSchema)
    .output(searchTranscriptResponseSchema)
    .query(async ({ input }) => {
      const { q } = input;

      interface SearchRow {
        lesson_id: string;
        source_content: string;
      }

      // console.time('snippet search');

      // over-fetch, because the restricted lessons are dropped below: the five
      // we return should be the five best matches a caller is allowed to see
      const search: SearchRow[] =
        await prisma.$queryRaw`SELECT lesson_id, source_content FROM snippets WHERE to_tsvector('english', source_content) @@ to_tsquery(${q
          .split(' ')
          .join(
            ' & ',
          )}) ORDER BY similarity(source_content, ${q}) DESC limit ${resultLimit * 5}`;

      // console.timeEnd('snippet search');

      const ids = search.map((r) => r.lesson_id);

      // the snippets come back ranked, and that ranking has to survive the
      // join, the filter and the trim below
      const rankByLessonId = new Map<string, number>();

      search.forEach((row, index) => {
        if (!rankByLessonId.has(row.lesson_id)) {
          rankByLessonId.set(row.lesson_id, index);
        }
      });

      interface Record {
        id: string;
        title: string;
        slug: string;
      }
      const res: Record[] = await prisma.lesson.findMany({
        where: {
          id: {
            in: ids,
          },
        },
        select: {
          id: true,
          title: true,
          slug: true,
        },
        cacheStrategy: { ttl: 60 * 5, swr: 60 * 2 },
      });

      // a snippet is transcript content, so gate it the way the transcript
      // endpoint does
      const restrictions = await getLessonsRestrictions(
        getClient(),
        res.map((r: Record) => r.slug),
        'transcript',
      );

      return res
        .filter((r: Record) => !restrictions[r.slug])
        .sort(
          (a: Record, b: Record) =>
            (rankByLessonId.get(a.id) ?? Infinity) -
            (rankByLessonId.get(b.id) ?? Infinity),
        )
        .slice(0, resultLimit)
        .map((r: Record) => ({
          lessonTitle: r.title,
          lessonSlug: r.slug,
          transcriptSnippet: search.find((s) => s.lesson_id === r.id)
            ?.source_content,
        }));
    }),
});
