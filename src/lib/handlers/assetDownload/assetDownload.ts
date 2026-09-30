import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { TRPCError } from '@trpc/server';
import { TRPC_ERROR_CODES_BY_KEY } from '@trpc/server/rpc';

import type { ApiMajor } from '@/lib/apiVersion';
import type { Context } from '@/lib/context';
import { getApiKeyFromRequest, withUser } from '@/lib/context';

// Map TRPC error codes to HTTP status codes
const trpcErrorCodeToHttpStatus: Record<string, number> = {
  PARSE_ERROR: 400,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_SUPPORTED: 405,
  TIMEOUT: 408,
  CONFLICT: 409,
  PRECONDITION_FAILED: 412,
  PAYLOAD_TOO_LARGE: 413,
  UNPROCESSABLE_CONTENT: 422,
  TOO_MANY_REQUESTS: 429,
  CLIENT_CLOSED_REQUEST: 499,
  INTERNAL_SERVER_ERROR: 500,
};
import {
  getSignedAssetUrl,
  getVideoFromMux,
  listFilesWithMimeType,
} from '@/lib/handlers/assets/helpers';
import { typeToMime, type DownloadTypeEnum } from '@/lib/handlers/assets/types';
import type { SignedAsset, Video } from '@/lib/owaClient';
import { protect } from '@/lib/protect';
import { assetBaseVideoUrl } from '@/lib/baseUrl';
import codes from 'http-codes';
import { assetsForLesson } from '@/lib/handlers/assets/assets';
import placeholderVideoLessons from '@/lib/queryGateData/placeholderVideoLessons.json' with { type: 'json' };
import { getGoogleCloudStorage } from '@/lib/googleCloudStorage';
import {
  captureApiRequestEvent,
  parseQueryParams,
} from '@/lib/analytics/posthogServer';
import { errorFormatter } from '@/lib/trpc';
import { corsHeaders } from '@/lib/api/cors';
import { withSuccessorLink } from '@/lib/api/versionHeaders';
import { assetError, assetLog, describeError } from '@/lib/assetDebugLog';

const storage = getGoogleCloudStorage();

// Every download is a redirect, so the bytes never carry our CORS headers —
// the browser applies the *bucket's* CORS to the signed URL it follows. These
// stay exposed for the redirect itself, and because HEAD callers still read
// them off the 302.
const assetCorsHeaders = corsHeaders('GET, HEAD, OPTIONS', [
  'Accept-Ranges',
  'Content-Disposition',
  'Content-Length',
  'Content-Range',
]);

function createCorsHeaders(): Headers {
  return new Headers(assetCorsHeaders);
}

const hasErrorCode = (error: unknown): error is { code: string } => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  );
};

