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
- A lesson-scoped endpoint answers `404` for a lesson whose subject this API
	does not serve, before it says anything about third-party content
	restrictions, and `/lessons/check-restricted` leaves such a lesson out of its
	response altogether. The subject allow-list is `isSubjectAllowed` in
	[`src/lib/queryGate.ts`](../src/lib/queryGate.ts), which the gate applies
	first.
- From `/api/v1`, both check-restricted endpoints
	(`POST /lessons/check-restricted` and
	`GET /key-stages/{keyStage}/subject/{subject}/check-restricted`) take a
	`detailed` query parameter. With `detailed=true` or `detailed=1`, each
	lesson's value is an object giving the status of every asset type the gate
	knows about (each download type, plus `transcript` and `quiz`) instead of a
	single status; without it the response is unchanged. The per-type statuses
	come from `getLessonsAssetRestrictionStatuses` in
	[`src/lib/queryGate.ts`](../src/lib/queryGate.ts), and the single status is
	those collapsed: `restricted` when any asset type is. `/api/v0` is frozen and
	ignores the parameter. The POST endpoint reads it from the URL, since its
	input is otherwise the JSON body: see `urlQuery` in
	[`src/lib/trpc.ts`](../src/lib/trpc.ts).
- From `/api/v1`, `GET /lessons/{lesson}/summary` includes `equipment`: the
	equipment and resources needed to teach the lesson, taken from the first
	entry of the lesson view's `lessonEquipmentAndResources`, or `null` when
	there are none. `/api/v0` is frozen and leaves the field out.
