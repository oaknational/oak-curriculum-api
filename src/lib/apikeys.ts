import { redis } from '@/lib/redis';
import { defaultRateLimit } from './rateLimit';
import { v4 as uuid } from 'uuid';

export interface UserUpdate {
  email?: null | string;
  name?: null | string;
  company?: null | string;
  rateLimit?: number;
  key?: string;
  requests?: number;
  lastRequest?: string; // as JSON string
}

export type UserUpdateWithKey = UserUpdate & {
  key: string; // enforced
};

export type User = UserUpdate & {
  key: string; // enforced
  id: number;
  createdAt?: string; // absent on records created before these were added
  updatedAt?: string;
};

// Fields `updateUser` will write. `id`, `key` and the timestamps are managed
// here rather than by callers.
const UPDATABLE_FIELDS = [
  'email',
  'name',
  'company',
  'rateLimit',
  'requests',
  'lastRequest',
] as const;

/**
 * Applies the defaults and coercions every read path needs, in one place.
 * Redis hands back whatever was written, so `id` can arrive as a string and
 * `rateLimit` can be missing entirely on older records.
 */
function normaliseUser(user: User): User {
  user.id = Number(user.id);

  if (user.rateLimit === undefined || user.rateLimit === null) {
    user.rateLimit = defaultRateLimit;
  }

  return user;
}

async function readUserRecord(key: string): Promise<User | null> {
  const record = await redis.hgetall(`user:${key}`);

  if (!record || Object.keys(record).length === 0) {
    return null;
  }

  return record as unknown as User;
}

/**
 * A v4 uuid that isn't already in use. Collisions are vanishingly unlikely,
 * but silently overwriting a live user's record would be unrecoverable.
 */
export async function generateUniqueApiKey(attempts = 5): Promise<string> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const candidate = uuid();
    if (!(await redis.exists(`user:${candidate}`))) {
      return candidate;
    }
  }

  throw new Error(
    'Unable to generate a unique API key after multiple attempts.',
  );
}

export async function addUser(opts: UserUpdate = {}): Promise<string> {
  const key = opts.key ?? (await generateUniqueApiKey());
  const now = new Date().toJSON();
  const id = await redis.incr('next_user_id');

  const user = {
    id,
    key,
    email: opts.email ?? null,
    name: opts.name ?? null,
    company: opts.company ?? null,
    // `??` not `||`: 0 is the "unlimited" sentinel, not "unset".
    rateLimit: opts.rateLimit ?? defaultRateLimit,
    requests: opts.requests ?? 0,
    createdAt: now,
    updatedAt: now,
  };

  await redis.hset(`user:${key}`, user);

  if (user.email) {
    await redis.set(`user:email:${user.email}`, key);
  }

  return key;
}

/**
 * Partial update. Only fields explicitly present on `opts` are written, so
 * `updateUser({ key, rateLimit: 2000 })` cannot clear the user's name. The
 * guard is `!== undefined` rather than truthiness so that `null` and `0` are
 * treated as real values.
 */