const handler = async (
  major: ApiMajor,
  req: NextRequest,
  { params }: { params: Promise<{ lesson: string; type: string }> },
): Promise<Response> => {
  // Analytics label, not a route: the major distinguishes traffic between them.
  const endpointPath = `/api/${major}/lessons/{lesson}/assets/{type}`;
  const startedAt = Date.now();
  const apiKey = getApiKeyFromRequest(req);
  const queryParams = parseQueryParams(req.url);
  let args: { lesson: string; type: string } | undefined;
  let userId: number | undefined;

  const resHeaders = createCorsHeaders();

  assetLog('request: start', {
    major,
    method: req.method,
    url: req.url,
    hasApiKey: Boolean(apiKey),
  });

  try {
    // 1. get the user
    const user = await withUser(req, apiKey);
    userId = user?.id;

    assetLog('request: user resolved', { userId, hasUser: Boolean(user) });
    const ctx = {
      user,
      resHeaders,
      req,
      major,
    } as unknown as Context;

    // manually check the protect
    await new Promise<void>((resolve, reject) => {
      protect({
        ctx,
        next: () => Promise.resolve().then(resolve),
        meta: { noCost: false },
      }).catch(reject);
    });

    const resolvedParams = await params;
    let { type } = resolvedParams;
    const { lesson } = resolvedParams;
    args = { lesson, type };

    assetLog('request: params', { lesson, type });

    const { assets } = await assetsForLesson(lesson);

    // Which asset types this lesson actually has, so a 'missing asset' failure
    // can be told apart from a permissions one without a second request.
    assetLog('assets: resolved for lesson', {
      lesson,
      availableTypes: Object.keys(assets ?? {}),
    });

    const usePPTX = type === 'slideDeck';
    if (usePPTX) {
      type = type.replace('PPTX', '');
    }

    const asset = assets[type as DownloadTypeEnum];

    assetLog('assets: selected', {
      type,
      usePPTX,
      found: Boolean(asset),
      // The shape differs per type; the keys alone say which branch we are in.
      assetKeys: asset ? Object.keys(asset) : [],
    });

    // every asset type redirects: videos to the CDN, everything else to a
    // short-lived signed URL on the storage bucket
    let location: string;

    if (type !== 'video') {
      let { bucket_path } = asset as SignedAsset;
      const { bucket_name } = asset as SignedAsset;

      assetLog('storage: asset record', { bucket_name, bucket_path });

      const list = await listFilesWithMimeType(
        storage,
        bucket_name,
        bucket_path.split('/').slice(0, -1).join('/'),
      );

      const ext = usePPTX ? 'pptx' : bucket_path.split('.').pop() || 'pdf';

      const mime = typeToMime.get(ext.toLowerCase());

      assetLog('storage: extension resolved', { ext, mime: mime ?? null });

      if (!mime) {
        throw new TRPCError({
          message: 'Unsupported file type',
          code: 'BAD_REQUEST',
        });
      }

      // find the file with the correct extension (pptx) or file name for pdf
      const found = list.find((file) => {
        if (usePPTX) {
          return file.mimeType === mime;
        } else {
          return file.name === bucket_path;
        }
      });

      assetLog('storage: match in listing', {
        matched: Boolean(found),
        // Without a match we sign `bucket_path` as the database gave it, which
        // is the case most likely to sign an object that is not there.
        signing: found ? found.name : bucket_path,
        fellBackToDatabasePath: !found,
      });

      if (found) {
        bucket_path = found.name;
      }

      const filename = `${lesson}_${type.toLocaleLowerCase()}.${ext.toLowerCase()}`;

      location = await getSignedAssetUrl(
        storage,
        bucket_name,
        bucket_path,
        filename,
      );
    } else {
      const { stream } = asset as Video;
      let { download } = asset as Video;

      if (placeholderVideoLessons.includes(lesson)) {
        throw new TRPCError({
          message: `Failed to fetch: ${lesson} - video is not available`,
          cause: 'Video is a placeholder and not available',
          code: 'NOT_FOUND',
        });
      }

      if (!download) {
        // test if the download is there as our db is often out of sync with mux
        assetLog('video: no download on record, asking mux', { stream });
        download = await getVideoFromMux(stream);
        assetLog('video: mux lookup done', { resolved: Boolean(download) });
      }

      const url = new URL(download || stream);
      url.hostname = new URL(assetBaseVideoUrl).hostname;

      location = url.toString();

      assetLog('video: location resolved', { location });
    }

    captureApiRequestEvent({
      url: req.url,
      apiKey,
      args,
      durationMs: Date.now() - startedAt,
      apiMajor: major,
      endpointPath,
      httpMethod: req.method || 'GET',
      queryParams,
      source: 'lesson_assets_route',
      success: true,
      userId,
    });

    const headers = new Headers(resHeaders);

    headers.set('Location', location);
    // signed URLs expire, so this redirect must not be cached downstream
    headers.set('Cache-Control', 'private, no-store');

    assetLog('request: redirecting', {
      lesson,
      type,
      durationMs: Date.now() - startedAt,
    });

    return new NextResponse(`Redirecting to ${location}`, {
      headers,
      status: 302,
    });
  } catch (e: unknown) {
    let errorCode = 'UNKNOWN_ERROR';
    if (hasErrorCode(e)) {
      errorCode = e.code;
    } else if (e instanceof Error) {
      errorCode = e.name;
    }

    // The innermost catch that still knows which lesson and type were asked
    // for. `route` below reduces this to a message and a code on the way out.
    assetError('request: handler threw', e, {
      args,
      errorCode,
      userId,
      durationMs: Date.now() - startedAt,
    });

    captureApiRequestEvent({
      url: req.url,
      apiKey,
      args,
      durationMs: Date.now() - startedAt,
      apiMajor: major,
      endpointPath,
      errorCode,
      httpMethod: req.method || 'GET',
      queryParams,
      source: 'lesson_assets_route',
      success: false,
      userId,
    });

    throw e;
  }
};

