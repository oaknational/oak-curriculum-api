import { keyStagesResult } from '@/lib/handlers/subjects/types';
import example from './subjectKeyStagesResponse.example.json' with { type: 'json' };

export const subjectKeyStagesResponseSchema = keyStagesResult.meta({
  description:
    'The key stage slug identifiers for which this subject has content available for',
  example,
});
