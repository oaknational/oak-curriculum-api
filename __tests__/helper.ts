import {
  GET as _getLessonAsset,
  OPTIONS as _optionsLessonAsset,
} from '@/app/api/v0/lessons/[lesson]/assets/[type]/route';
import { TRPCError } from '@trpc/server';

import type { NextRequest } from 'next/server';
import { vi } from 'vitest';
export * from './make-call';

vi.mock('@/lib/context', () => {
  const user = { id: 1, name: 'Test User', key: 'test-user', rateLimit: 0 };
  return {
    getApiKeyFromRequest: vi.fn().mockReturnValue('test-user'),
    withUser: vi.fn().mockResolvedValue(user),
    Context: vi.fn().mockImplementation(() => ({
      user,
      resHeaders: new Headers(),
    })),
  };
});

vi.mock('@/lib/rateLimit', async (importOriginal: () => Promise<object>) => {
  const actual = await importOriginal();
  return {
    ...actual,
    rateLimiter: () => ({
      check: vi.fn(() => {
        return {
          isSubjectToRateLimiting: false,
        };
      }),
    }),
  };
});

export function extractCauseFromTRPCError(
  error: TRPCError,
): string | undefined {
  if ('cause' in error) {
    const cause = error.cause;
    if (typeof cause === 'string') {
      return cause;
    } else if (cause instanceof Error) {
      return cause.toString();
    }
  }
  return undefined;
}

// create getLessonAsset using the exports
export async function getLessonAsset({
  lesson,
  type,
}: {
  lesson: string;
  type: string;
}): Promise<Response> {
  const url = `http://localhost/lessons/${lesson}/assets/${type}`;
  const request = {
    nextUrl: new URL(url),
    url,
    headers: new Headers({
      authorization: 'Bearer 123',
    }),
  } as unknown as NextRequest;

  const params = Promise.resolve({
    lesson,
    type,
  });
  return _getLessonAsset(request, { params });
}

export function optionsLessonAsset(): Response {
  return _optionsLessonAsset();
}
