import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

function makeRequest(
  path: string,
  headers?: Record<string, string>,
): NextRequest {
  return new NextRequest(`http://localhost:2727${path}`, {
    method: 'GET',
    headers,
  });
}

describe('markdown negotiation proxy', () => {
  it('rewrites public HTML paths when Accept includes text/markdown', () => {
    const req = makeRequest('/docs/about-oaks-api/api-overview?tab=intro', {
      accept: 'text/markdown, text/html;q=0.9',
    });

    const res = proxy(req);
    const rewrite = res.headers.get('x-middleware-rewrite');

    expect(rewrite).toBeTruthy();
    expect(rewrite).toContain('/api/markdown');
    expect(rewrite).toContain(
      'path=%2Fdocs%2Fabout-oaks-api%2Fapi-overview%3Ftab%3Dintro',
    );
    expect(rewrite).toContain('v=dev');
  });

  it('keeps HTML default when markdown is not requested', () => {
    const req = makeRequest('/docs/about-oaks-api/api-overview', {
      accept: 'text/html,application/xhtml+xml',
    });

    const res = proxy(req);

    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('does not rewrite API requests', () => {
    const req = makeRequest('/api/v0/swagger.json', {
      accept: 'text/markdown',
    });

    const res = proxy(req);

    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it.each(['/admin', '/admin/users', '/api/admin/users'])(
    'does not rewrite %s, so it cannot skip the basic auth check',
    (path) => {
      const res = proxy(makeRequest(path, { accept: 'text/markdown' }));

      expect(res.headers.get('x-middleware-rewrite')).toBeNull();
      expect(res.status).toBe(401);
      expect(res.headers.get('WWW-Authenticate')).toBe('Basic');
    },
  );
});

describe('markdown proxy route', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns markdown with text/markdown content type and token header', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        '<!doctype html><html><head><title>Test page</title></head><body><h1>Hello</h1><p>World</p></body></html>',
        {
          status: 200,
          headers: {
            'content-type': 'text/html; charset=utf-8',
            vary: 'Origin',
          },
        },
      ),
    ) as typeof fetch;

    const { GET } = await import('@/app/api/markdown/route');

    const req = new NextRequest(
      'http://localhost:2727/api/markdown?path=/docs/about-oaks-api/api-overview',
      {
        method: 'GET',
        headers: {
          accept: 'text/markdown',
        },
      },
    );

    const res = await GET(req);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe(
      'text/markdown; charset=utf-8',
    );
    expect(res.headers.get('cache-control')).toContain('s-maxage=3600');
    expect(res.headers.get('cache-control')).toContain(
      'stale-while-revalidate=86400',
    );
    expect(res.headers.get('vary')).toContain('Accept');
    expect(res.headers.get('x-markdown-tokens')).toBeTruthy();
    expect(body).toContain('# Hello');
    expect(body).toContain('World');
  });

  it('passes through non-HTML upstream responses', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response('{"ok":true}', {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      }),
    ) as typeof fetch;

    const { GET } = await import('@/app/api/markdown/route');

    const req = new NextRequest(
      'http://localhost:2727/api/markdown?path=/api/v0/swagger.json',
      {
        method: 'GET',
      },
    );

    const res = await GET(req);

    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('x-markdown-tokens')).toBeNull();
  });

  it('supports path extraction from proxy forwarded header', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response('<html><body><h1>From rewrite</h1></body></html>', {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
        },
      }),
    ) as typeof fetch;

    const { GET } = await import('@/app/api/markdown/route');

    const req = new NextRequest('http://localhost:2727/', {
      method: 'GET',
      headers: {
        accept: 'text/markdown',
        'x-markdown-original-path': '/',
        'x-markdown-build-version': 'test-build-1',
      },
    });

    const res = await GET(req);
    const upstreamArgs = vi.mocked(global.fetch).mock.calls[0];
    const upstreamHeaders =
      (upstreamArgs?.[1]?.headers as Headers) ?? new Headers();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe(
      'text/markdown; charset=utf-8',
    );
    expect(res.headers.get('x-markdown-build-version')).toBe('test-build-1');
    expect(res.headers.get('x-markdown-tokens')).toBeTruthy();
    expect(upstreamHeaders.get('x-markdown-render-mode')).toBe('body-only');
  });

  it('returns docs body content without global header and footer text', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        `<!doctype html><html><head><title>Docs page</title></head><body>
          <div>
            <nav><a href="/docs">Docs Nav</a></nav>
            <a id="content"></a>
            <section><h1>API Overview</h1><p>Main docs body content.</p></section>
          </div>
          <script>window.__NEXT_DATA__ = {}</script>
        </body></html>`,
        {
          status: 200,
          headers: {
            'content-type': 'text/html; charset=utf-8',
          },
        },
      ),
    ) as typeof fetch;

    const { GET } = await import('@/app/api/markdown/route');

    const req = new NextRequest(
      'http://localhost:2727/api/markdown?path=/docs/about-oaks-api/api-overview',
      {
        method: 'GET',
        headers: {
          accept: 'text/markdown',
        },
      },
    );

    const res = await GET(req);
    const body = await res.text();
    const upstreamArgs = vi.mocked(global.fetch).mock.calls[0];
    const upstreamHeaders =
      (upstreamArgs?.[1]?.headers as Headers) ?? new Headers();

    expect(res.status).toBe(200);
    expect(body).toContain('# API Overview');
    expect(body).toContain('Main docs body content.');
    expect(body).not.toContain('__NEXT_DATA__');
    expect(upstreamHeaders.get('x-markdown-render-mode')).toBe('body-only');
  });
});
