import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { captureApiKeyCreatedEvent } from '@/lib/analytics/posthogServer';
import {
  addUser,
  findUserByEmail,
  findUserByKey,
  listUsers,
} from '@/lib/apikeys';
import { jsonError, jsonServerError } from '../responses';
import type { AdminUserResponse, AdminUsersResponse } from '../schemas';
import {
  createUserSchema,
  listUsersQuerySchema,
  toAdminUser,
} from '../schemas';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const query = listUsersQuerySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );

  if (!query.success) {
    return jsonError(400, 'Invalid query', query.error);
  }

  const { search, limit, offset, sort, direction } = query.data;

  try {
    const { users, total } = await listUsers({
      search,
      limit,
      offset,
      sort,
      direction,
    });

    return NextResponse.json<AdminUsersResponse>({
      users: users.map(toAdminUser),
      total,
      limit,
      offset,
    });
  } catch (error) {
    return jsonServerError('Error listing API users:', error);
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'Invalid JSON body');
  }

  const parsed = createUserSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(400, 'Invalid request', parsed.error);
  }

  const { name, company, email, rateLimit } = parsed.data;

  try {
    // Without this, a second key for the same address repoints the email index
    // and orphans the first record: it keeps working but can no longer be
    // found by email, so rolling the key would then hit the wrong record.
    if (await findUserByEmail(email)) {
      return jsonError(409, 'A user already exists with that email address');
    }

    const key = await addUser({ name, company, email, rateLimit });
    const user = await findUserByKey(key, false);

    if (!user) {
      return jsonServerError(
        'Error creating API user:',
        new Error('User was not readable immediately after creation'),
      );
    }

    captureApiKeyCreatedEvent({
      apiKey: user.key,
      company: user.company,
      rateLimit: user.rateLimit,
      source: 'admin_users_route',
      userId: user.id,
    });

    return NextResponse.json<AdminUserResponse>(
      { user: toAdminUser(user) },
      { status: 201 },
    );
  } catch (error) {
    return jsonServerError('Error creating API user:', error);
  }
}
