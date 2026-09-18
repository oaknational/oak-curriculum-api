import { beforeEach, expect, test, vi } from 'vitest';
import { FakeRateLimit, fakeRateLimit } from './fakeRateLimit';
import { authedCaller } from './make-call';
import type { User } from '@/lib/apikeys';

// These tests have `@/lib/rateLimit` under test, so they can't use the blanket
// stub in `./helper` — but they mustn't talk to the real Redis either, or every
// run spends production quota and litters it with `rateLimit:*` records that
// `bin/clean-test-rate-limits.ts` then has to clear up. Swapping out the
// Upstash client leaves all of our own wiring exercised. Vitest hoists this
// above the imports above.
vi.mock('@upstash/ratelimit', () => ({ Ratelimit: FakeRateLimit }));

beforeEach(() => fakeRateLimit.reset());

test('rate limit reduces', async () => {
  const user: User = {
    id: 1,
    key: 'test-normal-rate',
  };
  const { caller } = authedCaller(user);

  const beforeRequest = await caller.getRateLimit.getRateLimit();
  await caller.getSubjects.getAllSubjects();
  const afterRequest = await caller.getRateLimit.getRateLimit();

  expect(afterRequest.remaining).toBe(beforeRequest.remaining - 1);
});

test('unlimited rate users', async () => {
  const user: User = {
    id: 1,
    key: 'test-unlimited-rate',
    rateLimit: 0,
  };
  const { caller } = authedCaller(user);

  const beforeRequest = await caller.getRateLimit.getRateLimit();
  await caller.getSubjects.getAllSubjects();
  const afterRequest = await caller.getRateLimit.getRateLimit();

  expect(afterRequest.remaining).toBe(beforeRequest.remaining);
});

test('custom rate limit', async () => {
  const user: User = {
    id: 1,
    key: 'test-3-rate',
    rateLimit: 3,
  };
  const { caller } = authedCaller(user);

  const beforeRequest = await caller.getRateLimit.getRateLimit();

  expect(beforeRequest.remaining).toBe(3);

  for (let i = 0; i < beforeRequest.remaining - 1; i++) {
    await caller.getSubjects.getAllSubjects();
  }

  // expect to throw
  await expect(() => caller.getSubjects.getAllSubjects()).rejects.toThrow();

  const afterRequest = await caller.getRateLimit.getRateLimit();

  expect(afterRequest.remaining).toBe(0);
});
