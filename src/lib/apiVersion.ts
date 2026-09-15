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

/**
 * The version a frozen major is pinned at: the last release made while it was
 * the current major.
 *
 * Without this a frozen major's OpenAPI document would report the deployment's
 * version, so `/api/v0` would eventually advertise `1.4.0` — a version implying
 * features it does not have, and a major that contradicts its own URL. Pin a
 * major when it is frozen, to the final release before the bump.
 */
const FROZEN_AT: Partial<Record<ApiMajor, string>> = {
  v0: '0.11.2',
};

/**
 * The version a major's OpenAPI document reports.
 *
 * The current major tracks the deployment; a frozen one keeps the version it
 * was last current at.
 */
export function versionForMajor(major: ApiMajor): string {
  return FROZEN_AT[major] ?? VERSION;
}

/** The major that supersedes `major`, if one exists. */
export function successorMajor(major: ApiMajor): ApiMajor | undefined {
  return API_MAJORS[API_MAJORS.indexOf(major) + 1];
}
