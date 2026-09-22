import { subjectSlugs } from '@/lib/keyStageAndSubjects';
import * as z from 'zod/v4';
import example from './allSubjectsResponse.example.json' with { type: 'json' };

export const allSubjectsResponseSchema = z
  .array(z.enum(subjectSlugs as [string]))
  .meta({ example });

export type SubjectsResult = z.infer<typeof allSubjectsResponseSchema>;
