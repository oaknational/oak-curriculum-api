import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  captureMock: vi.fn(),
}));

vi.mock('posthog-node', () => ({
  PostHog: class {
    capture = mocks.captureMock;
  },
}));

const {
  captureApiKeyCreatedEvent,
  createCompanyHash,
  POSTHOG_API_KEY_CREATED_EVENT,
} = await import('@/lib/analytics/posthogServer');

const apiKey = 'a-brand-new-api-key';

const capturedProperties = (): Record<string, unknown> => {
  const [message] = mocks.captureMock.mock.calls[0] as [
    { distinctId: string; event: string; properties: Record<string, unknown> },
  ];

  return message.properties;
};

describe('captureApiKeyCreatedEvent', () => {
  beforeEach(() => {
    mocks.captureMock.mockReset();
    vi.stubEnv('TEST', '');
    vi.stubEnv('VITEST', '');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('POSTHOG_API_KEY', 'test-posthog-api-key');
    vi.stubEnv('POSTHOG_API_HOST', 'https://eu.i.posthog.com');
  });

  it('captures a key creation against the new user', () => {
    captureApiKeyCreatedEvent({
      apiKey,
      company: 'Example School',
      rateLimit: 1000,
      source: 'admin_users_route',
      userId: 7,
    });

    expect(mocks.captureMock).toHaveBeenCalledTimes(1);
    const [message] = mocks.captureMock.mock.calls[0] as [
      { distinctId: string; event: string },
    ];

    expect(message.event).toBe(POSTHOG_API_KEY_CREATED_EVENT);
    expect(message.distinctId).toBe('api-user:7');
    expect(capturedProperties()).toMatchObject({
      company_hash: createCompanyHash({ company: 'exampleschool' })?.hash,
      company_hash_source: 'company',
      rate_limit: 1000,
      source: 'admin_users_route',
      user_id: 7,
    });
  });

  it('never sends the key or the company in the clear', () => {
    captureApiKeyCreatedEvent({
      apiKey,
      company: 'Example School',
      source: 'admin_users_route',
      userId: 7,
    });

    const serialised = JSON.stringify(capturedProperties());

    expect(serialised).not.toContain('Example School');
    expect(serialised).not.toContain(apiKey);
  });

  it('falls back to the key hash when no company was given', () => {
    captureApiKeyCreatedEvent({
      apiKey,
      company: 'N/A',
      source: 'admin_users_route',
      userId: 8,
    });

    expect(capturedProperties()).toMatchObject({
      company_hash: createCompanyHash({ apiKey })?.hash,
      company_hash_source: 'api_key',
    });
  });

  it('does not throw when the transport fails', () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    mocks.captureMock.mockImplementation(() => {
      throw new Error('capture transport error');
    });

    expect(() =>
      captureApiKeyCreatedEvent({
        apiKey,
        source: 'admin_users_route',
        userId: 9,
      }),
    ).not.toThrow();

    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
