import { router } from '@/lib/trpc';
import * as z from 'zod/v4';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, getRateLimiter } from '../../protect';
import { rateLimitResponseSchema } from './schemas/rateLimitResponse.schema';
import { errorResponses } from '@/lib/errorResponses';

export const getRateLimit = router({
  getRateLimit: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/rate-limit',
        tags: ['internal'],
        errorResponses,
        summary: 'Current rate-limit status',
        description: `Use when you need rate-limit status as a JSON body — e.g. for a quota indicator. Returns limit, remaining, and reset. The same data sits on the 'X-RateLimit-*' headers of most responses, so this endpoint is mainly for browser clients, which cannot read those headers cross-origin, and for the routes that drop them on errors. Does not count against your quota.`,
      },
      noCost: true,
    })
    .output(rateLimitResponseSchema)
    .input(z.undefined())
    .query(async ({ ctx }) => {
      const { user } = ctx;

      // this is possible because we use publicProcedure - to avoid
      // using their requests
      if (!user) {
        throw new TRPCError({
          message: 'API token not provided to check rate limit',
          code: 'UNAUTHORIZED',
        });
      }

      const rateLimit = getRateLimiter(user.rateLimit);
      const rate = await rateLimit.check(user, true);

      if (rate.isSubjectToRateLimiting) {
        const { limit, remaining, reset } = rate;
        return { limit, remaining, reset };
      }

      return { limit: 0, remaining: 0, reset: 0 };
    }),
});
