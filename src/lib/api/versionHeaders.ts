import type { ApiMajor } from '@/lib/apiVersion';
import { successorMajor } from '@/lib/apiVersion';

/**
 * Advertises the major that supersedes a frozen one, per RFC 5829.
 *
 * Appended rather than set, because paginated responses already carry a
 * `rel="next"` link and both have to survive. A no-op for the latest major,
 * which has no successor.
 */
export function withSuccessorLink<T extends Response>(
  res: T,
  major: ApiMajor,
): T {
  const successor = successorMajor(major);

  if (successor) {
    res.headers.append('Link', `</api/${successor}>; rel="successor-version"`);
  }

  return res;
}
