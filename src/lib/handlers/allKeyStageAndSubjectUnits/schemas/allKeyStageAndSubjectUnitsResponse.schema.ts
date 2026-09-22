import * as z from 'zod/v4';
import example from './allKeyStageAndSubjectUnitsResponse.example.json' with { type: 'json' };

const examBoardSchema = z.object({
  title: z.string().describe('The title of the exam board'),
  slug: z.string().describe('The slug of the exam board'),
});

export const allKeyStageAndSubjectUnitsResponseSchema = z
  .array(
    z.object({
      yearSlug: z.string().describe('The year identifier'),
      yearTitle: z.string().describe('The year title'),
      units: z
        .array(
          z.object({
            unitSlug: z.string().describe('The unit slug identifier'),
            unitTitle: z.string().describe('The unit title'),
            examBoards: z
              .array(examBoardSchema)
              .optional()
              .describe(
                'The exam boards the unit appears in. Only populated for KS4 subjects when the request does not supply an `examBoard` filter.',
              ),
          }),
        )
        .meta({ description: 'List of units for the specified year' }),
    }),
  )
  .meta({ example });
