import { createHash } from 'node:crypto';
import { PostHog } from 'posthog-node';

import type { ApiMajor } from '@/lib/apiVersion';

export const POSTHOG_CAPTURE_EVENT = 'API Request';
export const POSTHOG_API_KEY_CREATED_EVENT = 'API Key Created';
const FALLBACK_DISTINCT_ID = 'api-anonymous';

type QueryParamValue = string | string[];

interface CaptureBody {
  distinctId: string;
  event: string;
  properties: Record<string, unknown>;
}

export interface ApiRequestCapturePayload {
  url?: string;
  apiKey?: string | null;
  /**
   * The URL major the request arrived on, for the versioned API.
   *
   * Kept separate from `endpointPath` rather than folded into it, so that
   * charts built on the version-free path stay continuous across the split and
   * can still be broken down by major. Absent for unversioned routes.
   */
  apiMajor?: ApiMajor;
  args?: unknown;
  /**
   * The requesting user's `company`, as they typed it when signing up. Hashed
   * before it leaves here — see `createCompanyHash`.
   */
  company?: string | null;
  durationMs?: number;
  endpointPath: string;
  errorCode?: string | null;
  httpMethod?: string | null;
  queryParams?: Record<string, QueryParamValue>;
  source:
    'trpc_middleware' | 'trpc_on_error' | 'bulk_route' | 'lesson_assets_route';
  success: boolean;
  trpcPath?: string | null;
  userId?: number | string | null;
}

export interface ApiKeyCreatedCapturePayload {
  /** The key just issued. Only ever sent on as a fingerprint and a hash. */
  apiKey: string;
  /** The company the key was registered to, hashed like every other event. */
  company?: string | null;
  rateLimit?: number;
  source: 'admin_users_route';
  userId?: number | string | null;
}

const getPostHogApiKey = (): string | undefined => {
  return process.env.POSTHOG_API_KEY || process.env.NEXT_PUBLIC_POSTHOG_API_KEY;
};

const getPostHogApiHost = (): string | undefined => {
  return (
    process.env.POSTHOG_API_HOST || process.env.NEXT_PUBLIC_POSTHOG_API_HOST
  );
};

const normaliseApiHost = (apiHost: string): string => {
  return apiHost.endsWith('/') ? apiHost.slice(0, -1) : apiHost;
};

let postHogClient: PostHog | undefined;

const getPostHogClient = (): PostHog | undefined => {
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.TEST ||
    process.env.VITEST
  ) {
    return undefined;
  }

  const posthogApiKey = getPostHogApiKey();
  const posthogApiHost = getPostHogApiHost();
  if (!posthogApiKey || !posthogApiHost) {
    console.log(
      'PostHog API key or host not configured, analytics will be disabled',
    );
    return undefined;
  }

  if (postHogClient) {
    return postHogClient;
  }

  postHogClient = new PostHog(posthogApiKey, {
    flushAt: 1,
    host: normaliseApiHost(posthogApiHost),
  });

  return postHogClient;
};

export const parseQueryParams = (
  url: string | null | undefined,
): Record<string, QueryParamValue> | undefined => {
  if (!url) {
    return undefined;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return undefined;
  }

  if (!parsedUrl.search) {
    return undefined;
  }

  const query: Record<string, QueryParamValue> = {};
  for (const key of parsedUrl.searchParams.keys()) {
    const values = parsedUrl.searchParams.getAll(key);
    if (values.length === 0) {
      continue;
    }
    query[key] = values.length === 1 ? values[0] : values;
  }

  if (Object.keys(query).length === 0) {
    return undefined;
  }

  return query;
};

export const serialiseAnalyticsValue = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return undefined;
  }

  try {
    return JSON.parse(
      JSON.stringify(value, (_key, currentValue: unknown) => {
        if (typeof currentValue === 'bigint') {
          return currentValue.toString();
        }
        if (currentValue instanceof Date) {
          return currentValue.toISOString();
        }
        return currentValue;
      }),
    ) as unknown;
  } catch {
    return undefined;
  }
};

/** Truncated sha256: short enough to read in PostHog, wide enough not to collide. */
const hashToHex = (value: string): string => {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
};

export const createApiKeyFingerprint = (
  apiKey: string | null | undefined,
): string | undefined => {
  if (!apiKey) {
    return undefined;
  }

  const suffix = apiKey.slice(-4);
  return `sha256:${hashToHex(apiKey)}:${suffix}`;
};

/**
 * Values people type into the company field to mean "I haven't got one". These
 * are not companies, so they must not collapse 144-odd unrelated users into a
 * single "n/a" organisation.
 *
 * Deliberately short: the real data contains genuine three- and four-letter
 * companies ("oat", "ona", "mei"), so anything ambiguous stays out.
 */
const PLACEHOLDER_COMPANIES = new Set([
  '-',
  'n.a.',
  'n/a',
  'na',
  'nil',
  'none',
  'null',
]);

