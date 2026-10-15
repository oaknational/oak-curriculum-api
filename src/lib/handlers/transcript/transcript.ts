import { v0Procedure } from '@/lib/protect';
import { router } from '@/lib/trpc';
import type { LessonContentView } from 'lib/owaClient';
import { getClient, gql, lessonContentView } from 'lib/owaClient';

import { isLessonRestricted } from '../../queryGate';
import { transcriptRequestSchema, transcriptResponseSchema } from './schemas';
import { TRPCError } from '@trpc/server';
import { errorResponses } from '@/lib/errorResponses';

export const getLessonTranscript = router({
  getLessonTranscript: v0Procedure
    .meta({
      openapi: {
        method: 'GET',
        tags: ['lessons'],
        summary: 'Lesson video transcript',
        path: '/lessons/{lesson}/transcript',
        description: `Use when you have a lesson slug and need the video transcript — for accessibility, captioning, or text analysis. Returns the transcript as an array of sentences plus a raw WebVTT captions file (vtt) suitable for a <track> element.

Not for: searching across transcripts (GET /search/transcripts); the video file itself (GET /lessons/{lesson}/assets/{type} with type=video); lesson metadata (GET /lessons/{lesson}/summary).`,
        errorResponses,
      },
    })
    .input(transcriptRequestSchema)
    .output(transcriptResponseSchema)
    .query(async ({ input }) => {
      const slug = decodeURIComponent(input.lesson);

      const client = getClient();

      const gated = await isLessonRestricted(client, slug, 'transcript');

      if (gated.isNotFound()) {
        throw new TRPCError({
          message: 'Lesson not found',
          code: 'NOT_FOUND',
        });
      }

      if (gated.isBlocked()) {
        throw new TRPCError({
          message: `Transcript not available: "${slug}"`,
          code: 'BAD_REQUEST',
          cause: gated.reason,
        });
      }

      const query = gql`
        query ($slug: String!) {
          ${lessonContentView}(
            where: { lesson_slug: { _eq: $slug }, is_legacy: { _eq: false } }
          ) {
            transcript_sentences
            transcript_vtt
          }
        }
      `;

      const res: LessonContentView = await client.request(query, {
        slug,
      });

      const content = res[lessonContentView][0];

      // the response needs both fields, so a lesson with no transcript — a
      // legacy one, which the filter above leaves out, or one with no video —
      // has nothing to answer with
      if (!content?.transcript_vtt || !content.transcript_sentences) {
        throw new TRPCError({
          message: `Transcript not found: "${slug}"`,
          code: 'NOT_FOUND',
        });
      }

      return {
        vtt: content.transcript_vtt.replace(/\r/g, ''),
        transcript: content.transcript_sentences,
      };
    }),
});
