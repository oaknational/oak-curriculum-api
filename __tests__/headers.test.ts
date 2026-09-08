import { readFileSync } from 'node:fs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';
import { unitVariantLessonsView } from '@/lib/owaClient';
import getConfig, {
  apiCatalogPath,
  homepageDiscoveryLinkHeader,
} from '../next.config.mjs';

/**
 * HTTP Headers Integration Tests
 *
 * These tests verify that HTTP response headers are correctly set and propagated
 * through the full stack: HTTP Request -> Next.js -> TRPC -> HTTP Response
 *
 * This tests the real end-to-end flow, not just the business logic.
 * If headers are set in the TRPC handler but don't appear in the HTTP response,
 * these tests will catch it.
 */

// Mock the OWA client to return controlled data
const mocks = vi.hoisted(() => ({
  owaClientRequestMock: vi.fn(),
}));

vi.mock('@/lib/owaClient', async () => {
  const actual = await vi.importActual('@/lib/owaClient');
  return {
    ...actual,
    getClient: () => ({
      request: mocks.owaClientRequestMock,
    }),
  };
});

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

describe('HTTP Headers - Link header pagination', () => {
  beforeEach(() => {
    mocks.owaClientRequestMock.mockReset();
  });

  it('should return link header in HTTP response when results fill the page', async () => {
    // Mock OWA to return exactly 10 results (full page)
    mocks.owaClientRequestMock.mockResolvedValue({
      [unitVariantLessonsView]: Array(10).fill({
        lesson_slug: 'test-lesson',
        lesson_title: 'Test Lesson',
        unit_slug: 'test-unit',
        unit_title: 'Test Unit',
      }),
    });

    // Import the route handler AFTER mocks are set up
    const { GET } = await import('@/app/api/v0/[...trpc]/route');

    const req = new Request(
      'http://localhost:2727/api/v0/key-stages/ks1/subject/english/lessons?offset=0&limit=10',
      {
        method: 'GET',
        headers: {
          authorization: 'Bearer test-key',
        },
      },
    ) as NextRequest;

    const res = await GET(req);

    expect(res.status).toBe(200);
    const linkHeader = res.headers.get('link');
    expect(linkHeader).toBeTruthy();
    expect(linkHeader).toContain('rel="next"');
    expect(linkHeader).toContain('offset=10');
    expect(linkHeader).toContain('limit=10');
  });

  it('should NOT return link header when results are less than the page size', async () => {
    // Mock OWA to return only 5 results (partial page when limit=10)
    mocks.owaClientRequestMock.mockResolvedValue({
      [unitVariantLessonsView]: Array(5).fill({
        lesson_slug: 'test-lesson',
        lesson_title: 'Test Lesson',
        unit_slug: 'test-unit',
        unit_title: 'Test Unit',
      }),
    });

    const { GET } = await import('@/app/api/v0/[...trpc]/route');

    const req = new Request(
      'http://localhost:2727/api/v0/key-stages/ks1/subject/english/lessons?offset=0&limit=10',
      {
        method: 'GET',
        headers: {
          authorization: 'Bearer test-key',
        },
      },
    ) as NextRequest;

    const res = await GET(req);

    expect(res.status).toBe(200);
    const linkHeader = res.headers.get('link');
    expect(linkHeader).toBeNull();
  });
});

describe('HTTP Headers - homepage agent discovery', () => {
  it('sets RFC 8288 Link headers for useful API resources', async () => {
    const config = await getConfig('');
    const headers = await config.headers?.();
    const homepageHeaders = headers?.find(({ source }) => source === '/');
    const linkHeader = homepageHeaders?.headers.find(
      ({ key }) => key.toLowerCase() === 'link',
    );

    expect(linkHeader?.value).toBe(homepageDiscoveryLinkHeader);
    expect(linkHeader?.value).toContain(
      `<${apiCatalogPath}>; rel="api-catalog"`,
    );
    expect(linkHeader?.value).toContain(
      '</api/v0/swagger.json>; rel="service-desc"',
    );
    expect(linkHeader?.value).toContain(
      '</docs/about-oaks-api/api-overview>; rel="service-doc"',
    );
    expect(linkHeader?.value).toContain('</playground>; rel="service-doc"');
  });

  it('publishes truthful auth.md instructions for agent discovery', () => {
    const authMd = readFileSync(
      new URL('../public/auth.md', import.meta.url),
      'utf8',
    );

    expect(authMd).toContain('# Oak Curriculum API auth.md');
    expect(authMd).toContain('does not currently support OAuth 2.0');
    expect(authMd).toContain('OpenID Connect');
    expect(authMd).toContain(
      'Automated agent registration is not currently supported',
    );
    expect(authMd).toContain('No OAuth token endpoint');
    expect(authMd).toContain('Authorization: Bearer <API_KEY>');
    expect(authMd).toContain('Request an API key');
  });
});
