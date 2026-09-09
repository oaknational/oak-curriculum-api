import type { ApiMajor } from '@/lib/apiVersion';
import { openApiDocumentFor } from '@/lib/zod-openapi/schema/generateDocument';

import { withSuccessorLink } from './versionHeaders';

/** Serves one major's OpenAPI document. */
export function createSwaggerHandler(major: ApiMajor) {
  return (): Response =>
    withSuccessorLink(Response.json(openApiDocumentFor(major)), major);
}
