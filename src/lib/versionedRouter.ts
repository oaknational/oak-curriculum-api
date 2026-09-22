import type { AnyProcedure } from '@trpc/server';

import type { ApiMajor } from '@/lib/apiVersion';
import { API_MAJORS, LATEST_API_MAJOR } from '@/lib/apiVersion';
import appRouter from '@/lib/router';
import type { ApiMeta } from '@/lib/trpc';
import { router as createRouter } from '@/lib/trpc';

type AppRouter = typeof appRouter;

/**
 * Whether a procedure is served at a given major.
 *
 * Absent `addedIn` means the latest major only, so a procedure written without
 * thinking about versions stays out of every frozen major.
 */
export function isServedIn(
  meta: ApiMeta | undefined,
  major: ApiMajor,
  // Taken as a parameter so the ordering rules can be exercised against a
  // multi-major list before this deployment actually serves one.
  majors: readonly string[] = API_MAJORS,
  latest: string = LATEST_API_MAJOR,
): boolean {
  const at = majors.indexOf(major);
  const from = majors.indexOf(meta?.addedIn ?? latest);
  const until = meta?.removedIn ? majors.indexOf(meta.removedIn) : Infinity;

  if (at < 0 || from < 0) {
    return false;
  }

  return at >= from && at < until;
}

const cache = new Map<ApiMajor, AppRouter>();

/**
 * The subset of the shared router served at `/api/<major>`.
 *
 * Used for both routing and OpenAPI generation, so the published document
 * always describes exactly the surface that is served.
 *
 * Memoised because `createOpenApiFetchHandler` rebuilds its procedure cache on
 * every request.
 */
export function routerForMajor(major: ApiMajor): AppRouter {
  const cached = cache.get(major);
  if (cached) {
    return cached;
  }

  // The latest major serves everything by definition, so it never needs
  // rebuilding — and never touches tRPC's internals.
  if (major === LATEST_API_MAJOR) {
    cache.set(major, appRouter);
    return appRouter;
  }

  const record: Record<string, unknown> = {};

  // At runtime `_def.procedures` is a flat, dot-delimited record; its type
  // describes the decorated nested shape instead. Both `trpc-to-openapi` entry
  // points read the runtime shape, so we do too.
  const procedures = appRouter._def.procedures as unknown as Record<
    string,
    AnyProcedure
  >;

  for (const [path, procedure] of Object.entries(procedures)) {
    const meta = procedure._def.meta as ApiMeta | undefined;
    if (!isServedIn(meta, major)) {
      continue;
    }

    // `createRouter` wants the record nested back up, and rebuilds the flat
    // record and the caller itself.
    const segments = path.split('.');
    const leaf = segments.pop();
    if (!leaf) {
      continue;
    }

    let node = record;
    for (const segment of segments) {
      node[segment] ??= {};
      node = node[segment] as Record<string, unknown>;
    }
    node[leaf] = procedure;
  }

  // The derived router holds a subset of the same procedures, so its context
  // and meta types are unchanged — only the set of keys narrows, which cannot
  // be expressed without asserting.
  const derived = createRouter(record as never) as AppRouter;

  cache.set(major, derived);
  return derived;
}
