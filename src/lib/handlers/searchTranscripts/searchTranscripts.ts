import { prisma } from '@/lib/db';
import { v0Procedure } from '@/lib/protect';
import { router } from '@/lib/trpc';
import {
  searchTranscriptRequestSchema,
  searchTranscriptResponseSchema,
} from './schemas';
import { errorResponses } from '@/lib/errorResponses';

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

      const search: SearchRow[] =
        await prisma.$queryRaw`SELECT lesson_id, source_content FROM snippets WHERE to_tsvector('english', source_content) @@ to_tsquery(${q
          .split(' ')
          .join(
            ' & ',
          )}) ORDER BY similarity(source_content, ${q}) DESC limit 5`;

      // console.timeEnd('snippet search');

      const ids = search.map((r) => r.lesson_id);

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

      // sort the rows by the order of the ids array
      return res
        .map((r: Record) => ({
          lessonTitle: r.title,
          lessonSlug: r.slug,
          transcriptSnippet: search.find((s) => s.lesson_id === r.id)
            ?.source_content,
        }))
        .sort((a, b) => {
          return ids.indexOf(a.lessonSlug) - ids.indexOf(b.lessonSlug);
        });
    }),
});
