import { initTRPC, TRPCDefaultErrorShape, TRPCError } from '@trpc/server';
import util from 'node:util';
import superjson from 'superjson';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { ZodError } from 'zod';

import {
  captureApiRequestEvent,
  parseQueryParams,
} from '@/lib/analytics/posthogServer';
import type { ApiMajor } from '@/lib/apiVersion';
import { getApiKeyFromRequest } from '@/lib/context';
import type { Context } from '@/lib/context';

const extraDebug = process.env.NODE_ENV === 'development';

/**
 * Procedure metadata, extending `trpc-to-openapi`'s with our own keys.
 *
 * The `openapi` object is a closed type, so version metadata sits beside it
 * rather than inside it. Intersecting on top of `OpenApiMeta` keeps its
 * `Record<string, unknown>` index signature, which is what makes the router
 * assignable to `OpenApiRouter`.
 */
export type ApiMeta = OpenApiMeta & {
  /**
   * The first major to serve this procedure. Absent means the latest major
   * only, so a new procedure is kept out of every frozen major by default.
   */
  addedIn?: ApiMajor;
  /** The first major to stop serving it, when an endpoint is superseded. */
  removedIn?: ApiMajor;
  /** Whether the call is exempt from consuming rate-limit quota. */
  noCost?: boolean;
};

export const t = initTRPC.context<Context>().meta<ApiMeta>().create({
  transformer: superjson,
  errorFormatter,
});

export function errorFormatter({
  shape,
  error,
}: {
  shape: TRPCDefaultErrorShape;
  error: TRPCError;
}) {
  if (extraDebug) {
    if (error.code === 'INTERNAL_SERVER_ERROR') {
      if (error.cause && error.cause instanceof ZodError) {
        const cause = error.cause;

        console.error(
          'trpc error',
          util.inspect(
            {
              type: 'ZodError',
              errors: cause.issues,
              trpcPath: shape.data.path,
            },
            { depth: null, colors: true },
          ),
        );
      } else {
        console.error('trpc error', {
          code: error.code,
          message: shape.message,
          trpcPath: shape.data.path,
          line: shape.data.stack?.split('\n')[1].trim(),
        });
      }
    } else {
      console.error('trpc error', {
        code: error.code,
        message: shape.message,
      });
    }
  }

  let customCause = true;

  if (
    error.cause &&
    typeof error.cause === 'object' &&
    Object.keys(error.cause).length > 0
  ) {
    customCause = false;
  }

  interface Reply {
    message: string;
    data?: {
      trace?: string;
      cause?: string;
    };
  }

  const reply: Reply = {
    message: shape.data.path
      ? shape.message
      : 'Not found - non existent endpoint',
    data: {},
  };

  if (reply.data) {
    if (customCause && error.cause?.toString()) {
      reply.data.cause = error.cause?.toString();
    }

    if (extraDebug && shape.data.stack && reply.data) {
      // if dev, surface all the errors to our hard-working developers
      const traceLine = shape.data.stack
        .split('\n')
        .find((_) => _.trim().startsWith('at '));

      if (traceLine) {
        reply.data.trace = traceLine.trim();
      }
    }

    if (reply.data && Object.keys(reply.data).length === 0) {
      delete reply.data;
    }
  }

  return reply;
}

const analyticsMiddleware = t.middleware(async (opts) => {
  const startedAt = Date.now();

  const openApiMeta = opts.meta?.openapi;
  const endpointPath = openApiMeta?.path || opts.path;
  const httpMethod = openApiMeta?.method || opts.ctx.req.method;
  const apiKey = opts.ctx.apiKey ?? getApiKeyFromRequest(opts.ctx.req);
  const queryParams = parseQueryParams(opts.ctx.req.url);
  const args =
    opts.input !== undefined
      ? opts.input
      : await opts
          .getRawInput()
          .then((value) => value)
          .catch(() => undefined);

  const basePayload = {
    apiKey,
    args,
    endpointPath,
    httpMethod,
    queryParams,
    source: 'trpc_middleware' as const,
    trpcPath: opts.path,
    userId: opts.ctx.user?.id,
  };

  try {
    const result = await opts.next();

    if (result.ok) {
      captureApiRequestEvent({
        ...basePayload,
        url: opts.ctx.req.url,
        success: true,
        durationMs: Date.now() - startedAt,
      });
    } else {
      captureApiRequestEvent({
        ...basePayload,
        url: opts.ctx.req.url,
        success: false,
        durationMs: Date.now() - startedAt,
        errorCode: result.error.code,
      });
    }

    return result;
  } catch (error) {
    captureApiRequestEvent({
      ...basePayload,
      url: opts.ctx.req.url,
      success: false,
      durationMs: Date.now() - startedAt,
      errorCode: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
    });

    throw error;
  }
});

export const router = t.router;
export const publicProcedure = t.procedure.use(analyticsMiddleware);
export const mergeRouters = t.mergeRouters;
export const createCallerFactory = t.createCallerFactory;
