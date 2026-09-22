/**
 * The CORS headers every public route answers with.
 *
 * A browser hides a response header from JavaScript unless it is one of the
 * seven CORS-safelisted ones or is named in `Access-Control-Expose-Headers`.
 * None of the headers this API carries protocol on are safelisted, so a
 * cross-origin client that is not told about them can read the body and
 * nothing else: no quota, and no way to find the next page.
 */

/** Request headers a caller may send. */
const ALLOWED_REQUEST_HEADERS = 'Content-Type, Authorization';

/** The methods the tRPC-backed surface answers. */
export const API_METHODS = 'GET, POST, OPTIONS';

/**
 * The response headers every route exposes.
 *
 * `Link` carries both pagination (`rel="next"`) and the successor major
 * (`rel="successor-version"`). The `X-RateLimit-*` trio is the quota that
 * [auth.md](../../../public/auth.md) tells clients to treat as authoritative
 * for their key, and `X-Retry-After` is how a 429 says when to come back.
 */
export const EXPOSED_RESPONSE_HEADERS = [
  'Link',
  'X-RateLimit-Limit',
  'X-RateLimit-Remaining',
  'X-RateLimit-Reset',
  'X-Retry-After',
] as const;

/**
 * One route's CORS headers, lower-cased so they overwrite rather than
 * duplicate whatever the adapter has already set.
 *
 * `alsoExpose` is for headers only one route sets — the range and disposition
 * headers on an asset download, say.
 */
export function corsHeaders(
  methods: string,
  alsoExpose: readonly string[] = [],
): Record<string, string> {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': methods,
    'access-control-allow-headers': ALLOWED_REQUEST_HEADERS,
    'access-control-expose-headers': [
      ...EXPOSED_RESPONSE_HEADERS,
      ...alsoExpose,
    ].join(', '),
  };
}
