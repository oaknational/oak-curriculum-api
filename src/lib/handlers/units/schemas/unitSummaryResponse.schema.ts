import * as z from 'zod/v4';
import { categorySchema, threadSchema } from '@/lib/handlers/units/types';
import { unitProgrammeFactorsSchema } from '@/lib/handlers/unitProgrammeFactors';
import example from './unitSummaryResponse.example.json' with { type: 'json' };

export const unitSummaryResponseSchema = z
  .object({
    unitSlug: z.string().describe('The unit slug identifier'),
    unitTitle: z.string().describe('The unit title'),
    yearSlug: z
      .string()
      .describe('The slug identifier for the year to which the unit belongs'),
    year: z
      .union([z.number(), z.string().describe('All years')])
      .describe('The year to which the unit belongs'),
    phaseSlug: z
      .string()
      .describe('The slug identifier for the phase to which the unit belongs'),
    subjectSlug: z.string().describe('The subject identifier'),
    keyStageSlug: z
      .string()
      .describe(
        'The slug identifier for the the key stage to which the unit belongs',
      ),
    notes: z.string().describe('Unit summary notes').optional(),
    description: z
      .string()
      .describe(
        'A short description of the unit. Not yet available for all subjects.',
      )
      .optional(),
    priorKnowledgeRequirements: z
      .array(z.string())
      .describe('The prior knowledge required for the unit'),
    nationalCurriculumContent: z
      .array(z.string())
      .describe(
        'National curriculum attainment statements covered in this unit',
      ),
    whyThisWhyNow: z
      .string()
      .describe(
        'An explanation of where the unit sits within the sequence and why it has been placed there.',
      )
      .optional(),
    threads: z
      .array(threadSchema)
      .describe('The threads that are associated with the unit')
      .optional(),
    categories: z
      .array(categorySchema)
      .describe(
        'The categories (if any) that are assigned to the unit. If the unit does not have any categories, this property is omitted.',
      )
      .optional(),
    programmeFactors: unitProgrammeFactorsSchema
      .describe(
        'The programme-factor values that identify which variant of this unit is returned. Omitted when the unit has no programme factors.',
      )
      .optional(),
    unitOptionsGroup: z
      .string()
      .optional()
      .describe(
        `If the unit is unit variant, then this is the unit's "parent" unit slug`,
      ),
    unitLessons: z.array(
      z
        .object({
          lessonSlug: z.string().describe('The lesson slug identifier'),
          lessonTitle: z.string().describe('The title for the lesson'),
          lessonOrder: z
            .number()
            .describe('Indicates the ordering of the lesson')
            .optional(),
          state: z
            .enum(['published', 'new'])
            .describe(
              "If the state is 'published' then it is also available on the /lessons/* endpoints. If the state is 'new' then it's not available yet.",
            ),
        })
        .describe('All the lessons contained in the unit'),
    ),
  })
  .meta({ example });
