import { describe, expect, it, beforeEach, vi } from 'vitest';
import { fakeRedis } from './fakeRedis';

vi.mock('@/lib/redis', () => ({ redis: fakeRedis }));

const {
  addUser,
  updateUser,
  findUserByKey,
  findUserByEmail,
  findUserById,
  findUsersSince,
  listUsers,
  rollApiKey,
} = await import('@/lib/apikeys');

const alice = {
  name: 'Alice Example',
  company: 'Example School',
  email: 'alice@example.com',
};

describe('addUser', () => {
  beforeEach(() => fakeRedis.reset());

  it('stores the record, the email index and an incrementing id', async () => {
    const first = await addUser(alice);
    const second = await addUser({ ...alice, email: 'bob@example.com' });

    const user = await findUserByKey(first, false);
    expect(user).toMatchObject({ id: 1, key: first, ...alice, requests: 0 });
    expect(await fakeRedis.get(`user:email:${alice.email}`)).toBe(first);

    expect((await findUserByKey(second, false))?.id).toBe(2);
  });

  it('defaults the rate limit but keeps an explicit zero', async () => {
    const withDefault = await addUser(alice);
    expect((await findUserByKey(withDefault, false))?.rateLimit).toBe(1000);

    // 0 is the "unlimited" sentinel checked by isUnlimited in rateLimit.ts,
    // so it must survive rather than being treated as "not supplied".
    const unlimited = await addUser({ ...alice, rateLimit: 0 });
    expect((await findUserByKey(unlimited, false))?.rateLimit).toBe(0);
  });

  it('stamps createdAt and updatedAt', async () => {
    const user = await findUserByKey(await addUser(alice), false);

    expect(user?.createdAt).toEqual(expect.any(String));
    expect(user?.updatedAt).toEqual(user?.createdAt);
  });
});

describe('updateUser', () => {
  beforeEach(() => fakeRedis.reset());

  it('leaves unspecified fields alone', async () => {
    const key = await addUser(alice);

    await updateUser({ key, rateLimit: 2000 });

    expect(await findUserByKey(key, false)).toMatchObject({
      ...alice,
      rateLimit: 2000,
    });
  });

  it('sets an unlimited rate limit', async () => {
    const key = await addUser(alice);

    await updateUser({ key, rateLimit: 0 });

    expect((await findUserByKey(key, false))?.rateLimit).toBe(0);
  });

  it('repoints the email index and drops the old one', async () => {
    const key = await addUser(alice);

    await updateUser({ key, email: 'moved@example.com' });

    expect(await fakeRedis.get('user:email:moved@example.com')).toBe(key);
    expect(await fakeRedis.get(`user:email:${alice.email}`)).toBeNull();
    expect((await findUserByEmail('moved@example.com'))?.key).toBe(key);
  });

  it('does not touch the email index when the user had no email', async () => {
    const key = await addUser({ name: 'No Email' });

    await updateUser({ key, rateLimit: 50 });

    expect(fakeRedis.dump('user:email:null')).toBeUndefined();
  });

  it('bumps updatedAt without moving createdAt', async () => {
    const key = await addUser(alice);
    const before = await findUserByKey(key, false);

    vi.setSystemTime(new Date(Date.now() + 1000));
    await updateUser({ key, rateLimit: 2000 });
    vi.useRealTimers();

    const after = await findUserByKey(key, false);
    expect(after?.createdAt).toBe(before?.createdAt);
    expect(after?.updatedAt).not.toBe(before?.updatedAt);
  });

  it('throws for an unknown key', async () => {
    await expect(updateUser({ key: 'nope', rateLimit: 1 })).rejects.toThrow(
      'User does not exist',
    );
  });
});

describe('findUserByKey', () => {
  beforeEach(() => fakeRedis.reset());

  it('only counts the request when asked to', async () => {
    const key = await addUser(alice);

    await findUserByKey(key, false);
    expect((await findUserByKey(key, false))?.requests).toBe(0);

    await findUserByKey(key);
    expect((await findUserByKey(key, false))?.requests).toBe(1);
    expect((await findUserByKey(key, false))?.lastRequest).toEqual(
      expect.any(String),
    );
  });

  it('returns null for an unknown key', async () => {
    expect(await findUserByKey('nope', false)).toBeNull();
  });
});

