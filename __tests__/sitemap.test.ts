import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const ORIGINAL_ENV = process.env;

describe('sitemap route', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.clearAllMocks();
  });

  it('includes static and CMS docs URLs on the production origin', async () => {
    process.env.VERCEL_ENV = 'production';
    process.env.PRODUCTION_API_URL = 'https://open-api.thenational.academy';

    vi.doMock('@/cms/queries/navDocsListQuery/navDocsListQuery.query', () => ({
      default: vi.fn().mockResolvedValue([
        {
          title: "About Oak's API",
          pages: [
            { title: 'API overview', href: 'about-oaks-api/api-overview' },
            { title: 'Terms', href: 'about-oaks-api/terms' },
          ],
        },
      ]),
    }));

    const { default: sitemap } = await import('@/app/sitemap');
    const result = await sitemap();
    const urls = result.map((entry) => entry.url);

    expect(urls).toContain('https://open-api.thenational.academy/');
    expect(urls).toContain('https://open-api.thenational.academy/playground');
    expect(urls).toContain(
      'https://open-api.thenational.academy/docs/about-oaks-api/api-overview',
    );
    expect(urls).toContain(
      'https://open-api.thenational.academy/docs/about-oaks-api/terms',
    );
  });

  it('falls back to static URLs when docs query is unavailable', async () => {
    process.env.PORT = '2727';

    vi.doMock('@/cms/queries/navDocsListQuery/navDocsListQuery.query', () => {
      throw new Error('Missing Sanity configuration');
    });

    const { default: sitemap } = await import('@/app/sitemap');
    const result = await sitemap();
    const urls = result.map((entry) => entry.url);

    expect(urls).toContain('http://localhost:2727/');
    expect(urls).toContain('http://localhost:2727/api/v0/swagger.json');
    expect(urls).toContain('http://localhost:2727/api/v1/swagger.json');
    expect(urls).not.toContain(
      'http://localhost:2727/docs/about-oaks-api/terms',
    );
  });
});
