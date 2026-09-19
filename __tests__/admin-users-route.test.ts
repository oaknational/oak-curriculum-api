import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import type {
  AdminRollKeyResponse,
  AdminUser,
  AdminUserDetailResponse,
  AdminUsersResponse,
} from '@/app/api/admin/schemas';
import { fakeRedis } from './fakeRedis';

const mocks = vi.hoisted(() => ({
  captureApiKeyCreatedEventMock: vi.fn(),
}));

vi.mock('@/lib/redis', () => ({ redis: fakeRedis }));

vi.mock('@/lib/analytics/posthogServer', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  captureApiKeyCreatedEvent: mocks.captureApiKeyCreatedEventMock,
}));

vi.mock('@/lib/rateLimit', async (importOriginal: () => Promise<object>) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getRateLimiter: () => ({
      check: vi.fn().mockResolvedValue({
        isSubjectToRateLimiting: true,
        limit: 1000,
        remaining: 998,
        reset: 1234,
      }),
    }),
  };
});

const { GET: listUsers, POST: createUser } =
  await import('@/app/api/admin/users/route');
const { GET: getUser, PATCH: patchUser } =
  await import('@/app/api/admin/users/[id]/route');
const { POST: rollKey } =
  await import('@/app/api/admin/users/[id]/roll-key/route');

const alice = {
  name: 'Alice Example',
  company: 'Example School',
  email: 'alice@example.com',
};

