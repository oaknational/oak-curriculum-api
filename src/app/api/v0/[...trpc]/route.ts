import router from 'lib/router';
import { createContext, getApiKeyFromRequest } from 'lib/context';
import type { NextRequest } from 'next/server';
import { createOpenApiFetchHandler } from 'trpc-to-openapi';

import {
  captureApiRequestEvent,
  parseQueryParams,
} from '@/lib/analytics/posthogServer';

export const dynamic = 'force-dynamic';

const handler = async (req: NextRequest): Promise<Response> => {
  return await createOpenApiFetchHandler({
    endpoint: '/api/v0',
    router,
    createContext: async (opts) => {
      // trpc-to-openapi uses node-http adapter internally which provides res,
      // but the TypeScript types incorrectly show the fetch adapter signature
      return createContext('v0')(
        opts as unknown as Parameters<ReturnType<typeof createContext>>[0],
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
};

function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization',
    },
  });
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  OPTIONS,
  handler as HEAD,
};
