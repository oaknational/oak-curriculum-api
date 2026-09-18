import * as z from 'zod/v4';
import example from './programmeUnitsResponse.example.json' with { type: 'json' };

export const programmeUnitsResponseSchema = z
  .array(
    z.object({
      unitSlug: z.string().meta({
        description: 'The unit slug identifier',
        example: 'variables-and-data-types',
      }),
      unitTitle: z.string().meta({
        description: 'The unit title',
        example: 'Variables and data types',
      }),
      unitOrder: z.number().meta({
        description: 'The unit order within the programme',
        example: 1,
      }),
    }),
  )
  .meta({
    example,
  });
