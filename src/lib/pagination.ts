import type { ApiMajor } from './apiVersion';
import { apiBaseUrl } from './baseUrl';

export function nextPageLink(
  major: ApiMajor,
  requestUrl: string,
  offset: number,
  limit: number,
  options: { unit?: string } | undefined = undefined,
): string {
  const base = apiBaseUrl(major);
  const url = new URL(requestUrl, base);
  const searchParams = url.searchParams;

  searchParams.set('offset', (offset + limit).toString());
  searchParams.set('limit', limit.toString());
  if (options) {
    const { unit } = options;
    if (unit) {
      searchParams.set('unit', unit);
    }
  }

  return `${base}${url.pathname}?${searchParams.toString()}`;
}
