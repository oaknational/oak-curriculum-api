# API endpoints

Purpose

- Link each API endpoint to the source file where it is defined.

Notes

- Public v0 endpoints are served under `/api/v0`.
- Most public v0 endpoint paths are defined in handler `openapi` metadata and routed through [`src/app/api/v0/[...trpc]/route.ts`](../src/app/api/v0/%5B...trpc%5D/route.ts).
- Response and request shapes remain defined by the Zod schemas and generated OpenAPI output, not this file.
- These list endpoints support `limit` and `offset` query params for pagination:
	- `/api/v0/key-stages/{keyStage}/subject/{subject}/lessons`
	- `/api/v0/key-stages/{keyStage}/subject/{subject}/questions`
	- `/api/v0/key-stages/{keyStage}/subject/{subject}/units`
	- `/api/v0/key-stages/{keyStage}/subject/{subject}/assets`
- For questions list endpoints, `limit` has a maximum value of `100`.
- `/api/v0/lessons/{lesson}/assets/{type}` never returns the file body itself. It
	responds `302` for every asset type: `video` redirects to the CDN, and every
	other type redirects to a signed Google Cloud Storage URL valid for 15 minutes
	(see `SIGNED_URL_TTL_MS` in
	[`src/lib/handlers/assets/helpers.ts`](../src/lib/handlers/assets/helpers.ts)).
	Browser callers using `fetch`/XHR need CORS configured on the asset bucket,
	because the redirect target is not served by this app.

## Public v0 endpoints

