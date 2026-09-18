import { subjectResult } from '@/lib/handlers/subjects/types';
import example from './subjectResponse.example.json' with { type: 'json' };

export const subjectResponseSchema = subjectResult.meta({ example });
