import { describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

import { API_MAJORS, type ApiMajor } from '@/lib/apiVersion';

vi.mock('@/lib/apikeys', () => ({
  findUserByKey: vi.fn().mockResolvedValue({
    id: 99,
    key: 'test-key',
    rateLimit: 0,
  }),
}));

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

// Static thunks rather than a template-literal import: `@/` aliases are
// resolved statically, and the route module must load after the mocks above.
const trpcRoute = {
  v0: () => import('@/app/api/v0/[...trpc]/route'),
  v1: () => import('@/app/api/v1/[...trpc]/route'),
} as const;

const assetRoute = {
  v0: () => import('@/app/api/v0/lessons/[lesson]/assets/[type]/route'),
  v1: () => import('@/app/api/v1/lessons/[lesson]/assets/[type]/route'),
} as const;

async function callTrpcEndpoint(
  major: ApiMajor,
  path: string,
): Promise<Response> {
  const { GET } = await trpcRoute[major]();

  const req = new Request(`http://localhost:2727/api/${major}${path}`, {
    method: 'GET',
    headers: {
      authorization: 'Bearer test-key',
    },
  }) as NextRequest;

  return GET(req);
}

async function callLessonAssetEndpoint(
  major: ApiMajor,
  lesson: string,
  type: string,
): Promise<Response> {
  const { GET } = await assetRoute[major]();

  const url = `http://localhost:2727/api/${major}/lessons/${lesson}/assets/${type}`;
  const req = {
    nextUrl: new URL(url),
    url,
    method: 'GET',
    headers: new Headers({
      authorization: 'Bearer test-key',
    }),
  } as unknown as NextRequest;

  return GET(req, {
    params: Promise.resolve({ lesson, type }),
  });
}

describe.each(API_MAJORS)('blocked subjects return 404 at %s', (major) => {
  it.each([
    '/programmes/financial-education-primary-year-1',
    '/programmes/financial-education-primary-year-1/units',
    '/programmes/financial-education-primary-year-1/questions',
    '/programmes/financial-education-primary-year-1/assets',
    '/lessons/how-much-money-have-i-got/summary',
    '/lessons/how-much-money-have-i-got/quiz',
    '/lessons/how-much-money-have-i-got/assets',
  ])('GET %s returns 404', async (path) => {
    const res = await callTrpcEndpoint(major, path);
    expect(res.status).toBe(404);
  });

  it('GET /lessons/how-much-money-have-i-got/assets/slideDeck returns 404', async () => {
    const res = await callLessonAssetEndpoint(
      major,
      'how-much-money-have-i-got',
      'slideDeck',
    );
    expect(res.status).toBe(404);
  });
});
