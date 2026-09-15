---
name: oak-openapi
description: Use Oak National Academy's OpenAPI to retrieve UK curriculum data — key stages, subjects, units, lessons, quizzes, transcripts, and lesson assets. Load when an agent needs authoritative, curriculum-aligned teaching content for England's national curriculum, or needs to discover the API's endpoints, request an API key, or run bulk exports.
---

# Oak OpenAPI

Oak National Academy publishes a free, curriculum-aligned catalogue of UK
teaching resources through a public HTTP API. Use this skill to find and fetch
key stages, subjects, units, lessons, quizzes, transcripts, and lesson assets.

## Base URL

```
https://open-api.thenational.academy
```

All public endpoints are served under `/api/v1`. `/api/v0` remains
available and frozen: it takes fixes, but new endpoints and fields land in
`/api/v1` only.

## Authentication

Send an Oak-issued API key as an opaque bearer credential on every request:

```http
Authorization: Bearer <API_KEY>
```

Keys are issued out of band — there is no OAuth, OpenID Connect, or dynamic
client registration. Request a key via the form linked from `/auth.md`.

## Discovering the API

- Machine-readable OpenAPI description: `/api/v1/swagger.json`
- Endpoint / service catalogue: `/.well-known/api-catalog`
- Authentication details: `/auth.md`
- Human documentation: `/docs/about-oaks-api/api-overview`
- Interactive playground: `/playground`

Any HTML documentation page can be fetched as Markdown by sending an
`Accept: text/markdown` request header.

## Common tasks

- List the curriculum tree: `GET /api/v1/key-stages`, then
  `GET /api/v1/subjects`, then drill into units and lessons.
- Fetch a lesson: `GET /api/v1/lessons/{lesson}/summary`, plus
  `/quiz`, `/transcript`, and `/assets` for its quiz, transcript, and media.
- Search lessons or transcripts: `GET /api/v1/search/lessons` and
  `GET /api/v1/search/transcripts`.
- Check your quota: `GET /api/v1/rate-limit`.

List endpoints for questions accept `limit` (max 100) and `offset` query
parameters for pagination.

## Bulk data

For whole-catalogue exports rather than per-request calls, see the bulk request
schema at `/api/bulk/schema.json` and the guide at `/bulk-download`.

## Notes

- Data shapes are defined by the API's Zod schemas and the generated OpenAPI
  document; treat `/api/v1/swagger.json` as the source of truth for request and
  response contracts.
- Be a good citizen: honour rate limits and cache responses where practical.
