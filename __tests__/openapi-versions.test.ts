import { describe, expect, it } from 'vitest';

import { API_MAJORS, LATEST_API_MAJOR, majorStatus } from '@/lib/apiVersion';
import { routerForMajor } from '@/lib/versionedRouter';
import { openApiDocumentFor } from '@/lib/zod-openapi/schema/generateDocument';

const operationMethods = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
] as const;

describe.each(API_MAJORS)('the %s OpenAPI document', (major) => {
  const document = openApiDocumentFor(major);

  it('points its server at its own major', () => {
    expect(document.servers?.[0]?.url).toMatch(new RegExp(`/api/${major}$`));
  });

  it('describes exactly the surface the router serves', () => {
    // The document and the routing both come from the same derived router, so
    // a published operation can never be one that 404s.
    const documented = Object.keys(document.paths ?? {}).length;
    const served = Object.values(
      routerForMajor(major)._def.procedures as Record<string, unknown>,
    ).length;

    expect(documented).toBeGreaterThan(0);
    expect(documented).toBe(served);
  });

  it('gives every operation a unique id', () => {
    const ids: string[] = [];

    for (const pathItem of Object.values(document.paths ?? {})) {
      for (const method of operationMethods) {
        const operationId = pathItem?.[method]?.operationId;
        if (operationId) {
          ids.push(operationId);
        }
      }
    }

    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('refers to no other major anywhere in the document', () => {
    // Response examples are authored against v0 with absolute URLs, so a
    // document for any other major has to retarget them.
    const serialised = JSON.stringify(document);

    for (const other of API_MAJORS.filter((m) => m !== major)) {
      expect(serialised).not.toContain(`/api/${other}/`);
    }
  });

  it('says where it stands relative to the current major', () => {
    const description = document.info.description ?? '';
    const expected = {
      frozen: 'is frozen',
      current: 'the current major',
      pending: 'not yet the current major',
    }[majorStatus(major)];

    expect(description).toContain(`/api/${major}`);
    expect(description).toContain(expected);
  });
});

describe('the majors as a set', () => {
  it('serves the same endpoints at every major', () => {
    // True while nothing has diverged. When an endpoint is first superseded
    // this becomes a deliberate change, not a surprise.
    const [first, ...rest] = API_MAJORS.map((major) =>
      Object.keys(openApiDocumentFor(major).paths ?? {}).sort(),
    );

    for (const paths of rest) {
      expect(paths).toEqual(first);
    }
  });

  it('keeps operation ids stable across majors', () => {
    // Consumers generate clients from these; renaming them per major would
    // break anyone who upgrades.
    const idsFor = (major: (typeof API_MAJORS)[number]) => {
      const ids: string[] = [];

      for (const [path, pathItem] of Object.entries(
        openApiDocumentFor(major).paths ?? {},
      )) {
        for (const method of operationMethods) {
          const operationId = pathItem?.[method]?.operationId;
          if (operationId) {
            ids.push(`${method} ${path} ${operationId}`);
          }
        }
      }

      return ids;
    };

    for (const major of API_MAJORS) {
      expect(idsFor(major)).toEqual(idsFor(LATEST_API_MAJOR));
    }
  });
});
