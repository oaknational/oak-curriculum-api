import * as z from 'zod/v4';
import example from './rateLimitResponse.example.json' with { type: 'json' };

export const rateLimitResponseSchema = z
  .object({
    limit: z
      .number()
      .describe(
        'The maximum number of requests you can make in the current window.',
      ),
    remaining: z
      .number()
      .describe('The number of requests remaining in the current window.'),
    reset: z
      .number()
      .describe(
        'The time at which the current window resets, in milliseconds since the Unix epoch.',
      ),
  })
  .meta({ example });