export async function updateUser(opts: UserUpdateWithKey): Promise<string> {
  if (!opts.key) {
    throw new Error('opts.key is required');
  }

  const existing = await readUserRecord(opts.key);

  if (!existing) {
    throw new Error('User does not exist');
  }

  const updates: Record<string, unknown> = {};

  for (const field of UPDATABLE_FIELDS) {
    if (opts[field] !== undefined) {
      updates[field] = opts[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return opts.key;
  }

  updates.updatedAt = new Date().toJSON();

  if (typeof opts.email === 'string' && opts.email !== existing.email) {
    if (existing.email) {
      await redis.del(`user:email:${existing.email}`);
    }
    await redis.set(`user:email:${opts.email}`, opts.key);
  }

  await redis.hset(`user:${opts.key}`, updates);

  return opts.key;
}

export async function findUserByKey(
  key: string,
  log = true,
): Promise<User | null> {
  const record = await readUserRecord(key);

  if (!record) {
    return null;
  }

  // track how many requests in total (for a fast way to find busy
  // or idle users)
  if (log) {
    await redis.hincrby(`user:${key}`, 'requests', 1);
    await redis.hset(`user:${key}`, { lastRequest: new Date().toJSON() });
  }

  return normaliseUser(record);
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const key = (await redis.get(`user:email:${email}`)) as string;
  if (!key) {
    return null;
  }
  return findUserByKey(key, false);
}

/**
 * Every user record, as one KEYS plus one pipelined HGETALL.
 *
 * Deliberate ceiling: this is sized for the hundreds of users we have, and
 * costs two round trips regardless of how many that is. KEYS is O(keyspace) on
 * the Redis side, so if this grows past a couple of thousand users, swap it for
 * a SCAN loop or maintain a `users:index` sorted set. Do not add either yet.
 */
async function allUserRecords(): Promise<User[]> {
  const keys = (await redis.keys('user:*')).filter(
    (key: string) => !key.startsWith('user:email:'),
  );

  if (keys.length === 0) {
    return [];
  }

  const pipeline = redis.pipeline();
  for (const key of keys) {
    pipeline.hgetall(key);
  }
  const records = await pipeline.exec<(User | null)[]>();

  return records
    .filter(
      (record: User | null): record is User =>
        !!record && Object.keys(record).length > 0,
    )
    .map(normaliseUser);
}

export async function findUserById(id: number): Promise<User | null> {
  const users = await allUserRecords();
  return users.find((user) => user.id === id) ?? null;
}

export async function findUsersSince(since: Date): Promise<User[]> {
  const users = await allUserRecords();
  return users.filter(
    (user) => user.lastRequest && new Date(user.lastRequest) >= since,
  );
}

export type UserSortField =
  'id' | 'name' | 'company' | 'email' | 'requests' | 'lastRequest';

export interface ListUsersOptions {
  search?: string;
  limit?: number;
  offset?: number;
  sort?: UserSortField;
  direction?: 'asc' | 'desc';
}

export interface ListUsersResult {
  users: User[];
  /** Count after filtering, not the length of this page. */
  total: number;
}

/**
 * A search may hold several comma-separated terms ("alice@example.com, 3f2a…")
 * of any mix; a user matches if any one of them does.
 */
function searchTerms(search: string): string[] {
  return search
    .split(',')
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean);
}

function matchesSearch(user: User, terms: string[]): boolean {
  const fields = [
    user.name,
    user.company,
    user.email,
    user.key,
    String(user.id),
  ].map((field) => field?.toLowerCase());

  return terms.some((term) => fields.some((field) => field?.includes(term)));
}

function compareUsers(a: User, b: User, sort: UserSortField): number {
  const left = a[sort];
  const right = b[sort];

  if (left === right) return 0;
  // Users with no value for the sort field always sort last.
  if (left === undefined || left === null) return 1;
  if (right === undefined || right === null) return -1;

  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }

  return String(left).localeCompare(String(right), 'en-GB');
}

/**
 * Note that `limit`/`offset` only save bytes on the wire — `total` needs the
 * full scan regardless, so they do not reduce the work Redis does.
 */
export async function listUsers({
  search,
  limit = 50,
  offset = 0,
  sort = 'id',
  direction = 'desc',
}: ListUsersOptions = {}): Promise<ListUsersResult> {
  let users = await allUserRecords();

  const terms = searchTerms(search ?? '');

  if (terms.length > 0) {
    users = users.filter((user) => matchesSearch(user, terms));
  }

  users.sort((a, b) => compareUsers(a, b, sort));
  if (direction === 'desc') {
    users.reverse();
  }

  return {
    users: users.slice(offset, offset + limit),
    total: users.length,
  };
}

export interface RollApiKeyResult {
  previousKey: string;
  key: string;
  user: User;
}

/**
 * Issues a new API key for an existing user, preserving id, counters and
 * createdAt.
 *
 * Order matters: write the new record, repoint the email index, then delete the
 * old record. A failure part-way leaves a duplicate record (the old key still
 * works) rather than an email index pointing at nothing.
 *
 * Side effect worth surfacing to whoever triggers this: the sliding-window
 * counters are keyed by API key, so rolling resets the user's current-hour
 * quota.
 */
export async function rollApiKey(
  currentKey: string,
): Promise<RollApiKeyResult> {
  const existing = await readUserRecord(currentKey);

  if (!existing) {
    throw new Error(`No user record found for key ${currentKey}`);
  }

  const key = await generateUniqueApiKey();
  const next = { ...existing, key, updatedAt: new Date().toJSON() };

  await redis.hset(`user:${key}`, next);

  if (next.email) {
    await redis.set(`user:email:${next.email}`, key);

    if ((await redis.get(`user:email:${next.email}`)) !== key) {
      throw new Error('Email lookup was not updated to the new API key.');
    }
  }

  await redis.del(`user:${currentKey}`);

  return { previousKey: currentKey, key, user: normaliseUser(next) };
}
