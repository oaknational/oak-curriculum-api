import type { MetadataRoute } from 'next';

const DEFAULT_PRODUCTION_ORIGIN = 'https://open-api.thenational.academy';

const STATIC_PUBLIC_PATHS = [
  '/',
  '/playground',
  '/bulk-download',
  '/api/bulk/schema.json',
  '/api/v0/swagger.json',
  '/api/v1/swagger.json',
  '/.well-known/api-catalog',
  '/.well-known/agent-skills/index.json',
] as const;

type SitemapEntry = MetadataRoute.Sitemap[number];

function getSiteOrigin(): string {
  let origin = `http://localhost:${process.env.PORT || 2727}`;

  if (process.env.NODE_ENV === 'production' && process.env.VERCEL_BRANCH_URL) {
    origin = `https://${process.env.VERCEL_BRANCH_URL}`;
  } else if (process.env.VERCEL_URL) {
    origin = `https://${process.env.VERCEL_URL}`;
  }

  if (
    process.env.VERCEL_ENV === 'production' &&
    process.env.PRODUCTION_API_URL
  ) {
    origin = process.env.PRODUCTION_API_URL;
  }

  return origin.replace(/\/$/, '') || DEFAULT_PRODUCTION_ORIGIN;
}

async function getDocsPaths(): Promise<string[]> {
  try {
    const { default: navDocsListQuery } =
      await import('@/cms/queries/navDocsListQuery/navDocsListQuery.query');
    const navGroups = await navDocsListQuery();

    return navGroups.flatMap((group) =>
      group.pages.map((page) => `/docs/${page.href}`),
    );
  } catch {
    return [];
  }
}

export const revalidate = 0;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getSiteOrigin();
  const docsPaths = await getDocsPaths();
  const allPaths = new Set<string>([
    ...STATIC_PUBLIC_PATHS,
    '/docs/about-oaks-api/api-overview',
    ...docsPaths,
  ]);

  const entries: SitemapEntry[] = [];

  for (const path of allPaths) {
    entries.push({
      url: new URL(path, `${origin}/`).toString(),
    });
  }

  return entries;
}
