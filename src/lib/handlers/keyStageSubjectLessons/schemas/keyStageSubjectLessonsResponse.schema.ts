import * as z from 'zod/v4';

import example from './keyStageSubjectLessonsResponse.example.json' with { type: 'json' };

export const keyStageSubjectLessonsResponseSchema = z
  .array(
    z.object({
      unitSlug: z.string().describe('The unit slug identifier'),
      unitTitle: z.string().describe('The unit title'),
      lessons: z
        .array(
          z.object({
            lessonSlug: z.string().describe('The lesson slug identifier'),
            lessonTitle: z.string().describe('The lesson title'),
          }),
        )
        .meta({ description: 'List of lessons for the specified unit' }),
    }),
  )
  .meta({ example });
