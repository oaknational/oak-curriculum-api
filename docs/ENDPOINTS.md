# API endpoints

Purpose

- Link each API endpoint to the source file where it is defined.

Notes

- Public endpoints are served under every major the app mounts — currently `/api/v1` (current) and `/api/v0` (frozen). The paths below omit the major segment, because it is the only difference between them.
- Which majors exist, and which is current, comes from [`src/lib/apiVersion.ts`](../src/lib/apiVersion.ts). See [RELEASING.md](RELEASING.md#the-url-major-is-the-semver-major).
- Most public endpoint paths are defined in handler `openapi` metadata and routed through the shared handler each major mounts, e.g. [`src/app/api/v1/[...trpc]/route.ts`](../src/app/api/v1/%5B...trpc%5D/route.ts).
- Response and request shapes remain defined by the Zod schemas and generated OpenAPI output, not this file.
- These list endpoints support `limit` and `offset` query params for pagination:
	- `/key-stages/{keyStage}/subject/{subject}/lessons`
	- `/key-stages/{keyStage}/subject/{subject}/questions`
	- `/key-stages/{keyStage}/subject/{subject}/units`
	- `/key-stages/{keyStage}/subject/{subject}/assets`
- For questions list endpoints, `limit` has a maximum value of `100`.

## Public endpoints

| Method | Endpoint                                                           | Definition                                                                                                                                                                                                                             |
| ------ | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/key-stages`                                               | [`src/lib/handlers/keyStages/keyStages.ts`](../src/lib/handlers/keyStages/keyStages.ts#L14)                                                                                                                                            |
| GET    | `/key-stages/{keyStage}/subject/{subject}/assets`           | [`src/lib/handlers/assets/assets.ts`](../src/lib/handlers/assets/assets.ts#L380)                                                                                                                                                       |
| GET    | `/key-stages/{keyStage}/subject/{subject}/lessons`          | [`src/lib/handlers/keyStageSubjectLessons/keyStageSubjectLessons.ts`](../src/lib/handlers/keyStageSubjectLessons/keyStageSubjectLessons.ts#L19)                                                                                        |
| GET    | `/key-stages/{keyStage}/subject/{subject}/questions`        | [`src/lib/handlers/questions/questions.ts`](../src/lib/handlers/questions/questions.ts#L291)                                                                                                                                           |
| GET    | `/key-stages/{keyStage}/subject/{subject}/check-restricted` | [`src/lib/handlers/keyStageSubjectLessons/keyStageSubjectLessons.ts`](../src/lib/handlers/keyStageSubjectLessons/keyStageSubjectLessons.ts#L160)                                                                                       |
| GET    | `/key-stages/{keyStage}/subject/{subject}/units`            | [`src/lib/handlers/allKeyStageAndSubjectUnits/allKeyStageAndSubjectUnits.ts`](../src/lib/handlers/allKeyStageAndSubjectUnits/allKeyStageAndSubjectUnits.ts#L20)                                                                        |
| GET    | `/keywords`                                                 | [`src/lib/handlers/keywords/keywords.ts`](../src/lib/handlers/keywords/keywords.ts#L19)                                                                                                                                                |
| POST   | `/lessons/check-restricted`                                 | [`src/lib/handlers/lesson/lesson.ts`](../src/lib/handlers/lesson/lesson.ts#L67)                                                                                                                                                        |
| GET    | `/lessons/{lesson}/assets`                                  | [`src/lib/handlers/assets/assets.ts`](../src/lib/handlers/assets/assets.ts#L545)                                                                                                                                                       |
| GET    | `/lessons/{lesson}/assets/{type}`                           | [`src/lib/handlers/assets/assets.ts`](../src/lib/handlers/assets/assets.ts#L707); download handler in [`src/lib/handlers/assetDownload/assetDownload.ts`](../src/lib/handlers/assetDownload/assetDownload.ts#L69) |
| GET    | `/lessons/{lesson}/quiz`                                    | [`src/lib/handlers/questions/questions.ts`](../src/lib/handlers/questions/questions.ts#L53)                                                                                                                                            |
| GET    | `/lessons/{lesson}/summary`                                 | [`src/lib/handlers/lesson/lesson.ts`](../src/lib/handlers/lesson/lesson.ts#L46)                                                                                                                                                        |
| GET    | `/lessons/{lesson}/transcript`                              | [`src/lib/handlers/transcript/transcript.ts`](../src/lib/handlers/transcript/transcript.ts#L18)                                                                                                                                        |
| GET    | `/rate-limit`                                               | [`src/lib/handlers/rate/rate.ts`](../src/lib/handlers/rate/rate.ts#L13)                                                                                                                                                                |
| GET    | `/search/lessons`                                           | [`src/lib/handlers/lesson/lesson.ts`](../src/lib/handlers/lesson/lesson.ts#L218)                                                                                                                                                       |
| GET    | `/search/transcripts`                                       | [`src/lib/handlers/searchTranscripts/searchTranscripts.ts`](../src/lib/handlers/searchTranscripts/searchTranscripts.ts#L16)                                                                                                            |
| GET    | `/sequences/{sequence}/assets`                              | [`src/lib/handlers/assets/assets.ts`](../src/lib/handlers/assets/assets.ts#L240)                                                                                                                                                       |
| GET    | `/subjects/{subject}/programmes`                            | [`src/lib/handlers/programmes/programmes.ts`](../src/lib/handlers/programmes/programmes.ts#L84)                                                                                                                                        |
| GET    | `/programmes/{programme}`                                   | [`src/lib/handlers/programmes/programmes.ts`](../src/lib/handlers/programmes/programmes.ts#L131)                                                                                                                                       |
| GET    | `/programmes/{programme}/assets`                            | [`src/lib/handlers/assets/assets.ts`](../src/lib/handlers/assets/assets.ts#L571)                                                                                                                                                       |
| GET    | `/programmes/{programme}/questions`                         | [`src/lib/handlers/questions/questions.ts`](../src/lib/handlers/questions/questions.ts#L449)                                                                                                                                           |
| GET    | `/programmes/{programme}/units`                             | [`src/lib/handlers/programmes/programmes.ts`](../src/lib/handlers/programmes/programmes.ts#L208)                                                                                                                                       |
| GET    | `/sequences/{sequence}/questions`                           | [`src/lib/handlers/questions/questions.ts`](../src/lib/handlers/questions/questions.ts#L142)                                                                                                                                           |
| GET    | `/sequences/{sequence}/units`                               | [`src/lib/handlers/sequences/sequences.ts`](../src/lib/handlers/sequences/sequences.ts#L262)                                                                                                                                           |
| GET    | `/subjects`                                                 | [`src/lib/handlers/subjects/subjects.ts`](../src/lib/handlers/subjects/subjects.ts#L28)                                                                                                                                                |
| GET    | `/subjects/{subject}`                                       | [`src/lib/handlers/subjects/subjects.ts`](../src/lib/handlers/subjects/subjects.ts#L47)                                                                                                                                                |
| GET    | `/subjects/{subject}/key-stages`                            | [`src/lib/handlers/subjects/subjects.ts`](../src/lib/handlers/subjects/subjects.ts#L67)                                                                                                                                                |
| GET    | `/sequences/{sequence}`                                     | [`src/lib/handlers/sequences/sequences.ts`](../src/lib/handlers/sequences/sequences.ts#L198)                                                                                                                                           |
| GET    | `/subjects/{subject}/years`                                 | [`src/lib/handlers/subjects/subjects.ts`](../src/lib/handlers/subjects/subjects.ts#L87)                                                                                                                                                |
| GET    | `/swagger.json`                                             | [`src/lib/api/swaggerRoute.ts`](../src/lib/api/swaggerRoute.ts#L7)                                                                                                                                                   |
| GET    | `/threads`                                                  | [`src/lib/handlers/threads/threads.ts`](../src/lib/handlers/threads/threads.ts#L31)                                                                                                                                                    |
| GET    | `/threads/{threadSlug}/units`                               | [`src/lib/handlers/threads/threads.ts`](../src/lib/handlers/threads/threads.ts#L69)                                                                                                                                                    |
| GET    | `/units/{unit}/summary`                                     | [`src/lib/handlers/units/units.ts`](../src/lib/handlers/units/units.ts#L41)                                                                                                                                                            |

## Other API routes

Some operational route files export additional HTTP verbs from the same handler;
the table lists the primary verb used by consumers.

The `/api/admin/*` routes are gated by HTTP Basic auth in
[`src/proxy.ts`](../src/proxy.ts), which matches any path under
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
