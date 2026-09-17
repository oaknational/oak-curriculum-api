import * as z from 'zod/v4';
import example from './searchTranscriptResponse.example.json' with { type: 'json' };

export const searchTranscriptResponseSchema = z
  .array(
    z.object({
      lessonTitle: z.string().describe('The lesson title'),
      lessonSlug: z.string().describe('The lesson slug identifier'),
      transcriptSnippet: z
        .string()
        .describe('The snippet of the transcript that matched the search term')
        .optional(),
    }),
  )
  .meta({ example });
