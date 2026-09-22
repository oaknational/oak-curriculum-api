import * as z from 'zod/v4';
import { oakUrlSchema } from '@/lib/handlers/commonTypes';
import example from './lessonSearchResponse.example.json' with { type: 'json' };

export const lessonSearchResultSchema = z.object({
  lessonSlug: z.string().meta({ description: 'The lesson slug identifier' }),
  lessonTitle: z.string().meta({ description: 'The lesson title' }),
  oakUrl: oakUrlSchema,
  similarity: z.number().meta({
    description: 'The snippet of the transcript that matched the search term',
  }),
  units: z
    .array(
      z.object({
        unitSlug: z.string(),
        unitTitle: z.string(),
        examBoardTitle: z.string().or(z.null()),
        keyStageSlug: z.string(),
        subjectSlug: z.string(),
      }),
    )
    .meta({
      description:
        'The units that the lesson is part of. See sample response below',
    }),
});

export type LessonSearchResultType = z.infer<typeof lessonSearchResultSchema>;

export const lessonSearchResponseSchema = z
  .array(lessonSearchResultSchema)
  .meta({ example });

export type LessonSearchResponseType = z.infer<
  typeof lessonSearchResponseSchema
>;