async function handlerWrapper(
  major: ApiMajor,
  req: NextRequest,
  { params }: { params: Promise<{ lesson: string; type: string }> },
): Promise<Response> {
  // Wrapped once here so the successor link reaches the asset 302 and both
  // error paths alike.
  return withSuccessorLink(await route(major, req, { params }), major);
}

async function route(
  major: ApiMajor,
  req: NextRequest,
  { params }: { params: Promise<{ lesson: string; type: string }> },
): Promise<Response> {
  try {
    return await handler(major, req, { params });
  } catch (e: unknown) {
    const { code, message } = e as { code: string; message: string };

    // The response below carries only `message` and `code`, so the stack and
    // any wrapped `cause` end here unless they are logged first.
    assetError('response: converting error', e, {
      isTRPCError: e instanceof TRPCError,
      url: req.url,
    });

    // if this is a TRPCError, we can map the code to status codes
    if (e instanceof TRPCError) {
      const errorPayload = errorFormatter({
        error: e,
        shape: {
          code: TRPC_ERROR_CODES_BY_KEY[e.code],
          message: e.message,
          data: {
            path: req.url,
            code: e.code,
            httpStatus:
              trpcErrorCodeToHttpStatus[e.code] ||
              trpcErrorCodeToHttpStatus.INTERNAL_SERVER_ERROR,
          },
        },
      });

      const status =
        trpcErrorCodeToHttpStatus[e.code] ||
        trpcErrorCodeToHttpStatus.INTERNAL_SERVER_ERROR;

      assetLog('response: trpc error', { status, code: e.code });

      return new NextResponse(
        JSON.stringify({ ...errorPayload, code: e.code }),
        {
          status,
          headers: {
            ...assetCorsHeaders,
            'Content-Type': 'application/json',
          },
        },
      );
    }

    const statusCode =
      typeof code === 'string' && code in codes
        ? codes[code as keyof typeof codes]
        : 500;

    // A non-string `code` (Google's `ApiError` uses a number) never maps, so
    // an upstream 403 leaves here as a 500. Worth seeing both numbers.
    assetLog('response: non-trpc error', {
      statusCode,
      code: code ?? null,
      mapped: typeof code === 'string' && code in codes,
      error: describeError(e),
    });

    return new NextResponse(JSON.stringify({ message, code }), {
      status: statusCode,
      headers: {
        ...assetCorsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
}

/** The route's CORS preflight; identical for every major. */
export function assetDownloadPreflight(): Response {
  return new NextResponse(null, {
    status: 204,
    headers: createCorsHeaders(),
  });
}

/**
 * The asset download route for one major.
 *
 * This route streams bytes and issues CDN redirects, so it sits outside the
 * tRPC surface and each major mounts it directly.
 */
export function createAssetDownloadHandler(major: ApiMajor) {
  return (
    req: NextRequest,
    ctx: { params: Promise<{ lesson: string; type: string }> },
  ): Promise<Response> => handlerWrapper(major, req, ctx);
}