| Method | Endpoint                                                           | Definition                                                                                                                                                                                                                             |
| ------ | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/v0/key-stages`                                               | [`src/lib/handlers/keyStages/keyStages.ts`](../src/lib/handlers/keyStages/keyStages.ts#L14)                                                                                                                                            |
| GET    | `/api/v0/key-stages/{keyStage}/subject/{subject}/assets`           | [`src/lib/handlers/assets/assets.ts`](../src/lib/handlers/assets/assets.ts#L380)                                                                                                                                                       |
| GET    | `/api/v0/key-stages/{keyStage}/subject/{subject}/lessons`          | [`src/lib/handlers/keyStageSubjectLessons/keyStageSubjectLessons.ts`](../src/lib/handlers/keyStageSubjectLessons/keyStageSubjectLessons.ts#L19)                                                                                        |
| GET    | `/api/v0/key-stages/{keyStage}/subject/{subject}/questions`        | [`src/lib/handlers/questions/questions.ts`](../src/lib/handlers/questions/questions.ts#L291)                                                                                                                                           |
| GET    | `/api/v0/key-stages/{keyStage}/subject/{subject}/check-restricted` | [`src/lib/handlers/keyStageSubjectLessons/keyStageSubjectLessons.ts`](../src/lib/handlers/keyStageSubjectLessons/keyStageSubjectLessons.ts#L160)                                                                                       |
| GET    | `/api/v0/key-stages/{keyStage}/subject/{subject}/units`            | [`src/lib/handlers/allKeyStageAndSubjectUnits/allKeyStageAndSubjectUnits.ts`](../src/lib/handlers/allKeyStageAndSubjectUnits/allKeyStageAndSubjectUnits.ts#L20)                                                                        |
| GET    | `/api/v0/keywords`                                                 | [`src/lib/handlers/keywords/keywords.ts`](../src/lib/handlers/keywords/keywords.ts#L19)                                                                                                                                                |
| POST   | `/api/v0/lessons/check-restricted`                                 | [`src/lib/handlers/lesson/lesson.ts`](../src/lib/handlers/lesson/lesson.ts#L67)                                                                                                                                                        |
| GET    | `/api/v0/lessons/{lesson}/assets`                                  | [`src/lib/handlers/assets/assets.ts`](../src/lib/handlers/assets/assets.ts#L545)                                                                                                                                                       |
| GET    | `/api/v0/lessons/{lesson}/assets/{type}`                           | [`src/lib/handlers/assets/assets.ts`](../src/lib/handlers/assets/assets.ts#L740); download route in [`src/app/api/v0/lessons/[lesson]/assets/[type]/route.ts`](../src/app/api/v0/lessons/%5Blesson%5D/assets/%5Btype%5D/route.ts#L119) — always responds `302`; see note below |
| GET    | `/api/v0/lessons/{lesson}/quiz`                                    | [`src/lib/handlers/questions/questions.ts`](../src/lib/handlers/questions/questions.ts#L53)                                                                                                                                            |
| GET    | `/api/v0/lessons/{lesson}/summary`                                 | [`src/lib/handlers/lesson/lesson.ts`](../src/lib/handlers/lesson/lesson.ts#L46)                                                                                                                                                        |
| GET    | `/api/v0/lessons/{lesson}/transcript`                              | [`src/lib/handlers/transcript/transcript.ts`](../src/lib/handlers/transcript/transcript.ts#L18)                                                                                                                                        |
| GET    | `/api/v0/rate-limit`                                               | [`src/lib/handlers/rate/rate.ts`](../src/lib/handlers/rate/rate.ts#L13)                                                                                                                                                                |
| GET    | `/api/v0/search/lessons`                                           | [`src/lib/handlers/lesson/lesson.ts`](../src/lib/handlers/lesson/lesson.ts#L218)                                                                                                                                                       |
| GET    | `/api/v0/search/transcripts`                                       | [`src/lib/handlers/searchTranscripts/searchTranscripts.ts`](../src/lib/handlers/searchTranscripts/searchTranscripts.ts#L16)                                                                                                            |
| GET    | `/api/v0/sequences/{sequence}/assets`                              | [`src/lib/handlers/assets/assets.ts`](../src/lib/handlers/assets/assets.ts#L240)                                                                                                                                                       |
| GET    | `/api/v0/subjects/{subject}/programmes`                            | [`src/lib/handlers/programmes/programmes.ts`](../src/lib/handlers/programmes/programmes.ts#L84)                                                                                                                                        |
| GET    | `/api/v0/programmes/{programme}`                                   | [`src/lib/handlers/programmes/programmes.ts`](../src/lib/handlers/programmes/programmes.ts#L131)                                                                                                                                       |
| GET    | `/api/v0/programmes/{programme}/assets`                            | [`src/lib/handlers/assets/assets.ts`](../src/lib/handlers/assets/assets.ts#L571)                                                                                                                                                       |
| GET    | `/api/v0/programmes/{programme}/questions`                         | [`src/lib/handlers/questions/questions.ts`](../src/lib/handlers/questions/questions.ts#L449)                                                                                                                                           |
| GET    | `/api/v0/programmes/{programme}/units`                             | [`src/lib/handlers/programmes/programmes.ts`](../src/lib/handlers/programmes/programmes.ts#L208)                                                                                                                                       |
| GET    | `/api/v0/sequences/{sequence}/questions`                           | [`src/lib/handlers/questions/questions.ts`](../src/lib/handlers/questions/questions.ts#L142)                                                                                                                                           |
| GET    | `/api/v0/sequences/{sequence}/units`                               | [`src/lib/handlers/sequences/sequences.ts`](../src/lib/handlers/sequences/sequences.ts#L262)                                                                                                                                           |
| GET    | `/api/v0/subjects`                                                 | [`src/lib/handlers/subjects/subjects.ts`](../src/lib/handlers/subjects/subjects.ts#L28)                                                                                                                                                |
| GET    | `/api/v0/subjects/{subject}`                                       | [`src/lib/handlers/subjects/subjects.ts`](../src/lib/handlers/subjects/subjects.ts#L47)                                                                                                                                                |
| GET    | `/api/v0/subjects/{subject}/key-stages`                            | [`src/lib/handlers/subjects/subjects.ts`](../src/lib/handlers/subjects/subjects.ts#L67)                                                                                                                                                |
| GET    | `/api/v0/sequences/{sequence}`                                     | [`src/lib/handlers/sequences/sequences.ts`](../src/lib/handlers/sequences/sequences.ts#L198)                                                                                                                                           |
| GET    | `/api/v0/subjects/{subject}/years`                                 | [`src/lib/handlers/subjects/subjects.ts`](../src/lib/handlers/subjects/subjects.ts#L87)                                                                                                                                                |
| GET    | `/api/v0/swagger.json`                                             | [`src/app/api/v0/swagger.json/route.ts`](../src/app/api/v0/swagger.json/route.ts#L3)                                                                                                                                                   |
| GET    | `/api/v0/threads`                                                  | [`src/lib/handlers/threads/threads.ts`](../src/lib/handlers/threads/threads.ts#L31)                                                                                                                                                    |
| GET    | `/api/v0/threads/{threadSlug}/units`                               | [`src/lib/handlers/threads/threads.ts`](../src/lib/handlers/threads/threads.ts#L69)                                                                                                                                                    |
| GET    | `/api/v0/units/{unit}/summary`                                     | [`src/lib/handlers/units/units.ts`](../src/lib/handlers/units/units.ts#L41)                                                                                                                                                            |

## Other API routes

Some operational route files export additional HTTP verbs from the same handler;
the table lists the primary verb used by consumers.

The `/api/admin/*` routes are gated by HTTP Basic auth in
[`src/middleware.ts`](../src/middleware.ts), which matches any path under
`/admin` or `/api/admin` against `AUTH_USERNAME` and `AUTH_PASSWORD`. They are
internal tooling and are deliberately absent from `swagger.json`.

| Method | Endpoint                          | Definition                                                                                                      |
| ------ | --------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/admin/users`                | [`src/app/api/admin/users/route.ts`](../src/app/api/admin/users/route.ts)                                       |
| POST   | `/api/admin/users`                | [`src/app/api/admin/users/route.ts`](../src/app/api/admin/users/route.ts)                                       |
| GET    | `/api/admin/users/{id}`           | [`src/app/api/admin/users/[id]/route.ts`](../src/app/api/admin/users/%5Bid%5D/route.ts)                         |
| PATCH  | `/api/admin/users/{id}`           | [`src/app/api/admin/users/[id]/route.ts`](../src/app/api/admin/users/%5Bid%5D/route.ts)                         |
| POST   | `/api/admin/users/{id}/roll-key`  | [`src/app/api/admin/users/[id]/roll-key/route.ts`](../src/app/api/admin/users/%5Bid%5D/roll-key/route.ts)       |
| POST   | `/api/bulk`                       | [`src/app/api/bulk/route.ts`](../src/app/api/bulk/route.ts#L158)                                                |
| GET    | `/api/bulk/schema.json`           | [`src/app/api/bulk/schema.json/route.ts`](../src/app/api/bulk/schema.json/route.ts#L4)                          |
| GET    | `/api/health`                     | [`src/app/api/health/route.ts`](../src/app/api/health/route.ts#L30)                                             |
| GET    | `/api/pingdom`                    | [`src/app/api/pingdom/route.ts`](../src/app/api/pingdom/route.ts#L42)                                           |

## Discovery resources

| Method | Endpoint                                         | Definition                                                                                                       |
| ------ | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| GET    | `/.well-known/api-catalog`                       | [`public/.well-known/api-catalog`](../public/.well-known/api-catalog)                                            |
| GET    | `/.well-known/agent-skills/index.json`           | [`public/.well-known/agent-skills/index.json`](../public/.well-known/agent-skills/index.json)                    |
| GET    | `/.well-known/agent-skills/oak-openapi/SKILL.md` | [`public/.well-known/agent-skills/oak-openapi/SKILL.md`](../public/.well-known/agent-skills/oak-openapi/SKILL.md) |
| GET    | `/auth.md`                                       | [`public/auth.md`](../public/auth.md)                                                                            |
| GET    | `/robots.txt`                                    | [`public/robots.txt`](../public/robots.txt)                                                                      |
