/**
 * Discovery logging for the asset download pipeline.
 *
 * Off unless `ASSET_DEBUG_LOG` is `1` or `true`, because this is chatty and
 * sits on the hot path of every download. Set it on a preview deployment to
 * trace a failing download end to end, then unset it again.
 *
 * Everything here is prefixed with `[asset-download]` so a preview deployment's
 * logs can be filtered down to this one journey, and so the whole lot can be
 * found and removed again once the redirect work has settled.
 *
 * Two things this deliberately does that a bare `console.log` does not:
 *
 * 1. It serialises to JSON. Node's console truncates nested objects below two
 *    levels deep and Vercel's log viewer trims long lines, which is how a
 *    Google Cloud `ApiError` ends up on screen as a useful-looking object with
 *    the reason buried in an elided `[Object]`.
 * 2. It picks error fields by hand rather than stringifying the error. A GCS
 *    `ApiError` carries the whole HTTP response, streams and circular
 *    references included, which `JSON.stringify` cannot serialise at all.
 */

const PREFIX = '[asset-download]';

type Detail = Record<string, unknown>;

/**
 * Read per call rather than once at module load, so that flipping the variable
 * on a deployment takes effect without a rebuild, and so tests can toggle it.
 */
function isEnabled(): boolean {
  const flag = process.env.ASSET_DEBUG_LOG;

  return flag === '1' || flag === 'true';
}

/** How far to follow an error's `cause` chain before giving up. */
const MAX_CAUSE_DEPTH = 4;

interface DescribedError {
  name?: string;
  message?: string;
  /** String on Node errors (`ENOENT`), a number on Google's `ApiError`. */
  code?: string | number;
  status?: number;
  /** Google's per-reason breakdown: this is where `forbidden` shows up. */
  errors?: unknown;
  /** Google surfaces the HTTP status here when `code` is absent. */
  responseStatus?: number;
  stack?: string;
  cause?: DescribedError | string;
}

function asRecord(value: unknown): Detail | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Detail)
    : undefined;
}

/**
 * Flatten an error into something `JSON.stringify` can handle, following the
 * `cause` chain so a `TRPCError` wrapping a Google 403 still shows the 403.
 */
export function describeError(error: unknown, depth = 0): DescribedError {
  const record = asRecord(error);

  if (!record) {
    return { message: String(error) };
  }

  const described: DescribedError = {};

  if (typeof record.name === 'string') described.name = record.name;
  if (typeof record.message === 'string') described.message = record.message;
  if (typeof record.code === 'string' || typeof record.code === 'number') {
    described.code = record.code;
  }
  if (typeof record.status === 'number') described.status = record.status;
  if (Array.isArray(record.errors)) described.errors = record.errors;
  if (typeof record.stack === 'string') described.stack = record.stack;

  const response = asRecord(record.response);
  if (response && typeof response.statusCode === 'number') {
    described.responseStatus = response.statusCode;
  }

  if (record.cause !== undefined && record.cause !== null) {
    described.cause =
      depth >= MAX_CAUSE_DEPTH
        ? '(cause chain truncated)'
        : describeError(record.cause, depth + 1);
  }

  return described;
}

function serialise(detail: Detail): string {
  try {
    return JSON.stringify(detail);
  } catch (error) {
    // Never let the logging be the thing that fails the request.
    return `(unserialisable: ${String(error)})`;
  }
}

/** A step completed. Silent unless `ASSET_DEBUG_LOG` is set. */
export function assetLog(stage: string, detail: Detail = {}): void {
  if (!isEnabled()) {
    return;
  }

  console.log(`${PREFIX} ${stage} ${serialise(detail)}`);
}

/**
 * A step threw. The error is unwrapped; the surrounding context is not.
 * Silent unless `ASSET_DEBUG_LOG` is set — the route still returns its error
 * to the caller either way.
 */
export function assetError(
  stage: string,
  error: unknown,
  detail: Detail = {},
): void {
  if (!isEnabled()) {
    return;
  }

  console.error(
    `${PREFIX} ${stage} FAILED ${serialise({
      ...detail,
      error: describeError(error),
    })}`,
  );
}

/**
 * The claims of a JWT, without the token. Used to check what Vercel actually
 * stamped into the OIDC token, because a mismatched `aud` is the usual reason
 * Google's STS rejects the exchange, and the rejection never says so.
 *
 * Decode only — the signature is neither checked nor logged.
 */
export function describeOidcClaims(token: string): Detail {
  try {
    const payload = token.split('.')[1];

    if (!payload) {
      return { decoded: false, reason: 'not a three-part JWT' };
    }

    const claims = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as Detail;

    const expiresAt =
      typeof claims.exp === 'number'
        ? new Date(claims.exp * 1000).toISOString()
        : undefined;

    return {
      decoded: true,
      aud: claims.aud,
      iss: claims.iss,
      sub: claims.sub,
      owner: claims.owner,
      project_id: claims.project_id,
      environment: claims.environment,
      expiresAt,
      expired:
        typeof claims.exp === 'number'
          ? claims.exp * 1000 < Date.now()
          : undefined,
    };
  } catch (error) {
    return { decoded: false, reason: String(error) };
  }
}

/**
 * A signed URL with its signature stripped, so a log line can show which object
 * was signed without handing out a working credential.
 */
export function describeSignedUrl(url: string): Detail {
  try {
    const parsed = new URL(url);

    return {
      origin: parsed.origin,
      pathname: parsed.pathname,
      expires: parsed.searchParams.get('X-Goog-Expires'),
      credential: parsed.searchParams.get('X-Goog-Credential'),
      length: url.length,
    };
  } catch {
    return { unparseable: true, length: url.length };
  }
}
