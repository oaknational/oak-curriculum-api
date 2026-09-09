import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  API_MAJORS,
  LATEST_API_MAJOR,
  isFrozen,
  successorMajor,
  type ApiMajor,
} from '@/lib/apiVersion';
import { VERSION } from '@/lib/version';
import type { ApiMeta } from '@/lib/trpc';
import { isServedIn, routerForMajor } from '@/lib/versionedRouter';

describe('the URL major and the semver major', () => {
  it('serves the project version at the matching URL major', () => {
    expect(LATEST_API_MAJOR).toBe(`v${VERSION.split('.')[0]}`);
  });

  it('lists the latest major among the majors it serves', () => {
    expect(API_MAJORS).toContain(LATEST_API_MAJOR);
  });

  it('has a route directory for every major it lists', () => {
    for (const major of API_MAJORS) {
      const routeFile = resolve(
        process.cwd(),
        'src/app/api',
        major,
        '[...trpc]/route.ts',
      );
      expect(existsSync(routeFile), `missing route for ${major}`).toBe(true);
    }
  });

  it('freezes every major except the latest', () => {
    expect(isFrozen(LATEST_API_MAJOR)).toBe(false);

    for (const major of API_MAJORS.filter((m) => m !== LATEST_API_MAJOR)) {
      expect(isFrozen(major)).toBe(true);
    }
  });

  it('points each major at the one that follows it', () => {
    API_MAJORS.forEach((major, index) => {
      expect(successorMajor(major)).toBe(API_MAJORS[index + 1]);
    });
  });
});

describe('isServedIn', () => {
  // Exercised against an explicit two-major ordering, so the rules the freeze
  // depends on are proven now rather than when a second major first ships.
  const majors = ['v0', 'v1'] as const;
  const latest = 'v1';

  // This build's ApiMajor has a single member, so the fixtures are built as
  // metadata rather than typed against it.
  const meta = (addedIn?: string, removedIn?: string) =>
    ({ addedIn, removedIn }) as unknown as ApiMeta;

  const servedIn = (value: ApiMeta | undefined, major: string) =>
    isServedIn(value, major as ApiMajor, majors, latest);

  it('serves a procedure from the major it was added in onwards', () => {
    expect(servedIn(meta('v0'), 'v0')).toBe(true);
    expect(servedIn(meta('v0'), 'v1')).toBe(true);
  });

  it('keeps a later procedure out of an earlier major', () => {
    expect(servedIn(meta('v1'), 'v0')).toBe(false);
    expect(servedIn(meta('v1'), 'v1')).toBe(true);
  });

  it('treats absent metadata as the latest major only', () => {
    // The property the freeze rests on: forgetting to think about versions
    // keeps a new procedure out of every frozen major.
    expect(servedIn(undefined, 'v1')).toBe(true);
    expect(servedIn(undefined, 'v0')).toBe(false);
    expect(servedIn(meta(), 'v0')).toBe(false);
  });

  it('stops serving a procedure from the major it was removed in', () => {
    expect(servedIn(meta('v0', 'v1'), 'v0')).toBe(true);
    expect(servedIn(meta('v0', 'v1'), 'v1')).toBe(false);
  });

  it('serves every current procedure at the majors this build lists', () => {
    // The real ordering: v0 procedures are served everywhere, because nothing
    // has diverged yet.
    for (const major of API_MAJORS) {
      expect(isServedIn({ addedIn: 'v0' }, major)).toBe(true);
    }
  });
});

describe('routerForMajor', () => {
  it('serves every procedure at the latest major', () => {
    const procedures = Object.keys(
      routerForMajor(LATEST_API_MAJOR)._def.procedures,
    );

    expect(procedures.length).toBeGreaterThan(0);
  });

  it('rebuilds a frozen major into a usable router', () => {
    // A canary: if tRPC's internals change shape, the rebuild would quietly
    // produce an empty router rather than failing outright.
    for (const major of API_MAJORS.filter(isFrozen)) {
      const procedures = Object.keys(routerForMajor(major)._def.procedures);

      expect(procedures.length, `${major} serves nothing`).toBeGreaterThan(0);
      expect(routerForMajor(major).createCaller).toBeTypeOf('function');
    }
  });

  it('returns the same router for repeated calls', () => {
    for (const major of API_MAJORS) {
      expect(routerForMajor(major)).toBe(routerForMajor(major));
    }
  });
});