- `/lessons/{lesson}/assets/{type}` never returns the file body itself. It
	responds `302` for every asset type: `video` redirects to the CDN, and every
	other type redirects to a signed Google Cloud Storage URL valid for 15 minutes
	(see `SIGNED_URL_TTL_MS` in
	[`src/lib/handlers/assets/helpers.ts`](../src/lib/handlers/assets/helpers.ts#L7)).
	Browser callers using `fetch`/XHR need CORS configured on the asset bucket,
	because the redirect target is not served by this app. A type the lesson
	doesn't have (one `/lessons/{lesson}/assets` would not list, such as a video
	the data only reports as the empty Mux stream) responds `404` instead.

## Public endpoints

| Method | Endpoint                                                           | Definition                                                                                                                                                                                                                             |
| ------ | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/key-stages`                                               | [`src/lib/handlers/keyStages/keyStages.ts`](../src/lib/handlers/keyStages/keyStages.ts#L14)                                                                                                                                            |
| GET    | `/key-stages/{keyStage}/subject/{subject}/assets`           | [`src/lib/handlers/assets/assets.ts`](../src/lib/handlers/assets/assets.ts#L350)                                                                                                                                                       |
| GET    | `/key-stages/{keyStage}/subject/{subject}/lessons`          | [`src/lib/handlers/keyStageSubjectLessons/keyStageSubjectLessons.ts`](../src/lib/handlers/keyStageSubjectLessons/keyStageSubjectLessons.ts#L121)                                                                                        |
| GET    | `/key-stages/{keyStage}/subject/{subject}/questions`        | [`src/lib/handlers/questions/questions.ts`](../src/lib/handlers/questions/questions.ts#L264)                                                                                                                                           |
| GET    | `/key-stages/{keyStage}/subject/{subject}/check-restricted` | [`src/lib/handlers/keyStageSubjectLessons/keyStageSubjectLessons.ts`](../src/lib/handlers/keyStageSubjectLessons/keyStageSubjectLessons.ts#L264) (v0); v1 twin at [L290](../src/lib/handlers/keyStageSubjectLessons/keyStageSubjectLessons.ts#L290), which takes `detailed`                                                                                       |
| GET    | `/key-stages/{keyStage}/subject/{subject}/units`            | [`src/lib/handlers/allKeyStageAndSubjectUnits/allKeyStageAndSubjectUnits.ts`](../src/lib/handlers/allKeyStageAndSubjectUnits/allKeyStageAndSubjectUnits.ts#L21)                                                                        |
| GET    | `/keywords`                                                 | [`src/lib/handlers/keywords/keywords.ts`](../src/lib/handlers/keywords/keywords.ts#L17)                                                                                                                                                |
| POST   | `/lessons/check-restricted`                                 | [`src/lib/handlers/lesson/lesson.ts`](../src/lib/handlers/lesson/lesson.ts#L73) (v0); v1 twin at [L95](../src/lib/handlers/lesson/lesson.ts#L95), which takes `detailed`                                                                                                                                                        |
| GET    | `/lessons/{lesson}/assets`                                  | [`src/lib/handlers/assets/assets.ts`](../src/lib/handlers/assets/assets.ts#L535)                                                                                                                                                       |
| GET    | `/lessons/{lesson}/assets/{type}`                           | [`src/lib/handlers/assets/assets.ts`](../src/lib/handlers/assets/assets.ts#L721); download handler in [`src/lib/handlers/assetDownload/assetDownload.ts`](../src/lib/handlers/assetDownload/assetDownload.ts#L332) — responds `302`, or `404` for an asset the lesson doesn't have; see note above |
| GET    | `/lessons/{lesson}/quiz`                                    | [`src/lib/handlers/questions/questions.ts`](../src/lib/handlers/questions/questions.ts#L49)                                                                                                                                            |
| GET    | `/lessons/{lesson}/summary`                                 | [`src/lib/handlers/lesson/lesson.ts`](../src/lib/handlers/lesson/lesson.ts#L123) (v0); v1 twin at [L143](../src/lib/handlers/lesson/lesson.ts#L143), which adds `equipment`                                                                                                                                                        |
| GET    | `/lessons/{lesson}/transcript`                              | [`src/lib/handlers/transcript/transcript.ts`](../src/lib/handlers/transcript/transcript.ts#L18)                                                                                                                                        |
| GET    | `/rate-limit`                                               | [`src/lib/handlers/rate/rate.ts`](../src/lib/handlers/rate/rate.ts#L13)                                                                                                                                                                |
| GET    | `/search/lessons`                                           | [`src/lib/handlers/lesson/lesson.ts`](../src/lib/handlers/lesson/lesson.ts#L156)                                                                                                                                                       |
| GET    | `/search/transcripts`                                       | [`src/lib/handlers/searchTranscripts/searchTranscripts.ts`](../src/lib/handlers/searchTranscripts/searchTranscripts.ts#L21)                                                                                                            |
| GET    | `/sequences/{sequence}/assets`                              | [`src/lib/handlers/assets/assets.ts`](../src/lib/handlers/assets/assets.ts#L226)                                                                                                                                                       |
| GET    | `/subjects/{subject}/programmes`                            | [`src/lib/handlers/programmes/programmes.ts`](../src/lib/handlers/programmes/programmes.ts#L30)                                                                                                                                        |
| GET    | `/programmes/{programme}`                                   | [`src/lib/handlers/programmes/programmes.ts`](../src/lib/handlers/programmes/programmes.ts#L77)                                                                                                                                       |
| GET    | `/programmes/{programme}/assets`                            | [`src/lib/handlers/assets/assets.ts`](../src/lib/handlers/assets/assets.ts#L571)                                                                                                                                                       |
| GET    | `/programmes/{programme}/questions`                         | [`src/lib/handlers/questions/questions.ts`](../src/lib/handlers/questions/questions.ts#L385)                                                                                                                                           |
| GET    | `/programmes/{programme}/units`                             | [`src/lib/handlers/programmes/programmes.ts`](../src/lib/handlers/programmes/programmes.ts#L162)                                                                                                                                       |
| GET    | `/sequences/{sequence}/questions`                           | [`src/lib/handlers/questions/questions.ts`](../src/lib/handlers/questions/questions.ts#L132)                                                                                                                                           |
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