describe('findUserById', () => {
  beforeEach(() => fakeRedis.reset());

  it('matches on the numeric id and ignores the email index keys', async () => {
    await addUser(alice);
    const second = await addUser({ ...alice, email: 'bob@example.com' });

    expect((await findUserById(2))?.key).toBe(second);
    expect(await findUserById(99)).toBeNull();
  });
});

describe('findUsersSince', () => {
  beforeEach(() => fakeRedis.reset());

  it('returns only users active on or after the date', async () => {
    const recent = await addUser(alice);
    await updateUser({ key: recent, lastRequest: '2026-03-01T00:00:00.000Z' });

    const stale = await addUser({ ...alice, email: 'bob@example.com' });
    await updateUser({ key: stale, lastRequest: '2025-01-01T00:00:00.000Z' });

    // Never requested at all, so it has no lastRequest to compare.
    await addUser({ ...alice, email: 'carol@example.com' });

    const found = await findUsersSince(new Date('2026-02-24'));

    expect(found.map((user) => user.key)).toEqual([recent]);
  });
});

describe('listUsers', () => {
  beforeEach(async () => {
    fakeRedis.reset();
    await addUser({
      name: 'Alice Example',
      company: 'Example School',
      email: 'alice@example.com',
    });
    await addUser({
      name: 'Bob Bloggs',
      company: 'Other Trust',
      email: 'bob@example.com',
    });
    await addUser({
      name: 'Carol Smith',
      company: 'Example School',
      email: 'carol@elsewhere.org',
    });
  });

  it('defaults to newest first', async () => {
    const { users, total } = await listUsers();

    expect(users.map((user) => user.id)).toEqual([3, 2, 1]);
    expect(total).toBe(3);
  });

  it('searches name, company and email case-insensitively', async () => {
    expect((await listUsers({ search: 'BLOGGS' })).total).toBe(1);
    expect((await listUsers({ search: 'example school' })).total).toBe(2);
    expect((await listUsers({ search: '@example.com' })).total).toBe(2);
    expect((await listUsers({ search: 'nobody' })).users).toEqual([]);
  });

  it('finds a user by their api key', async () => {
    const { users } = await listUsers();
    const key = users[0].key;

    expect((await listUsers({ search: key })).users[0].key).toBe(key);
  });

  it('matches any of several comma-separated terms, keys and emails mixed', async () => {
    const { users } = await listUsers({ sort: 'id', direction: 'asc' });
    const [alice, bob, carol] = users;

    const found = await listUsers({
      search: ` ${alice.key} , CAROL@elsewhere.org,, `,
      sort: 'id',
      direction: 'asc',
    });

    expect(found.users.map((user) => user.id)).toEqual([alice.id, carol.id]);
    expect(found.total).toBe(2);
    expect(found.users).not.toContainEqual(bob);
  });

  it('counts a user once when several terms match them', async () => {
    const { total } = await listUsers({ search: 'bob@example.com, bloggs' });

    expect(total).toBe(1);
  });

  it('treats a search of only separators as no search', async () => {
    expect((await listUsers({ search: ' , ,' })).total).toBe(3);
  });

  it('paginates while reporting the unpaginated total', async () => {
    const page = await listUsers({ limit: 2, offset: 2, sort: 'id' });

    expect(page.users).toHaveLength(1);
    expect(page.total).toBe(3);
  });

  it('sorts by a named field', async () => {
    const { users } = await listUsers({ sort: 'name', direction: 'asc' });

    expect(users.map((user) => user.name)).toEqual([
      'Alice Example',
      'Bob Bloggs',
      'Carol Smith',
    ]);
  });
});

describe('rollApiKey', () => {
  beforeEach(() => fakeRedis.reset());

  it('issues a new key and carries the record across', async () => {
    const previousKey = await addUser(alice);
    await findUserByKey(previousKey); // bank a request against the old key

    const result = await rollApiKey(previousKey);

    expect(result.previousKey).toBe(previousKey);
    expect(result.key).not.toBe(previousKey);

    const rolled = await findUserByKey(result.key, false);
    expect(rolled).toMatchObject({ id: 1, requests: 1, ...alice });
    expect(rolled?.createdAt).toBe(result.user.createdAt);

    expect(await findUserByKey(previousKey, false)).toBeNull();
    expect(await fakeRedis.get(`user:email:${alice.email}`)).toBe(result.key);
    expect((await findUserByEmail(alice.email))?.key).toBe(result.key);
  });

  it('throws for an unknown key', async () => {
    await expect(rollApiKey('nope')).rejects.toThrow('No user record found');
  });
});
