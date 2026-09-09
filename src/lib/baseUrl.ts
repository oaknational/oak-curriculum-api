import type { ApiMajor } from '@/lib/apiVersion';

let resolvedOrigin = `http://localhost:${process.env.PORT || 2727}`;

if (process.env.NODE_ENV === 'production' && process.env.VERCEL_BRANCH_URL) {
  resolvedOrigin = `https://${process.env.VERCEL_BRANCH_URL}`;
} else if (process.env.VERCEL_URL) {
  resolvedOrigin = `https://${process.env.VERCEL_URL}`;
}

if (process.env.VERCEL_ENV === 'production' && process.env.PRODUCTION_API_URL) {
  resolvedOrigin = process.env.PRODUCTION_API_URL;
}

export const origin = resolvedOrigin;

/**
 * The absolute base URL of one major of the API.
 *
 * This is interpolated into live response payloads — asset download URLs and
 * pagination links — so it must reflect the major the request arrived on, not a
 * process-wide default. Callers take the major from `ctx.major`.
 */
export function apiBaseUrl(major: ApiMajor): string {
  return `${origin}/api/${major}`;
}

export const assetBaseVideoUrl =
  process.env.VIDEO_URL || 'https://stream.video.thenational.academy';
