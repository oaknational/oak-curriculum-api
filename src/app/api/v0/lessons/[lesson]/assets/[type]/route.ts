import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { TRPCError } from '@trpc/server';
import { TRPC_ERROR_CODES_BY_KEY } from '@trpc/server/rpc';

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
import { getGoogleCloudStorage } from '@/lib/bulk-data/data-stores';
import {
  captureApiRequestEvent,
  parseQueryParams,
} from '@/lib/analytics/posthogServer';
import { errorFormatter } from '@/lib/trpc';

export const dynamic = 'force-dynamic';

const storage = getGoogleCloudStorage();
const endpointPath = '/api/v0/lessons/{lesson}/assets/{type}';

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, OPTIONS',
  'access-control-allow-headers': 'Content-Type, Authorization',
  'access-control-expose-headers':
    'Accept-Ranges, Content-Disposition, Content-Length, Content-Range',
} as const;

function createCorsHeaders(): Headers {
  return new Headers(corsHeaders);
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
  req: NextRequest,
  { params }: { params: Promise<{ lesson: string; type: string }> },
): Promise<Response> => {
  const startedAt = Date.now();
  const apiKey = getApiKeyFromRequest(req);
  const queryParams = parseQueryParams(req.url);
  let args: { lesson: string; type: string } | undefined;
  let userId: number | undefined;

  const resHeaders = createCorsHeaders();

  try {
    // 1. get the user
    const user = await withUser(req, apiKey);
    userId = user?.id;
    const ctx = {
      user,
      resHeaders,
      req,
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

    const { assets } = await assetsForLesson(lesson);

    const usePPTX = type === 'slideDeck';
    if (usePPTX) {
      type = type.replace('PPTX', '');
    }

    const asset = assets[type as DownloadTypeEnum];

    // every asset type redirects: videos to the CDN, everything else to a
    // short-lived signed URL on the storage bucket
    let location: string;

    if (type !== 'video') {
      let { bucket_path } = asset as SignedAsset;
      const { bucket_name } = asset as SignedAsset;

      const list = await listFilesWithMimeType(
        storage,
        bucket_name,
        bucket_path.split('/').slice(0, -1).join('/'),
      );

      const ext = usePPTX ? 'pptx' : bucket_path.split('.').pop() || 'pdf';

      const mime = typeToMime.get(ext.toLowerCase());

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
        download = await getVideoFromMux(stream);
      }

      const url = new URL(download || stream);
      url.hostname = new URL(assetBaseVideoUrl).hostname;

      location = url.toString();
    }

    captureApiRequestEvent({
      url: req.url,
      apiKey,
      args,
      durationMs: Date.now() - startedAt,
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

    captureApiRequestEvent({
      url: req.url,
      apiKey,
      args,
      durationMs: Date.now() - startedAt,
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
  req: NextRequest,
  { params }: { params: Promise<{ lesson: string; type: string }> },
): Promise<Response> {
  try {
    return await handler(req, { params });
  } catch (e: unknown) {
    const { code, message } = e as { code: string; message: string };

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

      return new NextResponse(
        JSON.stringify({ ...errorPayload, code: e.code }),
        {
          status,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      );
    }

    const statusCode =
      typeof code === 'string' && code in codes
        ? codes[code as keyof typeof codes]
        : 500;

    return new NextResponse(JSON.stringify({ message, code }), {
      status: statusCode,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
}

function OPTIONS(): Response {
  return new NextResponse(null, {
    status: 204,
    headers: createCorsHeaders(),
  });
}

export {
  handlerWrapper as GET,
  handlerWrapper as POST,
  handlerWrapper as PUT,
  handlerWrapper as PATCH,
  handlerWrapper as DELETE,
  OPTIONS,
  handlerWrapper as HEAD,
};
