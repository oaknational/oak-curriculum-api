import router from '@/lib/router';
import { createCallerFactory } from '@/lib/trpc';
import { vitest } from 'vitest';
import { User } from '@/lib/apikeys';
import type { ApiMajor } from '@/lib/apiVersion';
import { NextRequest } from 'next/server';

// Callers have no URL, so the major cannot be derived from the request.
// Default to the oldest major so existing assertions on /api/v0 URLs keep
// their meaning; pass `major` explicitly to exercise a newer one.
const defaultMajor: ApiMajor = 'v0';

export function makeRes() {
  return {
    writeHead: vitest.fn(),
    setHeader: vitest.fn(),
    getHeader: vitest.fn(),
    pipe: vitest.fn(),
    on: vitest.fn(),
    once: vitest.fn(),
    emit: vitest.fn(),
    write: vitest.fn(),
    end: vitest.fn(),
  };
}

export function makeResHeaders() {
  return {
    get: vitest.fn(),
    set: vitest.fn(),
  };
}

interface CallerOverrides {
  user?: User | number | null;
  major?: ApiMajor;
}

export function makeCaller(
  opts: CallerOverrides & Record<string, unknown> = {},
  rateLimit = false,
  headers = makeResHeaders() as unknown as Headers,
) {
  const createCaller = createCallerFactory(router);

  // A numeric `user` is shorthand for "some authenticated user with this id".
  const requested = opts.user ?? null;
  const user: User | null =
    typeof requested === 'number'
      ? {
          id: requested,
          key: `test-key-${requested}`,
          rateLimit: rateLimit ? 1000 : 0,
        }
      : requested;

  return createCaller({
    req: {
      headers,
    } as NextRequest,
    resHeaders: headers,
    rateLimit: undefined,
    major: defaultMajor,
    ...opts,
    user,
  });
}

export function authedCaller(
  user: User | number = 1,
  major: ApiMajor = defaultMajor,
) {
  const res = makeRes();
  const headers = makeResHeaders();
  return {
    caller: makeCaller(
      {
        user,
        res,
        major,
      },
      false,
      headers as unknown as Headers,
    ),
    request: res,
    headers,
  };
}
