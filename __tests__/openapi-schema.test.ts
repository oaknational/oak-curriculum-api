import { it, expect } from 'vitest';
import Ajv, { ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import { openApiDocumentFor } from '@/lib/zod-openapi/schema/generateDocument';
import { LATEST_API_MAJOR } from '@/lib/apiVersion';

import type { OpenAPIV3 } from 'openapi-types';

// The frozen majors are covered by the surface snapshot; this validates the
// document the current major publishes.
const openApiDocument = openApiDocumentFor(LATEST_API_MAJOR);

// this object is no longer the same document type annoyingly, so casting as they are the same object
const swaggerData: OpenAPIV3.Document =
  openApiDocument as unknown as OpenAPIV3.Document;

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

function resolveRef(ref: string) {
  const refPath = ref.replace(/^#\/components\/responses\//, '');
  return swaggerData.components?.responses?.[refPath] || null;
}

function getSchema(ref: string) {
  const refPath = ref.replace(/^#\/components\/schemas\//, '');
  return swaggerData.components?.schemas?.[refPath] || null;
}

// A response schema frequently carries its example data on the individual
// properties (or on array `items`) rather than as one example on the whole
// schema. Walk the schema and assemble those per-property examples into a single
// object/array, preferring a schema-level `example` wherever one is declared, so
// the result can be validated against the schema as a whole.
function buildExampleFromSchema(
  schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject | undefined,
): unknown {
  if (!schema) return undefined;

  if ('$ref' in schema) {
    return buildExampleFromSchema(getSchema(schema.$ref) ?? undefined);
  }

  // A schema-level example wins over reconstructing from children.
  if (schema.example !== undefined) return schema.example;

  if (schema.type === 'array' && schema.items) {
    const item = buildExampleFromSchema(schema.items);
    return item === undefined ? undefined : [item];
  }

  if (schema.properties) {
    const result: Record<string, unknown> = {};
    for (const [key, property] of Object.entries(schema.properties)) {
      const value = buildExampleFromSchema(property);
      if (value !== undefined) result[key] = value;
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }

  return undefined;
}

function fixNullable(schema: OpenAPIV3.SchemaObject): OpenAPIV3.SchemaObject {
  if (typeof schema !== 'object' || schema === null) return schema;

  const newSchema = structuredClone(schema);

  if ('nullable' in newSchema) {
    // delete newSchema.nullable;
  }

  if ('anyOf' in newSchema && Array.isArray(newSchema.anyOf)) {
    newSchema.anyOf = newSchema.anyOf.map((subSchema) => {
      return fixNullable(subSchema as OpenAPIV3.SchemaObject);
    });
  }

  if ('properties' in newSchema) {
    for (const key in newSchema.properties) {
      newSchema.properties[key] = fixNullable(
        newSchema.properties[key] as OpenAPIV3.SchemaObject,
      );
    }
  }

  if ('items' in newSchema) {
    newSchema.items = fixNullable(newSchema.items as OpenAPIV3.SchemaObject);
  }

  return newSchema;
}

function validateExample(
  schema: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject | null | undefined,
  example: unknown,
): [boolean, ErrorObject[]?] {
  if (!schema || !example) return [false];

  const fixedSchema = fixNullable(schema as OpenAPIV3.SchemaObject);
  const validate = ajv.compile(fixedSchema);
  const res = validate(example);

  return [res, validate.errors ? validate.errors : undefined];
}

if (!swaggerData.paths) {
  throw new Error(`Paths object undefined`);
}

it('describes bearer API keys without claiming they are JWTs', () => {
  const bearerAuth = swaggerData.components?.securitySchemes?.bearerAuth;

  expect(bearerAuth).toEqual(
    expect.objectContaining({
      type: 'http',
      scheme: 'bearer',
    }),
  );
  expect(bearerAuth).not.toHaveProperty('bearerFormat');
});

it('programme endpoints are tagged as programmes', () => {
  const programmePaths = [
    '/subjects/{subject}/programmes',
    '/programmes/{programme}',
    '/programmes/{programme}/assets',
    '/programmes/{programme}/questions',
    '/programmes/{programme}/units',
  ];

  for (const path of programmePaths) {
    const methods = swaggerData.paths?.[path];
    const operation = methods?.get;

    if (!operation) {
      expect.fail(`GET ${path} missing operation`);
    }

    expect(operation.tags).toContain('programmes');
  }

  expect(
    swaggerData.paths?.['/subjects/{subject}/programmes/{programme}'],
  ).toBeUndefined();
  expect(
    swaggerData.paths?.['/subjects/{subject}/programmes/{programme}/assets'],
  ).toBeUndefined();
  expect(
    swaggerData.paths?.['/subjects/{subject}/programmes/{programme}/questions'],
  ).toBeUndefined();
  expect(
    swaggerData.paths?.['/subjects/{subject}/programmes/{programme}/units'],
  ).toBeUndefined();
});

for (const [path, methods] of Object.entries(swaggerData.paths)) {
  if (!methods) continue;

  for (const [method, details] of Object.entries(methods)) {
    // also check if details is an object
    if (!details || typeof details !== 'object') continue;

    if (!('responses' in details)) {
      continue;
    }

    it(`${method.toUpperCase()} ${path} should have a description`, () => {
      if (details.description === undefined) {
        expect.fail(`${method.toUpperCase()} ${path} missing description`);
      }
    });

    if (!details.responses) continue;

    for (const [statusCode, response] of Object.entries(details.responses)) {
      if (statusCode === 'default') continue;
      let resolvedResponse: typeof response | null = response;

      // Resolve references in responses
      if ('$ref' in response) {
        resolvedResponse = resolveRef(response.$ref);
        if (!resolvedResponse) {
          it(`${method.toUpperCase()} ${path} - Response reference should exist`, () => {
            throw new Error(`Response reference not found: ${response.$ref}`);
          });
          continue;
        }
      }

      if (!('content' in resolvedResponse)) continue;

      const content = resolvedResponse?.content?.['application/json'];
      it(`${method.toUpperCase()} ${path} should have an application/json response schema`, () => {
        if (!content) {
          expect.fail(
            `${method.toUpperCase()} ${path} missing application/json response schema`,
          );
        }
      });

      if (!content) continue;

      const schemaRef = (
        content.schema && '$ref' in content.schema
          ? getSchema(content.schema.$ref)
          : content.schema
      ) as OpenAPIV3.SchemaObject;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const example = content.example ?? buildExampleFromSchema(schemaRef);
      it(`${method.toUpperCase()} ${path} should have a response example`, () => {
        if (!example) {
          expect.fail(`${method.toUpperCase()} ${path} missing example`);
        }
      });

      it(`${method.toUpperCase()} ${path} response example should match schema`, () => {
        if (!schemaRef) {
          throw new Error(
            `Schema not found for ${method.toUpperCase()} ${path} (${statusCode})`,
          );
        }

        const [isValid, errors = null] = validateExample(schemaRef, example);

        if (!isValid) {
          //// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          // console.log(JSON.stringify({ schemaRef, example }, null, 2));
          console.log(errors);
          throw new Error(`Example does not match schema.`);
        }
        expect(isValid).toBe(true);
      });
    }
  }
}
