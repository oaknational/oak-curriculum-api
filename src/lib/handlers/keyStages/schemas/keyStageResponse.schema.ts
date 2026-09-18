import * as z from 'zod/v4';
import example from './keyStageResponse.example.json' with { type: 'json' };

export const keyStageResponseSchema = z
  .array(
    z.object({
      slug: z.string().describe('The key stage slug identifier'),
      title: z.string().describe('The key stage title'),
    }),
  )
  .meta({ example });
