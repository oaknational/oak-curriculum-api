import { createHash } from 'node:crypto';
import { PostHog } from 'posthog-node';

import type { ApiMajor } from '@/lib/apiVersion';

export const POSTHOG_CAPTURE_EVENT = 'API Request';
const FALLBACK_DISTINCT_ID = 'api-anonymous';

type QueryParamValue = string | string[];

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

export const createApiKeyFingerprint = (
  apiKey: string | null | undefined,
): string | undefined => {
  if (!apiKey) {
    return undefined;
  }

  const hash = createHash('sha256').update(apiKey).digest('hex');
  const suffix = apiKey.slice(-4);
  return `sha256:${hash.slice(0, 16)}:${suffix}`;
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

export const captureApiRequestEvent = (
  payload: ApiRequestCapturePayload,
): void => {
  const client = getPostHogClient();
  if (!client) {
    return;
  }

  try {
    const captureBody = buildCaptureBody(payload);

    client.capture(captureBody);
  } catch (error: unknown) {
    // Analytics must never interfere with API responses.
    console.error('posthog capture failed', {
      message: error instanceof Error ? error.message : String(error),
      source: payload.source,
      trpcPath: payload.trpcPath || undefined,
    });
  }
};
