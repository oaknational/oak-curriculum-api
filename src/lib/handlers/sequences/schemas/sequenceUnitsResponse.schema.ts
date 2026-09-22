import { sequenceSchema } from '@/lib/handlers/sequences/types';
import * as z from 'zod/v4';
import example from './sequenceUnitsResponse.example.json' with { type: 'json' };

export const sequenceUnitsResponseSchema = z
  .array(sequenceSchema)
  .meta({ example });

export type SequenceUnitsResponse = z.infer<typeof sequenceUnitsResponseSchema>;
