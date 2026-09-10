import { TRPCError } from '@trpc/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as z from 'zod/v4';

import type { User } from '@/lib/apikeys';
import { createCallerFactory, publicProcedure, router } from '@/lib/trpc';
import { POSTHOG_CAPTURE_EVENT } from '@/lib/analytics/posthogServer';

const mocks = vi.hoisted(() => ({
  captureMock: vi.fn(),
  postHogConstructorMock: vi.fn(),
}));

vi.mock('posthog-node', () => ({
  PostHog: class {
    capture = mocks.captureMock;

    constructor(...args: unknown[]) {
      mocks.postHogConstructorMock(...args);
    }
  },
}));

const analyticsTestRouter = router({
  fail: publicProcedure.query(() => {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'forced error',
    });
  }),
  ok: publicProcedure
    .input(
      z.object({
        includeUnits: z.boolean(),
        subject: z.string(),
      }),
    )
    .query(({ input }) => input),
});

const createCaller = createCallerFactory(analyticsTestRouter);

const makeContext = (opts?: {
  user?: User | null;
}): Parameters<typeof createCaller>[0] => {
  const apiKey = 'analytics-test-api-key';

  return {
    apiKey,
    req: new Request(
      'http://localhost:2727/api/v0/subjects?subject=maths&includeUnits=true&tag=one&tag=two',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    ),
    resHeaders: {
      set: vi.fn(),
    },
    rateLimit: undefined,
    major: 'v0' as const,
    user: opts?.user || null,
  };
};

describe('tRPC analytics middleware', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    mocks.captureMock.mockReset();
    mocks.postHogConstructorMock.mockReset();
    vi.stubEnv('TEST', '');
    vi.stubEnv('VITEST', '');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('POSTHOG_API_KEY', 'test-posthog-api-key');
    vi.stubEnv('POSTHOG_API_HOST', 'https://eu.i.posthog.com');
  });

  it('captures successful requests with args and query params', async () => {
    const caller = createCaller(
      makeContext({
        user: {
          id: 42,
          key: 'analytics-test-api-key',
        },
      }),
    );

    await caller.ok({
      includeUnits: true,
      subject: 'maths',
    });

    expect(mocks.postHogConstructorMock).toHaveBeenCalledTimes(1);
    expect(mocks.captureMock).toHaveBeenCalledTimes(1);
    const [message] = mocks.captureMock.mock.calls[0] as [
      {
        distinctId: string;
        event: string;
        properties: Record<string, unknown>;
      },
    ];

    expect(message.event).toBe(POSTHOG_CAPTURE_EVENT);
    expect(message.distinctId).toBe('api-user:42');
    expect(message.properties.success).toBe(true);
    expect(message.properties.error_code).toBeUndefined();
    expect(message.properties.args).toEqual({
      includeUnits: true,
      subject: 'maths',
    });
    expect(message.properties.query_params).toEqual({
      includeUnits: 'true',
      subject: 'maths',
      tag: ['one', 'two'],
    });
  });

  it('captures failed requests with error code', async () => {
    const caller = createCaller(
      makeContext({
        user: {
          id: 99,
          key: 'analytics-test-api-key',
        },
      }),
    );

    await expect(async () => await caller.fail()).rejects.toThrow(
      'forced error',
    );

    expect(mocks.captureMock).toHaveBeenCalledTimes(1);
    const [message] = mocks.captureMock.mock.calls[0] as [
      {
        properties: Record<string, unknown>;
      },
    ];

    expect(message.properties.success).toBe(false);
    expect(message.properties.error_code).toBe('BAD_REQUEST');
  });

  it('does not fail procedure calls if analytics capture transport fails', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    mocks.captureMock.mockImplementation(() => {
      throw new Error('capture transport error');
    });

    const caller = createCaller(
      makeContext({
        user: {
          id: 123,
          key: 'analytics-test-api-key',
        },
      }),
    );

    await expect(
      caller.ok({
        includeUnits: true,
        subject: 'maths',
      }),
    ).resolves.toEqual({
      includeUnits: true,
      subject: 'maths',
    });

    expect(mocks.captureMock).toHaveBeenCalledTimes(1);

    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