/**
 * Lower-cases and strips whitespace so that "Vision", "vision" and "Vis ion"
 * are one organisation rather than three. Returns undefined for anything that
 * isn't a usable company name.
 */
export const normaliseCompanyName = (
  company: string | null | undefined,
): string | undefined => {
  if (!company) {
    return undefined;
  }

  const normalised = company.toLowerCase().replace(/\s+/g, '');

  if (!normalised || PLACEHOLDER_COMPANIES.has(normalised)) {
    return undefined;
  }

  return normalised;
};

export interface CompanyHash {
  hash: string;
  /**
   * Which input the hash was taken of. `api_key` means the user gave no usable
   * company, so the hash stands for that one user rather than an organisation
   * — worth excluding when counting organisations.
   */
  source: 'company' | 'api_key';
}

/**
 * A stable, non-reversible id for the organisation behind a request, so that
 * twenty teachers at one school read as one user of the API.
 *
 * Falls back to the API key when there's no usable company name: without it
 * those requests would share one bucket and look like a single huge customer.
 */
export const createCompanyHash = (opts: {
  company?: string | null;
  apiKey?: string | null;
}): CompanyHash | undefined => {
  const company = normaliseCompanyName(opts.company);

  if (company) {
    return { hash: hashToHex(company), source: 'company' };
  }

  if (opts.apiKey) {
    return { hash: hashToHex(opts.apiKey), source: 'api_key' };
  }

  return undefined;
};

export const getDistinctId = (opts: {
  userId?: number | string | null;
  apiKey?: string | null;
}): string => {
  if (opts.userId !== null && opts.userId !== undefined) {
    return `api-user:${opts.userId}`;
  }

  const fingerprint = createApiKeyFingerprint(opts.apiKey);
  if (fingerprint) {
    return `api-key:${fingerprint}`;
  }

  return FALLBACK_DISTINCT_ID;
};

const buildCaptureBody = (
  payload: ApiRequestCapturePayload,
): {
  distinctId: string;
  event: string;
  properties: Record<string, unknown>;
} => {
  const apiKeyFingerprint = createApiKeyFingerprint(payload.apiKey);
  const companyHash = createCompanyHash({
    company: payload.company,
    apiKey: payload.apiKey,
  });
  const distinctId = getDistinctId({
    userId: payload.userId,
    apiKey: payload.apiKey,
  });

  return {
    event: POSTHOG_CAPTURE_EVENT,
    distinctId,
    properties: {
      $current_url: payload.url,
      api_major: payload.apiMajor,
      args: serialiseAnalyticsValue(payload.args),
      company_hash: companyHash?.hash,
      company_hash_source: companyHash?.source,
      duration_ms: payload.durationMs,
      endpoint_path: payload.endpointPath,
      error_code: payload.errorCode || undefined,
      http_method: payload.httpMethod || undefined,
      query_params: payload.queryParams,
      source: payload.source,
      success: payload.success,
      trpc_path: payload.trpcPath || undefined,
      user_id: payload.userId ?? undefined,
      api_key_fingerprint: apiKeyFingerprint,
    },
  };
};

/**
 * Builds and sends one event, swallowing every failure: analytics must never
 * interfere with an API response or with issuing a key.
 *
 * The body is built inside the try so that a malformed payload is logged
 * rather than thrown at the caller.
 */
const captureEvent = (
  buildBody: () => CaptureBody,
  context: Record<string, unknown>,
): void => {
  const client = getPostHogClient();
  if (!client) {
    return;
  }

  try {
    client.capture(buildBody());
  } catch (error: unknown) {
    console.error('posthog capture failed', {
      message: error instanceof Error ? error.message : String(error),
      ...context,
    });
  }
};

export const captureApiRequestEvent = (
  payload: ApiRequestCapturePayload,
): void => {
  captureEvent(() => buildCaptureBody(payload), {
    source: payload.source,
    trpcPath: payload.trpcPath || undefined,
  });
};

/**
 * One key issued. Emitted from the admin route rather than from `addUser`, so
 * that `@/lib/apikeys` — imported by every request path and by the CLI scripts
 * — doesn't drag `posthog-node` in with it.
 */
export const captureApiKeyCreatedEvent = (
  payload: ApiKeyCreatedCapturePayload,
): void => {
  captureEvent(
    () => {
      const companyHash = createCompanyHash({
        company: payload.company,
        apiKey: payload.apiKey,
      });

      return {
        event: POSTHOG_API_KEY_CREATED_EVENT,
        distinctId: getDistinctId({
          userId: payload.userId,
          apiKey: payload.apiKey,
        }),
        properties: {
          api_key_fingerprint: createApiKeyFingerprint(payload.apiKey),
          company_hash: companyHash?.hash,
          company_hash_source: companyHash?.source,
          rate_limit: payload.rateLimit,
          source: payload.source,
          user_id: payload.userId ?? undefined,
        },
      };
    },
    { source: payload.source },
  );
};
