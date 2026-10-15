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

async function callCheckRestricted(
  major: ApiMajor,
  lessonSlugs: string[],
): Promise<Response> {
  const { POST } = await trpcRoute[major]();

  const req = new Request(
    `http://localhost:2727/api/${major}/lessons/check-restricted`,
    {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-key',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ lessonSlugs }),
    },
  ) as NextRequest;

  return POST(req);
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
    '/lessons/how-much-money-have-i-got/transcript',
    // a lesson of the same subject that the gate does not restrict: nothing
    // but the subject stands between it and being served
    '/lessons/can-i-spend-money-playing-online/summary',
    '/lessons/can-i-spend-money-playing-online/quiz',
    '/lessons/can-i-spend-money-playing-online/assets',
    '/lessons/can-i-spend-money-playing-online/transcript',
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

  it('POST /lessons/check-restricted leaves a blocked subject out', async () => {
    const control = 'add-fractions-with-the-same-denominator';

    const res = await callCheckRestricted(major, [
      'how-much-money-have-i-got',
      control,
    ]);

    expect(res.status).toBe(200);

    const statuses = (await res.json()) as Record<string, string>;

    // absent, as a slug that does not exist is absent: the endpoint must not
    // report a restriction for a lesson it will not serve
    expect(statuses).not.toHaveProperty('how-much-money-have-i-got');
    // and the lesson beside it still answers, so this is the subject check
    // rather than an empty response
    expect(Object.keys(statuses)).toContain(control);
  });

  it('GET /key-stages/ks1/subject/financial-education/check-restricted rejects the subject', async () => {
    const res = await callTrpcEndpoint(
      major,
      '/key-stages/ks1/subject/financial-education/check-restricted',
    );

    // the subject never reaches the gate: the input schema's enum stops it
    expect(res.status).toBe(400);
  });
});
