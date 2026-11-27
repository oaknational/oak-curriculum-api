import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { TRPCRequestInfo } from '@trpc/server/http';

import { EXPOSED_RESPONSE_HEADERS } from '@/lib/api/cors';
import { trpcPreflight } from '@/lib/api/trpcRoute';
import { assetDownloadPreflight } from '@/lib/handlers/assetDownload/assetDownload';
import { createContext } from '@/lib/context';
import { makeCaller } from './make-call';

// The limiter is the one thing here that would otherwise need Redis. What it
// reports does not matter; that the headers it sets are readable does.
vi.mock('@/lib/rateLimit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rateLimit')>()),
  getRateLimiter: () => ({
    check: () =>
      Promise.resolve({
        isSubjectToRateLimiting: true as const,
        limit: 3,
        remaining: 2,
        reset: Date.now() + 60_000,
      }),
  }),
}));

/**
 * The API is answered cross-origin — the playground and the bulk download page
 * both call it from a browser — and a browser hands JavaScript only the seven
 * safelisted response headers unless the response says otherwise. Every header
 * this API carries protocol on is outside that set, so anything not named in
 * `Access-Control-Expose-Headers` is invisible to the client that asked for it.
 */

function exposedBy(res: Response): string[] {
  return (res.headers.get('access-control-expose-headers') ?? '')
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
}

const expected = EXPOSED_RESPONSE_HEADERS.map((name) => name.toLowerCase());

describe('the CORS preflights', () => {
  it.each([
    ['the API surface', trpcPreflight()],
    ['an asset download', assetDownloadPreflight()],
  ])('advertise the exposed headers on %s', (_name, res) => {
    expect(exposedBy(res)).toEqual(expect.arrayContaining(expected));
  });
});

describe('an API response', () => {
  it('exposes the headers the browser would otherwise be denied', async () => {
    const set = new Map<string, string>();

    await createContext('v1')({
      req: new Request('https://open-api.thenational.academy/api/v1/subjects'),
      res: { setHeader: (key, value) => void set.set(key, value) },
      info: { url: null } as unknown as TRPCRequestInfo,
    });

    const exposed = (set.get('access-control-expose-headers') ?? '')
      .split(',')
      .map((name) => name.trim().toLowerCase());

    expect(exposed).toEqual(expect.arrayContaining(expected));
  });

  it('exposes the rate-limit headers it actually sets', async () => {
    const headers = new Headers();
    const caller = makeCaller(
      { user: { id: 1, key: 'test-cors-rate', rateLimit: 3 } },
      false,
      headers,
    );

    await caller.getRateLimit.getRateLimit();

    // Whatever the request set, minus the CORS preamble, has to be readable.
    const set = [...headers.keys()].filter(
      (name) => !name.startsWith('access-control-'),
    );

    expect(set).toContain('x-ratelimit-remaining');
    for (const name of set) {
      expect(expected).toContain(name);
    }
  });
});

describe('auth.md', () => {
  it('names the headers the API actually exposes', () => {
    // auth.md is what an agent reads before writing its client, so the list it
    // publishes has to be the list the code sends.
    const authMd = readFileSync(
      new URL('../public/auth.md', import.meta.url),
      'utf8',
    );

    for (const name of EXPOSED_RESPONSE_HEADERS) {
      expect(authMd).toContain(`\`${name}\``);
    }
  });
});

/**
 * The exposure list is written out by hand, because a header set deep in a
 * handler cannot be discovered from the CORS layer. This is what keeps it
 * honest: a new `resHeaders.set(...)` anywhere in the API fails here until it
 * is either exposed or deliberately left off.
 */
describe('every header the API sets', () => {
  const root = new URL('../src/lib/', import.meta.url);
  const sources = readdirSync(root, { recursive: true }).filter(
    (name) => typeof name === 'string' && name.endsWith('.ts'),
  );

  const names = new Set<string>();

  for (const source of sources) {
    const text = readFileSync(new URL(source as string, root), 'utf8');

    for (const [, name] of text.matchAll(
      /(?:resHeaders|res\.headers|headers)\.(?:set|append)\(\s*'([^']+)'/g,
    )) {
      names.add(name.toLowerCase());
    }
  }

  it('is either exposed or safelisted', () => {
    // The seven a browser hands over unasked, plus the ones a route sets for
    // the transfer itself rather than for the client to read.
    const safelisted = [
      'cache-control',
      'content-language',
      'content-length',
      'content-type',
      'expires',
      'last-modified',
      'pragma',
      'location',
      'vary',
      'accept-ranges',
      'content-disposition',
      'content-range',
    ];

    expect(names.size).toBeGreaterThan(0);
    for (const name of names) {
      if (name.startsWith('access-control-') || name.startsWith('x-markdown')) {
        continue;
      }

      expect([...expected, ...safelisted]).toContain(name);
    }
  });
});
