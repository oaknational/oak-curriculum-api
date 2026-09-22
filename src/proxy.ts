import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const MARKDOWN_ACCEPT = 'text/markdown';
const MARKDOWN_PROXY_PATH = '/api/markdown';
const MARKDOWN_BYPASS_HEADER = 'x-markdown-negotiation-bypass';
const MARKDOWN_PATH_HEADER = 'x-markdown-original-path';
const MARKDOWN_BUILD_HEADER = 'x-markdown-build-version';

function getMarkdownBuildVersion(): string {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    process.env.NEXT_BUILD_ID ||
    'dev'
  );
}

function isAdminPath(pathname: string): boolean {
  return pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
}

function shouldRequestMarkdown(req: NextRequest): boolean {
  if (req.method !== 'GET') {
    return false;
  }

  if (req.headers.get(MARKDOWN_BYPASS_HEADER) === '1') {
    return false;
  }

  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname.includes('.') ||
    pathname === MARKDOWN_PROXY_PATH ||
    // Admin pages must never be negotiated: this branch runs before the Basic
    // auth check below, and the markdown proxy stamps a public, cacheable
    // response that varies on Accept but not Authorization.
    isAdminPath(pathname)
  ) {
    return false;
  }

  const accept = req.headers.get('accept')?.toLowerCase() ?? '';
  return accept
    .split(',')
    .some((value) => value.trim().startsWith(MARKDOWN_ACCEPT));
}

export function proxy(req: NextRequest): NextResponse {
  if (shouldRequestMarkdown(req)) {
    const originalPath = `${req.nextUrl.pathname}${req.nextUrl.search}`;
    const buildVersion = getMarkdownBuildVersion();
    const rewriteUrl = req.nextUrl.clone();
    rewriteUrl.pathname = MARKDOWN_PROXY_PATH;
    rewriteUrl.searchParams.set('path', originalPath);
    rewriteUrl.searchParams.set('v', buildVersion);

    const requestHeaders = new Headers(req.headers);
    requestHeaders.set(MARKDOWN_PATH_HEADER, originalPath);
    requestHeaders.set(MARKDOWN_BUILD_HEADER, buildVersion);

    return NextResponse.rewrite(rewriteUrl, {
      request: {
        headers: requestHeaders,
      },
    });
  }

  if (!isAdminPath(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const authHeader = req.headers.get('authorization');

  if (!authHeader) {
    const res = new NextResponse(null, { status: 401 });
    res.headers.set('WWW-Authenticate', 'Basic');
    return res;
  }

  const [, base64Credentials] = authHeader.split(' ');
  const [username, password] = Buffer.from(base64Credentials, 'base64')
    .toString()
    .split(':');

  const validUsername = process.env.AUTH_USERNAME;
  const validPassword = process.env.AUTH_PASSWORD;

  if (username === validUsername && password === validPassword) {
    return NextResponse.next();
  }

  const res = new NextResponse(null, { status: 401 });
  res.headers.set('WWW-Authenticate', 'Basic');
  return res;
}

export const config = {
  matcher: ['/:path*'],
};
