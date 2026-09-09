import * as z from 'zod/v4';
import example from './rateLimitResponse.example.json' assert { type: 'json' };

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
        'The end of the current clock-hour bucket, in milliseconds since the Unix epoch. The window slides, so the allowance returns gradually before this rather than all at once at it.',
      ),
  })
  .meta({ example });
