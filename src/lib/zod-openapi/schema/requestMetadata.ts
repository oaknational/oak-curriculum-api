import { TRPCError } from '@trpc/server';
import * as z from 'zod/v4';
import {
  forEachOpenApiProcedure,
  getInputOutputParsers,
  normalizePath,
  type OpenAPIObject,
  type OpenApiRouter,
} from 'trpc-to-openapi';
import type { ApiMeta } from '@/lib/trpc';

/**
 * Key used to list a request schema's cross-field rules in its `.meta()`.
 *
 * OpenAPI describes every query parameter in isolation, so a Zod `.refine()`
 * that spans two fields (such as "phase and keyStage cannot both be provided")
 * has nowhere structural to live. Recording the rule messages under this key
 * lets `applyRequestMetadata` append them to the operation description, so they
 * reach swagger.json instead of only surfacing as a 400 at request time.
 */
export const requestRulesKey = 'x-request-rules';

interface MetadataHolder {
  meta?: () => Record<string, unknown> | undefined;
  def?: { innerType?: unknown };
  shape?: Record<string, unknown>;
}

interface ParameterLike {
  name: string;
  in?: string;
  required?: boolean;
  description?: string;
  schema?: { example?: unknown } & Record<string, unknown>;
}

interface OperationLike {
  description?: string;
  parameters?: ({ $ref: string } | ParameterLike)[];
}

function asMetadataHolder(schema: unknown): MetadataHolder | undefined {
  const holder = schema as MetadataHolder | undefined;
  return typeof holder?.meta === 'function' ? holder : undefined;
}

/** Rule messages declared on a request schema, if any. */
export function getRequestRules(schema: unknown): string[] {
  const rules = asMetadataHolder(schema)?.meta?.()?.[requestRulesKey];
  if (!Array.isArray(rules)) return [];
  return rules.filter((rule): rule is string => typeof rule === 'string');
}

/**
 * The first value for `key` found on a field, unwrapping optionals on the way
 * down. `.optional().describe()` puts the metadata on the optional wrapper,
 * which trpc-to-openapi unwraps (and so discards) when it rebuilds the query
 * object from the shape.
 */
function getFieldMeta(schema: unknown, key: string): unknown {
  let current = asMetadataHolder(schema);

  while (current) {
    const value = current.meta?.()?.[key];
    if (value !== undefined) return value;
    current = asMetadataHolder(current.def?.innerType);
  }

  return undefined;
}

/**
 * The OpenAPI query parameters for a procedure's `urlQuery` schema, which
 * trpc-to-openapi never sees.
 */
function urlQueryParameters(urlQuery: z.ZodObject): ParameterLike[] {
  const fields = Object.entries(urlQuery.shape) as [string, z.ZodType][];

  return fields.map(([name, field]) => {
    const schema: Record<string, unknown> = z.toJSONSchema(field, {
      io: 'input',
    });
    // the description belongs on the parameter, as trpc-to-openapi puts it for
    // a GET's query, rather than repeated on its schema
    delete schema.$schema;
    delete schema.description;
    const description = getFieldMeta(field, 'description');
    const example = getFieldMeta(field, 'example');

    return {
      name,
      in: 'query',
      required: !field.safeParse(undefined).success,
      ...(typeof description === 'string' ? { description } : {}),
      schema: { ...schema, ...(example === undefined ? {} : { example }) },
    };
  });
}

/**
 * Parses a procedure's `urlQuery` from the request URL, answering a bad value
 * with a 400 as trpc-to-openapi does for the query of a GET.
 */
export function parseUrlQuery<T extends z.ZodObject>(
  urlQuery: T,
  requestUrl: string | undefined,
): z.infer<T> {
  const { searchParams } = new URL(requestUrl ?? '', 'http://localhost');
  const result = urlQuery.safeParse(Object.fromEntries(searchParams));

  if (!result.success) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: z.prettifyError(result.error),
      cause: result.error,
    });
  }

  return result.data;
}

/**
 * Copies request schema metadata that trpc-to-openapi drops back onto the
 * generated document: parameter descriptions and examples, the `urlQuery`
 * parameters of body-taking procedures, and cross-field rules declared under
 * {@link requestRulesKey}. Mutates and returns the given
 * document.
 */
export function applyRequestMetadata(
  document: OpenAPIObject,
  appRouter: OpenApiRouter,
): OpenAPIObject {
  forEachOpenApiProcedure(appRouter._def.procedures, ({ procedure, meta }) => {
    const pathItem = document.paths?.[normalizePath(meta.openapi.path)];
    const operation = pathItem?.[
      meta.openapi.method.toLowerCase() as keyof typeof pathItem
    ] as OperationLike | undefined;

    if (!operation) return;

    const { urlQuery } = meta as ApiMeta;
    if (urlQuery) {
      operation.parameters = [
        ...(operation.parameters ?? []),
        ...urlQueryParameters(urlQuery),
      ];
    }

    const { inputParser } = getInputOutputParsers(procedure);
    const shape = asMetadataHolder(inputParser)?.shape ?? {};

    for (const parameter of operation.parameters ?? []) {
      if ('$ref' in parameter) continue;
      const field = shape[parameter.name];

      if (!parameter.description) {
        const description = getFieldMeta(field, 'description');
        if (typeof description === 'string')
          parameter.description = description;
      }

      if (parameter.schema && parameter.schema.example === undefined) {
        const example = getFieldMeta(field, 'example');
        if (example !== undefined) parameter.schema.example = example;
      }
    }

    const rules = getRequestRules(inputParser);
    if (rules.length > 0) {
      const bullets = rules.map((rule) => `- ${rule}`).join('\n');
      operation.description = [
        operation.description,
        `Request rules:\n\n${bullets}`,
      ]
        .filter(Boolean)
        .join('\n\n');
    }
  });

  return document;
}
