import { expect, test } from 'vitest';
import { authedCaller } from './make-call';
import { User } from '@/lib/apikeys';
import { rateLimitResponseSchema } from '@/lib/handlers/rate/schemas/rateLimitResponse.schema';

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

  for (let i = 0; i < beforeRequest.remaining - 1; i++) {
    await caller.getSubjects.getAllSubjects();
  }

  // expect to throw
  await expect(() => caller.getSubjects.getAllSubjects()).rejects.toThrow();

  const afterRequest = await caller.getRateLimit.getRateLimit();

  expect(afterRequest.remaining).toBe(0);
});

test('reset is described as a clock-hour bucket, not a full reset', () => {
  // Upstash's sliding window returns `(currentWindow + 1) * windowSize`, so
  // `reset` is the end of the current clock-hour bucket. The allowance returns
  // gradually across the window, so calling it a reset misleads callers into
  // sleeping to the timestamp.
  const description = rateLimitResponseSchema.shape.reset.description;

  expect(description).toContain('end of the current clock-hour bucket');
  expect(description).not.toContain('the current window resets');
});

test('the rate-limit endpoint does not claim the headers are on every response', async () => {
  // The lesson-asset and bulk routes drop the rate-limit headers on their error
  // responses, and none of the headers are CORS-exposed, so "every response" was
  // never true. See MCP-718 and MCP-720.
  const { openApiDocument } =
    await import('@/lib/zod-openapi/schema/generateDocument');
  const description =
    openApiDocument.paths?.['/rate-limit']?.get?.description ?? '';

  expect(description).not.toContain('headers of every response');
  expect(description).toContain('headers of most responses');
});
