import type { NextRequest } from 'next/server';
import { createOpenApiFetchHandler } from 'trpc-to-openapi';

import {
  captureApiRequestEvent,
  parseQueryParams,
} from '@/lib/analytics/posthogServer';
import type { ApiMajor } from '@/lib/apiVersion';
import { createContext, getApiKeyFromRequest } from '@/lib/context';
import { routerForMajor } from '@/lib/versionedRouter';

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

  return async (req: NextRequest): Promise<Response> => {
    const res = await createOpenApiFetchHandler({
      endpoint,
      router,
      createContext: async (opts) => {
        // trpc-to-openapi uses node-http adapter internally which provides res,
        // but the TypeScript types incorrectly show the fetch adapter signature
        return createContextForMajor(
          opts as unknown as Parameters<typeof createContextForMajor>[0],
        );
      },
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
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization',
    },
  });
}
