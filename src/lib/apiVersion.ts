import { VERSION } from '@/lib/version';

/**
 * The major version segment of the public API's URL space.
 *
 * The URL major **is** the semver major: `0.x` is served at `/api/v0`, `1.x` at
 * `/api/v1`, and so on. A breaking change bumps the project version's major,
 * which mints a new URL major and freezes the previous one to fixes.
 *
 * See [docs/RELEASING.md](../../docs/RELEASING.md).
 */

/**
 * Every major the app serves, oldest first.
 *
 * One entry per `src/app/api/v*` route directory. Next resolves routes from
 * static files, so this list cannot be derived — it is kept in step with the
 * directories by `__tests__/api-version.test.ts`.
 */
export const API_MAJORS = ['v0', 'v1'] as const;

export type ApiMajor = (typeof API_MAJORS)[number];

/**
 * The major that takes new work, derived from the project version so the two
 * can never disagree. Everything else is frozen.
 */
export const LATEST_API_MAJOR = `v${VERSION.split('.')[0]}` as ApiMajor;

/**
 * Where a major sits relative to the one the project version names.
 *
 * `pending` is the gap between merging a new major's routes and releasing the
 * version that makes it current: the routes are live and serve correctly, but
 * the project is still on the previous major. It resolves itself on release,
 * with no code change.
 */
export type MajorStatus = 'frozen' | 'current' | 'pending';

export function majorStatus(major: ApiMajor): MajorStatus {
  if (major === LATEST_API_MAJOR) {
    return 'current';
  }

  return API_MAJORS.indexOf(major) < API_MAJORS.indexOf(LATEST_API_MAJOR)
    ? 'frozen'
    : 'pending';
}

/** Frozen majors still take fixes; they take no new features. */
export function isFrozen(major: ApiMajor): boolean {
  return majorStatus(major) === 'frozen';
}

/** The major that supersedes `major`, if one exists. */
export function successorMajor(major: ApiMajor): ApiMajor | undefined {
  return API_MAJORS[API_MAJORS.indexOf(major) + 1];
}
