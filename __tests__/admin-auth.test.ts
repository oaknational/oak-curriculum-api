import { describe, expect, it, beforeEach, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

const USERNAME = 'admin-test';
const PASSWORD = 'admin-secret';

function basic(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

function makeRequest(path: string, authorization?: string): NextRequest {
  return new NextRequest(`http://localhost:2727${path}`, {
    method: 'GET',
    headers: authorization ? { authorization } : undefined,
  });
}

describe('admin basic auth proxy', () => {
  beforeEach(() => {
    // `pnpm test` loads the developer's real .env, so these must be stubbed or
    // the results differ between machines and CI.
    vi.stubEnv('AUTH_USERNAME', USERNAME);
    vi.stubEnv('AUTH_PASSWORD', PASSWORD);
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it.each(['/admin', '/admin/users/1', '/api/admin/users'])(
    'challenges %s when no credentials are sent',
    (path) => {
      const res = proxy(makeRequest(path));

      expect(res.status).toBe(401);
      expect(res.headers.get('WWW-Authenticate')).toBe('Basic');
    },
  );

  it('rejects the wrong password', () => {
    const res = proxy(makeRequest('/admin', basic(USERNAME, 'nope')));

    expect(res.status).toBe(401);
  });

  it('rejects the wrong username', () => {
    const res = proxy(makeRequest('/admin', basic('nope', PASSWORD)));

    expect(res.status).toBe(401);
  });

  it.each(['/admin', '/admin/users/1', '/api/admin/users'])(
    'allows %s with the right credentials',
    (path) => {
      const res = proxy(makeRequest(path, basic(USERNAME, PASSWORD)));

      expect(res.status).toBe(200);
    },
  );

  it.each(['/', '/docs/about-oaks-api/api-overview', '/api/v0/swagger.json'])(
    'leaves %s unauthenticated',
    (path) => {
      expect(proxy(makeRequest(path)).status).toBe(200);
    },
  );
});
