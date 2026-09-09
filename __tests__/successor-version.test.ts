import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { API_MAJORS, successorMajor } from '@/lib/apiVersion';
import { unitVariantLessonsView } from '@/lib/owaClient';

const mocks = vi.hoisted(() => ({
  owaClientRequestMock: vi.fn(),
}));

vi.mock('@/lib/apikeys', () => ({
  findUserByKey: vi.fn().mockResolvedValue({
    id: 1,
    key: 'test-key',
    rateLimit: 0,
  }),
}));

vi.mock('@/lib/owaClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/owaClient')>();
  return {
    ...actual,
    getClient: () => ({ request: mocks.owaClientRequestMock }),
  };
});

const trpcRoute = {
  v0: () => import('@/app/api/v0/[...trpc]/route'),
  v1: () => import('@/app/api/v1/[...trpc]/route'),
} as const;

const swaggerRoute = {
  v0: () => import('@/app/api/v0/swagger.json/route'),
  v1: () => import('@/app/api/v1/swagger.json/route'),
} as const;

function authedRequest(url: string) {
  return new Request(url, {
    method: 'GET',
    headers: { authorization: 'Bearer test-key' },
  }) as NextRequest;
}

describe.each(API_MAJORS)('%s responses', (major) => {
  const successor = successorMajor(major);
  const expected = `</api/${successor}>; rel="successor-version"`;

  beforeEach(() => {
    mocks.owaClientRequestMock.mockReset();
  });

  it(
    successor
      ? 'advertises its successor on the tRPC surface'
      : 'advertises no successor on the tRPC surface',
    async () => {
      mocks.owaClientRequestMock.mockResolvedValue({
        [unitVariantLessonsView]: [],
      });

      const { GET } = await trpcRoute[major]();
      const res = await GET(
        authedRequest(
          `http://localhost:2727/api/${major}/key-stages/ks1/subject/english/lessons`,
        ),
      );

      if (successor) {
        expect(res.headers.get('link')).toContain(expected);
      } else {
        expect(res.headers.get('link') ?? '').not.toContain(
          'rel="successor-version"',
        );
      }
    },
  );

  it(
    successor
      ? 'advertises its successor on swagger.json'
      : 'advertises no successor on swagger.json',
    async () => {
      const { GET } = await swaggerRoute[major]();
      const res = GET();

      if (successor) {
        expect(res.headers.get('link')).toContain(expected);
      } else {
        expect(res.headers.get('link') ?? '').not.toContain(
          'rel="successor-version"',
        );
      }
    },
  );
});

describe('a paginated response from a superseded major', () => {
  beforeEach(() => {
    mocks.owaClientRequestMock.mockReset();
  });

  it('carries both the next page and the successor', async () => {
    // The two links have to coexist: `Link` is appended, never set, or the
    // successor would silently replace pagination on exactly the endpoints
    // most likely to be crawled.
    const superseded = API_MAJORS.filter((major) => successorMajor(major));

    for (const major of superseded) {
      mocks.owaClientRequestMock.mockResolvedValue({
        [unitVariantLessonsView]: Array(10).fill({
          lesson_slug: 'test-lesson',
          lesson_title: 'Test Lesson',
          unit_slug: 'test-unit',
          unit_title: 'Test Unit',
        }),
      });

      const { GET } = await trpcRoute[major]();
      const res = await GET(
        authedRequest(
          `http://localhost:2727/api/${major}/key-stages/ks1/subject/english/lessons?offset=0&limit=10`,
        ),
      );

      const link = res.headers.get('link') ?? '';

      expect(link).toContain('rel="next"');
      expect(link).toContain('rel="successor-version"');
      // And the next page stays within the major it was requested from.
      expect(link).toContain(`/api/${major}/`);
    }

    expect(superseded.length).toBeGreaterThan(0);
  });
});
