import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { API_MAJORS, LATEST_API_MAJOR, type ApiMajor } from '@/lib/apiVersion';
import { openApiDocumentFor } from '@/lib/zod-openapi/schema/generateDocument';

/**
 * The static files agents read to discover the API hand-write their paths, and
 * step 6 of [RELEASING.md](../docs/RELEASING.md) leaves updating them to
 * whoever cuts a major. Nothing checked those paths were real, so `auth.md`
 * shipped `GET /rate-limit` — a handler's `openapi.path` without the major it
 * is mounted under — and sent agents to a 404 with nothing to explain why.
 *
 * Every path is checked against the surface the app actually serves: the
 * major's OpenAPI document for the routed operations, and the route files for
 * everything else under `/api/<major>`.
 */

/** Everything served from `public/` that writes an `/api/<major>` path. */
const DISCOVERY_SURFACES = [
  'auth.md',
  'robots.txt',
  '.well-known/api-catalog',
  '.well-known/agent-skills/oak-openapi/SKILL.md',
] as const;

/** The subset that tells an agent which request to make. */
const AGENT_DOCS = [
  'auth.md',
  '.well-known/agent-skills/oak-openapi/SKILL.md',
] as const;

/** A path as prose writes it, e.g. `/api/v1/lessons/{lesson}/assets/{type}`. */
const API_PATH = /\/api\/v\d+[\w{}/.-]*/g;

/**
 * A path an agent is told to call, as the docs write one: `GET /api/v1/...`.
 * Deliberately not limited to paths that already carry a major — a handler
 * path written without its mount is the mistake this catches.
 */
const CALLABLE_EXAMPLE = /\b(?:GET|POST|PUT|PATCH|DELETE)\s+(\/\S*?)`/g;

function docText(name: string): string {
  return readFileSync(new URL(`../public/${name}`, import.meta.url), 'utf8');
}

function references(text: string): { major: string; path: string }[] {
  return [...text.matchAll(API_PATH)].map((match) => {
    // Sentences end in a full stop; no route does.
    const [, , major, ...rest] = match[0].replace(/\.+$/, '').split('/');
    return { major, path: `/${rest.join('/')}` };
  });
}

/**
 * The non-tRPC routes a major serves, from the route files themselves —
 * `/swagger.json` and the asset download redirects. The catch-all is the tRPC
 * mount, and its surface is the OpenAPI document instead.
 */
function routeFilePaths(major: ApiMajor, segments: string[] = []): string[] {
  const dir = fileURLToPath(
    new URL(`../src/app/api/${major}/${segments.join('/')}`, import.meta.url),
  );

  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'route.ts') {
      return [
        `/${segments.map((s) => s.replace(/^\[(.+)]$/, '{$1}')).join('/')}`,
      ];
    }

    if (!entry.isDirectory() || entry.name.startsWith('[...')) {
      return [];
    }

    return routeFilePaths(major, [...segments, entry.name]);
  });
}

const served = new Map<string, Set<string>>(
  API_MAJORS.map((major) => [
    major,
    new Set([
      ...Object.keys(openApiDocumentFor(major).paths ?? {}),
      ...routeFilePaths(major),
      // A bare `/api/<major>`: the mount point, as prose names it.
      '/',
    ]),
  ]),
);

describe.each(DISCOVERY_SURFACES)('%s', (name) => {
  const text = docText(name);

  it('names only majors the app mounts', () => {
    const majors = references(text).map((reference) => reference.major);

    expect(majors.length).toBeGreaterThan(0);
    for (const major of new Set(majors)) {
      expect(API_MAJORS).toContain(major);
    }
  });

  it('points every path at a route that major serves', () => {
    for (const { major, path } of references(text)) {
      expect(served.get(major)).toContain(path);
    }
  });
});

describe.each(AGENT_DOCS)('%s', (name) => {
  const text = docText(name);

  it('writes its callable examples against the current major', () => {
    // Prose may name a frozen major — auth.md points at both swagger
    // documents — but anything an agent is told to call has to be current.
    const examples = [...text.matchAll(CALLABLE_EXAMPLE)].map(
      (match) => match[1],
    );

    expect(examples.length).toBeGreaterThan(0);
    for (const example of examples) {
      expect(example).toMatch(new RegExp(`^/api/${LATEST_API_MAJOR}/`));
    }
  });
});
