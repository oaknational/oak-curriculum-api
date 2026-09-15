import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { API_MAJORS, type ApiMajor } from '@/lib/apiVersion';
import { keyStages } from '@/lib/keyStageAndSubjects';

/**
 * Every analytics event from the versioned API carries the major it arrived on.
 *
 * Without it the majors are indistinguishable in PostHog: `endpoint_path` comes
 * from the version-free `openapi.path`, and the OpenAPI adapter strips the
 * `/api/vN` prefix from the request URL before analytics sees it — so there is
 * no property left to tell them apart, and no way to measure who is still on an
 * older major before retiring it.
 */

const mocks = vi.hoisted(() => ({
  capture: vi.fn(),
}));

vi.mock('@/lib/analytics/posthogServer', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/analytics/posthogServer')>();
  return { ...actual, captureApiRequestEvent: mocks.capture };
});

vi.mock('@/lib/apikeys', () => ({
  findUserByKey: vi.fn().mockResolvedValue({
    id: 1,
    key: 'test-key',
    rateLimit: 0,
  }),
}));

const trpcRoute = {
  v0: () => import('@/app/api/v0/[...trpc]/route'),
  v1: () => import('@/app/api/v1/[...trpc]/route'),
} as const;

const assetRoute = {
  v0: () => import('@/app/api/v0/lessons/[lesson]/assets/[type]/route'),
  v1: () => import('@/app/api/v1/lessons/[lesson]/assets/[type]/route'),
} as const;

interface CapturedPayload {
  apiMajor?: ApiMajor;
  endpointPath: string;
}

function payloads(): CapturedPayload[] {
  return mocks.capture.mock.calls.map((call) => call[0] as CapturedPayload);
}

describe.each(API_MAJORS)('analytics from %s', (major) => {
  beforeEach(() => {
    mocks.capture.mockReset();
  });

  it('records the major on a successful tRPC request', async () => {
    const { GET } = await trpcRoute[major]();

    const res = await GET(
      new Request(`http://localhost:2727/api/${major}/key-stages`, {
        headers: { authorization: 'Bearer test-key' },
      }) as NextRequest,
    );

    expect(res.status).toBe(200);
    expect(payloads()).not.toHaveLength(0);

    for (const payload of payloads()) {
      expect(payload.apiMajor).toBe(major);
      // Unchanged, so charts built on it stay continuous across the split.
      expect(payload.endpointPath).toBe('/key-stages');
    }
  });

  it('records the major on an unrouted request', async () => {
    const { GET } = await trpcRoute[major]();

    await GET(
      new Request(`http://localhost:2727/api/${major}/no-such-endpoint`, {
        headers: { authorization: 'Bearer test-key' },
      }) as NextRequest,
    );

    expect(payloads()).not.toHaveLength(0);
    for (const payload of payloads()) {
      expect(payload.apiMajor).toBe(major);
    }
  });

  it('records the major on the asset download route', async () => {
    const { GET } = await assetRoute[major]();

    await GET(
      {
        url: `http://localhost:2727/api/${major}/lessons/nope/assets/worksheet`,
        method: 'GET',
        headers: new Headers({ authorization: 'Bearer test-key' }),
      } as unknown as NextRequest,
      { params: Promise.resolve({ lesson: 'nope', type: 'worksheet' }) },
    );

    expect(payloads()).not.toHaveLength(0);
    for (const payload of payloads()) {
      expect(payload.apiMajor).toBe(major);
      expect(payload.endpointPath).toBe(
        `/api/${major}/lessons/{lesson}/assets/{type}`,
      );
    }
  });
});

describe('the majors as a set', () => {
  beforeEach(() => {
    mocks.capture.mockReset();
  });

  it('are told apart by api_major alone', async () => {
    // The property has to do the work on its own: the same endpoint under two
    // majors is otherwise identical in the payload.
    const seen: (ApiMajor | undefined)[] = [];

    for (const major of API_MAJORS) {
      mocks.capture.mockReset();
      const { GET } = await trpcRoute[major]();
      await GET(
        new Request(`http://localhost:2727/api/${major}/key-stages`, {
          headers: { authorization: 'Bearer test-key' },
        }) as NextRequest,
      );
      seen.push(payloads()[0]?.apiMajor);
    }

    expect(seen).toEqual([...API_MAJORS]);
    expect(new Set(seen).size).toBe(API_MAJORS.length);
    // Guards the fixture: the endpoint has to actually exist in both.
    expect(keyStages.length).toBeGreaterThan(0);
  });
});
