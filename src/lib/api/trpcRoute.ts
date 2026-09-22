import type { NextRequest } from 'next/server';
import { createOpenApiFetchHandler } from 'trpc-to-openapi';

import {
  captureApiRequestEvent,
  parseQueryParams,
} from '@/lib/analytics/posthogServer';
import type { ApiMajor } from '@/lib/apiVersion';
import { createContext, getApiKeyFromRequest } from '@/lib/context';
import { routerForMajor } from '@/lib/versionedRouter';

import { API_METHODS, corsHeaders } from './cors';
import { withSuccessorLink } from './versionHeaders';

/**
 * The tRPC-backed OpenAPI surface for one major.
 *
 * The router and context are both bound to the major here, so the endpoints on
 * offer and the URLs inside their responses agree with the path the request
 * arrived on.
 */
export function createTrpcHandler(major: ApiMajor) {
  const endpoint = `/api/${major}` as const;
  const router = routerForMajor(major);
  const createContextForMajor = createContext(major);

  /**
   * `trpc-to-openapi`'s fetch adapter delegates to its node-http adapter, so
   * `createContext` is handed a node-style `res` carrying `setHeader`. Its
   * published types reuse tRPC's fetch signature, which promises
   * `resHeaders: Headers` instead, so the argument has to be re-asserted to
   * the shape the context builder is actually called with.
   */
  type CreateContextOptions = Parameters<typeof createContextForMajor>[0];

  return async (req: NextRequest): Promise<Response> => {
    const res = await createOpenApiFetchHandler({
      endpoint,
      router,
      createContext: (opts) =>
        createContextForMajor(opts as unknown as CreateContextOptions),
      onError: (opts) => {
        if (opts.type !== 'unknown' && opts.path) {
          return;
        }

        const req = opts.req;
        const ctx = opts.ctx;
        const apiKey = ctx?.apiKey ?? getApiKeyFromRequest(req);

        captureApiRequestEvent({
          url: req.url,
          apiKey,
          // From the factory, not the context: an unrouted request may not
          // have got far enough to build one.
          apiMajor: major,
          endpointPath: opts.path || '/unknown',
          httpMethod: req.method || 'UNKNOWN',
          source: 'trpc_on_error',
          success: false,
          trpcPath: opts.path,
          errorCode: opts.error.code,
          userId: ctx?.user?.id,
          queryParams: parseQueryParams(req.url),
        });
      },
      req,
    });

    return withSuccessorLink(res, major);
  };
}

/** The surface's CORS preflight; identical for every major. */
export function trpcPreflight(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(API_METHODS),
  });
}
