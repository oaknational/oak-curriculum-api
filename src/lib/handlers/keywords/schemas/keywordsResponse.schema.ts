import * as z from 'zod/v4';
import example from './keywordsResponse.example.json' with { type: 'json' };

export const keywordsResponseSchema = z
  .array(
    z.object({
      keyword: z.string().describe('The keyword text'),
      description: z.string().describe('A description of the keyword'),
      keyStageSlug: z
        .string()
        .describe('The key stage slug associated with the keyword'),
      subjectSlug: z
        .string()
        .describe('The subject slug associated with the keyword'),
      lessonSlugs: z
        .array(z.string())
        .describe('The different lesson slugs where this keyword is used'),
    }),
  )
  .meta({ example });
