import { describe, expect, it } from 'vitest';

import { API_MAJORS, type ApiMajor } from '@/lib/apiVersion';
import { openApiDocumentFor } from '@/lib/zod-openapi/schema/generateDocument';

/**
 * A snapshot of each major's contract, so that a change to a frozen one has to
 * be deliberate.
 *
 * `addedIn` keeps new *procedures* out of a frozen major, but nothing stops
 * someone widening a shared Zod schema, adding a response field, or loosening a
 * parameter — the schemas are shared on purpose. Those changes show up here as
 * a diff instead of shipping silently.
 *
 * Read the two cases differently: a diff on the latest major is expected and
 * just needs eyeballing, whereas a diff on a frozen major must be justified as
 * a fix rather than a feature, or reworked into a superseding procedure.
 */

type Json = Record<string, unknown>;

const METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
] as const;

// Structural only. Prose (`summary`, `description`, `example`) and
// `info.version` are excluded: they move under an ordinary fix or a release,
// and blocking those would make a frozen major unmaintainable.
function schemaShape(schema: unknown, seen = new Set<unknown>()): unknown {
  if (!schema || typeof schema !== 'object') {
    return schema ?? null;
  }

  // Schemas can be recursive; a repeat is recorded rather than followed.
  if (seen.has(schema)) {
    return '[circular]';
  }
  const nested = new Set(seen).add(schema);

  if (Array.isArray(schema)) {
    return schema.map((entry) => schemaShape(entry, nested));
  }

  const source = schema as Json;
  const shape: Json = {};

  for (const key of [
    'type',
    'format',
    'enum',
    'nullable',
    'required',
    '$ref',
    'oneOf',
    'anyOf',
    'allOf',
    'additionalProperties',
  ]) {
    if (source[key] !== undefined) {
      shape[key] = schemaShape(source[key], nested);
    }
  }

  if (source.items) {
    shape.items = schemaShape(source.items, nested);
  }

  if (source.properties && typeof source.properties === 'object') {
    const properties: Json = {};
    for (const [name, value] of Object.entries(source.properties as Json)) {
      properties[name] = schemaShape(value, nested);
    }
    shape.properties = properties;
  }

  return shape;
}

function asJson(value: unknown): Json {
  return value && typeof value === 'object' ? (value as Json) : {};
}

function get(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Json)[key] : undefined;
}

function contentShape(content: unknown): Json | undefined {
  if (!content || typeof content !== 'object') {
    return undefined;
  }

  const shape: Json = {};
  for (const [mediaType, value] of Object.entries(content as Json)) {
    shape[mediaType] = schemaShape((value as Json)?.schema);
  }
  return shape;
}

/** Everything that makes up the contract, and nothing that does not. */
export function featureSurface(document: Json): Json {
  const paths = asJson(document.paths);
  const surface: Json = {};

  for (const path of Object.keys(paths).sort()) {
    const pathItem = asJson(paths[path]);

    const operations: Json = {};

    for (const method of METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;
      const op = asJson(operation);

      const parameters = ((op.parameters ?? []) as Json[]).map((parameter) => ({
        name: String(parameter.name),
        in: String(parameter.in),
        required: parameter.required ?? false,
        schema: schemaShape(parameter.schema),
      }));

      parameters.sort((a, b) =>
        `${a.in}:${a.name}`.localeCompare(`${b.in}:${b.name}`),
      );

      const responses: Json = {};
      const declared = asJson(op.responses);
      for (const status of Object.keys(declared).sort()) {
        responses[status] = {
          content: contentShape(get(declared[status], 'content')),
        };
      }

      operations[method] = {
        operationId: op.operationId,
        tags: op.tags,
        security: op.security,
        parameters,
        requestBody: contentShape(get(op.requestBody, 'content')),
        responses,
      };
    }

    surface[path] = operations;
  }

  const server = (document.servers as Json[] | undefined)?.[0]?.url;

  return {
    // The path only: the origin varies by environment, and it is the major
    // segment that forms part of the contract.
    server: typeof server === 'string' ? new URL(server).pathname : server,
    securitySchemes: get(document.components, 'securitySchemes'),
    paths: surface,
  };
}

describe.each(API_MAJORS)('the %s contract', (major: ApiMajor) => {
  it('has not changed', async () => {
    const surface = featureSurface(
      openApiDocumentFor(major) as unknown as Json,
    );

    await expect(JSON.stringify(surface, null, 2)).toMatchFileSnapshot(
      `./__snapshots__/api-${major}-surface.json`,
    );
  });
});
