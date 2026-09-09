import { v0Procedure } from '@/lib/protect';
import { router } from '@/lib/trpc';
import { keyStages } from '@/lib/keyStageAndSubjects';
import * as z from 'zod/v4';
import { keyStageResponseSchema } from './schemas';
import { errorResponses } from '@/lib/errorResponses';

export const getKeyStages = router({
  getKeyStages: v0Procedure
    .meta({
      openapi: {
        tags: ['lists'],
        method: 'GET',
        path: '/key-stages',
        summary: 'All key stages',
        errorResponses,
        description: `Use when you need the master list of key stages. Returns every key stage with its title and slug.

Not for: key stages restricted to a subject (GET /subjects/{subject}/key-stages).`,
      },
    })
    .input(z.void())
    .output(keyStageResponseSchema)
    .query(() => keyStages),
});
