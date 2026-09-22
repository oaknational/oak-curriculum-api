import * as z from 'zod/v4';
import {
  numberArrayResult,
  keyStagesResult,
  ks4ProgrammeFactorsResult,
} from '@/lib/handlers/subjects/types';
import example from './subjectSequenceResponse.example.json' with { type: 'json' };

export const subjectSequenceResponseSchema = z
  .object({
    sequenceSlug: z.string().meta({
      description: 'The unique identifier for each sequence',
    }),
    years: numberArrayResult,
    keyStages: keyStagesResult,
    phaseSlug: z.string().meta({
      description:
        'The unique identifier for the phase to which this sequence belongs',
    }),
    phaseTitle: z.string().meta({
      description: 'The title for the phase to which this sequence belongs',
    }),
    ks4ProgrammeFactors: ks4ProgrammeFactorsResult,
  })
  .meta({ example });