function request(url: string, body?: unknown): NextRequest {
  return new Request(`http://localhost:2727${url}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers:
      body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as NextRequest;
}

function params(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

async function seed(body: Record<string, unknown> = alice): Promise<number> {
  const res = await createUser(request('/api/admin/users', body));
  const { user } = await readJson<{ user: AdminUser }>(res);
  return user.id;
}

describe('POST /api/admin/users', () => {
  beforeEach(() => {
    fakeRedis.reset();
    mocks.captureApiKeyCreatedEventMock.mockReset();
  });

  it('creates a user and returns the key', async () => {
    const res = await createUser(request('/api/admin/users', alice));
    const body = await readJson<{ user: AdminUser }>(res);

    expect(res.status).toBe(201);
    expect(body.user).toMatchObject({ id: 1, ...alice, rateLimit: 1000 });
    expect(body.user.key).toEqual(expect.any(String));
    expect(body.user.createdAt).toEqual(expect.any(String));
  });

  it('accepts an explicit unlimited rate limit', async () => {
    const res = await createUser(
      request('/api/admin/users', { ...alice, rateLimit: 0 }),
    );

    expect((await readJson<{ user: AdminUser }>(res)).user.rateLimit).toBe(0);
  });

  it('reports field-level issues for an invalid body', async () => {
    const res = await createUser(
      request('/api/admin/users', { ...alice, email: 'not-an-email' }),
    );
    const body = await readJson<{ issues: { path: string }[] }>(res);

    expect(res.status).toBe(400);
    expect(body.issues).toContainEqual(
      expect.objectContaining({ path: 'email' }),
    );
  });

  it('tracks the new key in analytics', async () => {
    const res = await createUser(request('/api/admin/users', alice));
    const { user } = await readJson<{ user: AdminUser }>(res);

    expect(mocks.captureApiKeyCreatedEventMock).toHaveBeenCalledTimes(1);
    expect(mocks.captureApiKeyCreatedEventMock).toHaveBeenCalledWith({
      apiKey: user.key,
      company: alice.company,
      rateLimit: 1000,
      source: 'admin_users_route',
      userId: user.id,
    });
  });

  it('tracks nothing when creation is refused', async () => {
    await seed();
    mocks.captureApiKeyCreatedEventMock.mockReset();

    const res = await createUser(request('/api/admin/users', alice));

    expect(res.status).toBe(409);
    expect(mocks.captureApiKeyCreatedEventMock).not.toHaveBeenCalled();
  });

  it('refuses a duplicate email rather than orphaning the first key', async () => {
    await seed();
    const res = await createUser(request('/api/admin/users', alice));

    expect(res.status).toBe(409);
  });
});

describe('GET /api/admin/users', () => {
  beforeEach(async () => {
    fakeRedis.reset();
    await seed();
    await seed({ ...alice, name: 'Bob Bloggs', email: 'bob@example.com' });
  });

  it('lists users newest first with a total', async () => {
    const res = await listUsers(request('/api/admin/users'));
    const body = await readJson<AdminUsersResponse>(res);

    expect(res.status).toBe(200);
    expect(body.users.map((user) => user.id)).toEqual([2, 1]);
    expect(body).toMatchObject({ total: 2, limit: 50, offset: 0 });
  });

  it('filters by search', async () => {
    const res = await listUsers(request('/api/admin/users?search=bloggs'));
    const body = await readJson<AdminUsersResponse>(res);

    expect(body.total).toBe(1);
    expect(body.users[0].name).toBe('Bob Bloggs');
  });

  it('rejects an out-of-range limit', async () => {
    const res = await listUsers(request('/api/admin/users?limit=500'));

    expect(res.status).toBe(400);
  });
});

describe('GET /api/admin/users/[id]', () => {
  beforeEach(() => fakeRedis.reset());

  it('returns the user with their usage', async () => {
    const id = await seed();

    const res = await getUser(
      request(`/api/admin/users/${id}`),
      params(`${id}`),
    );
    const body = await readJson<AdminUserDetailResponse>(res);

    expect(res.status).toBe(200);
    expect(body.user).toMatchObject(alice);
    expect(body.usage).toEqual({
      isSubjectToRateLimiting: true,
      limit: 1000,
      remaining: 998,
      reset: 1234,
    });
  });

  it('does not spend the user’s quota to display them', async () => {
    const id = await seed();

    await getUser(request(`/api/admin/users/${id}`), params(`${id}`));
    const res = await getUser(
      request(`/api/admin/users/${id}`),
      params(`${id}`),
    );

    expect((await readJson<AdminUserDetailResponse>(res)).user.requests).toBe(
      0,
    );
  });

  it('404s for an unknown id', async () => {
    const res = await getUser(request('/api/admin/users/99'), params('99'));

    expect(res.status).toBe(404);
  });

  it('400s for a non-numeric id', async () => {
    const res = await getUser(request('/api/admin/users/abc'), params('abc'));

    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/admin/users/[id]', () => {
  beforeEach(() => fakeRedis.reset());

  it('updates only the supplied fields', async () => {
    const id = await seed();

    const res = await patchUser(
      request(`/api/admin/users/${id}`, { rateLimit: 5000 }),
      params(`${id}`),
    );
    const { user } = await readJson<{ user: AdminUser }>(res);

    expect(res.status).toBe(200);
    expect(user).toMatchObject({ ...alice, rateLimit: 5000 });
  });

  it('rejects an empty patch', async () => {
    const id = await seed();

    const res = await patchUser(
      request(`/api/admin/users/${id}`, {}),
      params(`${id}`),
    );

    expect(res.status).toBe(400);
  });

  it('refuses an email already held by another user', async () => {
    const id = await seed();
    await seed({ ...alice, email: 'bob@example.com' });

    const res = await patchUser(
      request(`/api/admin/users/${id}`, { email: 'bob@example.com' }),
      params(`${id}`),
    );

    expect(res.status).toBe(409);
  });

  it('allows a user to keep their own email', async () => {
    const id = await seed();

    const res = await patchUser(
      request(`/api/admin/users/${id}`, {
        email: alice.email,
        name: 'Renamed',
      }),
      params(`${id}`),
    );

    expect(res.status).toBe(200);
    expect((await readJson<{ user: AdminUser }>(res)).user.name).toBe(
      'Renamed',
    );
  });
});

describe('POST /api/admin/users/[id]/roll-key', () => {
  beforeEach(() => fakeRedis.reset());

  it('requires the confirm token', async () => {
    const id = await seed();

    const res = await rollKey(
      request(`/api/admin/users/${id}/roll-key`, {}),
      params(`${id}`),
    );

    expect(res.status).toBe(400);
  });

  it('issues a new key and keeps the record', async () => {
    const id = await seed();
    const before = await getUser(
      request(`/api/admin/users/${id}`),
      params(`${id}`),
    );
    const previous = (await readJson<AdminUserDetailResponse>(before)).user.key;

    const res = await rollKey(
      request(`/api/admin/users/${id}/roll-key`, { confirm: 'roll' }),
      params(`${id}`),
    );
    const body = await readJson<AdminRollKeyResponse>(res);

    expect(res.status).toBe(200);
    expect(body.previousKey).toBe(previous);
    expect(body.user.key).not.toBe(previous);
    expect(body.user).toMatchObject({ id, ...alice });
  });

  it('404s for an unknown id', async () => {
    const res = await rollKey(
      request('/api/admin/users/99/roll-key', { confirm: 'roll' }),
      params('99'),
    );

    expect(res.status).toBe(404);
  });
});
