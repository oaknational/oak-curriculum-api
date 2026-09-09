import type { ApiMajor } from '@/lib/apiVersion';
import { isFrozen, successorMajor } from '@/lib/apiVersion';
import { apiBaseUrl } from '@/lib/baseUrl';
import { VERSION } from '@/lib/version';
import { routerForMajor } from '@/lib/versionedRouter';

import { generateOpenApiDocument, type OpenAPIObject } from 'trpc-to-openapi';

import { applyRequestMetadata } from './requestMetadata';

const bearerAuth = {
  type: 'http',
  scheme: 'bearer',
} as const;

// trpc-to-openapi can only emit a single 200 success response per operation, so
// the redirect that GET /lessons/{lesson}/assets/{type} returns for videos has
// nowhere to live in the procedure's `.meta()`. Non-video assets are streamed
// back as a 200 (application/octet-stream); a `type=video` request instead gets
// a 302 pointing at the CDN-hosted file (see the handler at
// src/app/api/v0/lessons/[lesson]/assets/[type]/route.ts). Inject that 302 here.
function applyVideoRedirectResponse(document: OpenAPIObject): OpenAPIObject {
  const operation = document.paths?.['/lessons/{lesson}/assets/{type}']?.get;
  if (operation?.responses) {
    operation.responses['302'] = {
      description:
        'Redirect to the video file. Returned only for `type=video` — the ' +
        'file is served from a CDN, so follow the `Location` header to ' +
        'download it.',
      headers: {
        Location: {
          description: 'Absolute URL of the video file to download.',
          schema: { type: 'string', format: 'uri' },
        },
      },
    };
  }
  return document;
}

const OPERATION_METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
] as const;

// trpc-to-openapi derives each operationId from the tRPC procedure path with
// dots swapped for dashes (e.g. `getLessons-searchByTextSimilarity`). Collapse
// those dashes into a single camelCase identifier, title-casing the segment
// that follows each dash: `getLessons-searchByTextSimilarity` becomes
// `getLessonsSearchByTextSimilarity`.
function camelCaseOperationIds(document: OpenAPIObject): OpenAPIObject {
  for (const pathItem of Object.values(document.paths ?? {})) {
    if (!pathItem) continue;
    for (const method of OPERATION_METHODS) {
      const operation = pathItem[method];
      if (operation?.operationId) {
        operation.operationId = operation.operationId.replace(
          /-+(.)/g,
          (_match: string, nextChar: string) => nextChar.toUpperCase(),
        );
      }
    }
  }
  return document;
}

const DESCRIPTION = `This Oak Curriculum API is an intermediary that enables software applications to communicate with each other to exchange - in this case - data and assets. Through the Oak Curriculum API, you will have access to a wide range of educational content across subjects for key stages 1-4.

### How could you use this API?

Our aim is that the curriculum data and lessons resources in the Oak Curriculum API can be used flexibly within almost any product or service that would benefit teachers and pupils.

To give you some inspiration, here are just a few examples of how you could use the Oak Curriculum API:

- Use the endpoint \`GET /lessons/{lesson}/summary\` to retrieve common misconceptions and suggested responses. This data could be used to train the AI in a revision tool to identify and respond to misconceptions in pupil answers.
- Use the endpoint \`GET /sequences/{sequence}/units\` to retrieve threads in sequence order, plus threads that demonstrate how common bodies of knowledge build across the curriculum. This data could be used in teacher training materials to demonstrate a sequenced, coherent curriculum.
- Use the endpoint \`GET /key-stages/{keyStage}/subject/{subject}/questions\` to retrieve the quiz questions and answers for a given subject and key stage. This data could be used to build a quizzing tool that supports formative assessment.
- Use the endpoint \`GET /lessons/{lesson}/assets\` to retrieve all of the resources for a given lesson. You could embed these lesson resources in your own product or service to give teachers a starting point for their lesson planning.

Full documentation for the Oak Curriculum API is available on the URL below:
`;

/**
 * The major each example URL in the schemas is written against.
 *
 * Examples are authored with real, copy-pasteable URLs, and the schemas they
 * hang off are shared between majors, so a document for any other major has to
 * retarget them.
 */
const EXAMPLE_SOURCE_MAJOR = 'v0';

// A whole-document pass rather than a walk of `example` fields: descriptions
// carry the same URLs and should be retargeted too. A no-op for the major the
// examples were written against.
function applyExampleMajor(
  document: OpenAPIObject,
  major: ApiMajor,
): OpenAPIObject {
  const from = `/api/${EXAMPLE_SOURCE_MAJOR}/`;
  const to = `/api/${major}/`;

  if (from === to) {
    return document;
  }

  return JSON.parse(
    JSON.stringify(document).replaceAll(from, to),
  ) as OpenAPIObject;
}

function describeMajor(major: ApiMajor): string {
  const successor = successorMajor(major);

  if (isFrozen(major) && successor) {
    return `\n\nThis document describes \`/api/${major}\`, which is frozen: it continues to receive fixes, but new endpoints and fields land in \`/api/${successor}\` ([\`/api/${successor}/swagger.json\`](/api/${successor}/swagger.json)).`;
  }

  return `\n\nThis document describes \`/api/${major}\`, the current major.`;
}

const documents = new Map<ApiMajor, OpenAPIObject>();

/**
 * The OpenAPI document for one major.
 *
 * Built from the same derived router that serves the requests, so the document
 * always describes exactly the surface on offer. `generateOpenApiDocument`
 * returns a fresh object each call, so the transforms below never mutate shared
 * state.
 *
 * trpc-to-openapi rebuilds query parameters from the input schema's shape,
 * which loses the descriptions and cross-field rules declared on it, so we copy
 * them back onto the document afterwards.
 */
export function openApiDocumentFor(major: ApiMajor): OpenAPIObject {
  const cached = documents.get(major);
  if (cached) {
    return cached;
  }

  const router = routerForMajor(major);

  const document = applyExampleMajor(
    camelCaseOperationIds(
      applyVideoRedirectResponse(
        applyRequestMetadata(
          generateOpenApiDocument(router, {
            title: 'Oak Curriculum API',
            version: VERSION,
            baseUrl: apiBaseUrl(major),
            docsUrl: '/docs',
            description: DESCRIPTION + describeMajor(major),
            securitySchemes: {
              bearerAuth,
            },
            tags: [
              'internal',
              'assets',
              'lessons',
              'lists',
              'programmes',
              'questions',
              'search',
              'sequences',
              'units',
            ],
          }),
          router,
        ),
      ),
    ),
    major,
  );

  documents.set(major, document);
  return document;
}
