/**
 * An in-memory stand-in for `@upstash/ratelimit`'s `Ratelimit`, covering only
 * the surface `src/lib/rateLimit.ts` uses.
 *
 * The rest of the suite stubs `@/lib/rateLimit` wholesale (see `./helper`), but
 * `rate-limit.test.ts` has that module under test, so it needs the limiter to
 * behave — just not against a real Redis. Left unmocked those tests spend real
 * quota against the production database and leave `rateLimit:*` counters and
 * analytics behind; `bin/clean-test-rate-limits.ts` clears up what earlier runs
 * wrote.
 *
 * The counter is a plain fixed window rather than Upstash's sliding one: the
 * tests care that a request costs a token and that running out is refused, not
 * about how the window slides. Counts live at module scope, keyed by
 * `prefix:identifier`, because `getRateLimiter()` builds a fresh limiter for
 * every call.
 */

type Duration = `${number} ${'ms' | 's' | 'm' | 'h' | 'd'}`;

interface Limiter {
  tokens: number;
  windowMs: number;
}

const UNIT_MS = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
} as const;

function parseWindow(window: Duration): number {
  const [amount, unit] = window.split(' ') as [string, keyof typeof UNIT_MS];
  return Number(amount) * UNIT_MS[unit];
}

const counts = new Map<string, number>();

export const fakeRateLimit = {
  /** Forget every counter, so each test starts with a full allowance. */
  reset(): void {
    counts.clear();
  },

  /** Test helper: tokens spent so far against `prefix:identifier`. */
  used(key: string): number {
    return counts.get(key) ?? 0;
  },
};

export class FakeRateLimit {
  static slidingWindow(tokens: number, window: Duration): Limiter {
    return { tokens, windowMs: parseWindow(window) };
  }

  private readonly prefix: string;
  private readonly limiter: Limiter;

  constructor(config: { prefix?: string; limiter: Limiter }) {
    this.prefix = config.prefix ?? '@upstash/ratelimit';
    this.limiter = config.limiter;
  }

  limit(identifier: string): {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
    pending: Promise<unknown>;
  } {
    const { tokens } = this.limiter;
    const key = this.key(identifier);
    const used = counts.get(key) ?? 0;

    // Upstash only spends a token when there is one to spend.
    if (used < tokens) {
      counts.set(key, used + 1);
    }

    return {
      success: used < tokens,
      limit: tokens,
      remaining: Math.max(0, tokens - used - 1),
      reset: this.reset(),
      pending: Promise.resolve(),
    };
  }

  getRemaining(identifier: string): {
    remaining: number;
    reset: number;
    limit: number;
  } {
    const { tokens } = this.limiter;
    const used = counts.get(this.key(identifier)) ?? 0;

    return {
      remaining: Math.max(0, tokens - used),
      reset: this.reset(),
      limit: tokens,
    };
  }

  private key(identifier: string): string {
    return `${this.prefix}:${identifier}`;
  }

  private reset(): number {
    const { windowMs } = this.limiter;
    return (Math.floor(Date.now() / windowMs) + 1) * windowMs;
  }
}
