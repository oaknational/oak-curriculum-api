import { describe, it, expect } from 'vitest';
import {
  forEachOpenApiProcedure,
  getInputOutputParsers,
} from 'trpc-to-openapi';
import router from '@/lib/router';
import { openApiDocumentFor } from '@/lib/zod-openapi/schema/generateDocument';
import { LATEST_API_MAJOR } from '@/lib/apiVersion';

import { getRequestRules } from '@/lib/zod-openapi/schema/requestMetadata';
import type { OpenAPIV3 } from 'openapi-types';

// The frozen majors are covered by the surface snapshot; this validates the
// document the current major publishes.
const openApiDocument = openApiDocumentFor(LATEST_API_MAJOR);

const swaggerData: OpenAPIV3.Document =
  openApiDocument as unknown as OpenAPIV3.Document;

function getParameters(path: string) {
  const operation = swaggerData.paths?.[path]?.get;
  if (!operation) expect.fail(`GET ${path} missing operation`);
  return (operation.parameters ?? []) as OpenAPIV3.ParameterObject[];
}

describe('cross-field request rules', () => {
  it('surfaces the keywords refinements in the operation description', () => {
    const description = swaggerData.paths?.['/keywords']?.get?.description;

    expect(description).toContain('Request rules:');
    expect(description).toContain(
      'At least one of subject, keyStage, phase, unit or lesson must be provided',
    );
    // expect(description).toContain('phase and keyStage cannot both be provided');
  });

  it('lists every refinement, so no rule is left undocumented', () => {
    const undocumented: string[] = [];

    forEachOpenApiProcedure(router._def.procedures, ({ path, procedure }) => {
      const { inputParser } = getInputOutputParsers(procedure);
      // Object-level checks are the `.refine()` calls: rules that span more
      // than one field and so can only be documented in prose.
      const refinements =
        (inputParser as { _zod?: { def?: { checks?: unknown[] } } })._zod?.def
          ?.checks?.length ?? 0;

      if (refinements > getRequestRules(inputParser).length) {
        undocumented.push(path);
      }
    });

    expect(undocumented).toEqual([]);
  });
});

describe('query parameter descriptions', () => {
  it('describes the optional keywords parameters', () => {
    const described = Object.fromEntries(
      getParameters('/keywords').map((parameter) => [
        parameter.name,
        parameter.description,
      ]),
    );

    expect(described.subject).toEqual(
      expect.stringContaining('Subject slug to search by'),
    );
    expect(described.keyStage).toEqual(
      expect.stringContaining('Key stage slug to filter by'),
    );
    expect(described.phase).toEqual(
      expect.stringContaining('Phase to filter by'),
    );
    expect(described.unit).toEqual(
      expect.stringContaining('Unit slug to search by'),
    );
    expect(described.lesson).toEqual(
      expect.stringContaining('Lesson slug to search by'),
    );
    expect(described.offset).toEqual(
      expect.stringContaining('starting at the given offset point'),
    );
    expect(described.limit).toEqual(
      expect.stringContaining('Limit the number of keywords'),
    );
  });

  it('keeps the examples declared on optional parameters', () => {
    const examples = Object.fromEntries(
      getParameters('/keywords').map((parameter) => [
        parameter.name,
        (parameter.schema as OpenAPIV3.SchemaObject | undefined)?.example,
      ]),
    );

    expect(examples.subject).toBe('english');
    expect(examples.keyStage).toBe('ks3');
  });

  it('describes every query parameter across the API', () => {
    const missing: string[] = [];

    for (const [path, methods] of Object.entries(swaggerData.paths ?? {})) {
      for (const [method, operation] of Object.entries(methods ?? {})) {
        if (!operation || typeof operation !== 'object') continue;
        if (!('parameters' in operation)) continue;

        for (const parameter of (operation.parameters ??
          []) as OpenAPIV3.ParameterObject[]) {
          if (!parameter.description) {
            missing.push(`${method.toUpperCase()} ${path} - ${parameter.name}`);
          }
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
