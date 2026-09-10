import type { User } from '@/lib/apikeys';
import { findUserByKey } from '@/lib/apikeys';
import type { ApiMajor } from '@/lib/apiVersion';
import type { RateLimitInfo } from './rateLimit';
import type { TRPCRequestInfo } from '@trpc/server/http';

interface ResponseHeaderSetter {
  setHeader: (key: string, value: string) => void;
}

interface FetchCreateContextFnOptions {
  req: Request;
  res: ResponseHeaderSetter;
  info: TRPCRequestInfo;
}

export interface Context {
  apiKey?: string | null;
  req: Request;
  resHeaders: {
    set: (key: string, value: string) => void;
  };
  rateLimit: RateLimitInfo | undefined;
  user: User | null;
  /**
   * The URL major this request arrived on, supplied by the route it was
   * mounted under. Never inferred from `req.url` — the OpenAPI adapter strips
   * the `/api/vN` prefix before the context is built.
   */
  major: ApiMajor;
}

const createContextWithUser =
  (major: ApiMajor) =>
  async ({ req, info, res }: FetchCreateContextFnOptions): Promise<Context> => {
    // low fat cors

    const headers = new Headers(req.headers);
    const resHeaders = {
      set: (key: string, value: string) => {
        res.setHeader(key, value);
        headers.set(key, value);
      },
      get: (key: string) => {
        return headers.get(key);
      },
    };

    resHeaders.set('access-control-allow-origin', '*');
    resHeaders.set('access-control-allow-methods', 'GET, POST, OPTIONS');
    resHeaders.set(
      'access-control-allow-headers',
      'Content-Type, Authorization',
    );

    const apiKey = getApiKeyFromRequest(req);
    const user = await withUser(req, apiKey);

    // given that as of ~2026-02-15 we're sending events to posthog, I wonder if
    // this is still useful? - RS 2026-02-25
    if (process.env.NODE_ENV === 'production') {
      // Log the request which is forwarded to datadog
      console.info(
        JSON.stringify({
          userId: user?.id,
          url: req.url,
          query: info.url?.searchParams.toString(),
        }),
      );
    }

    return {
      apiKey,
      req,
      resHeaders,
      rateLimit: undefined as RateLimitInfo | undefined,
      user,
      major,
    };
  };

export const getApiKeyFromRequest = (req: Request): string | null => {
  const authorization = req.headers.get('authorization');

  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(' ');
  if (scheme.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
};

export const withUser = async (
  req: Request,
  apiKey?: string | null,
): Promise<User | null> => {
  const token = apiKey ?? getApiKeyFromRequest(req);

  if (!token) {
    return null;
  }

  return findUserByKey(token);
};

/**
 * Builds the tRPC context for one major of the API.
 *
 * Curried so a route can bind its own major once, at module scope, rather than
 * re-deriving it per request.
 */
export const createContext = createContextWithUser;
