# Releasing

This project is versioned with [semantic versioning](https://semver.org) and
released automatically by [semantic-release](https://semantic-release.gitbook.io)
from conventional commit messages.

**The version tracks the API contract.** Only commits scoped `api` move it.
Everything else — the playground, the bulk pipeline, infrastructure, docs —
still deploys to production on merge, it just doesn't change the version or
appear in the changelog.

## What causes a release

| Commit                               | Result                |
| ------------------------------------ | --------------------- |
| `fix(api): …`                        | patch (`0.7.0→0.7.1`) |
| `perf(api): …` / `revert(api): …`    | patch                 |
| `feat(api): …`                       | minor (`0.7.0→0.8.0`) |
| `feat(api)!: …` / `BREAKING CHANGE:` | major (`0.7.0→1.0.0`) |
| Any other scope, or any other type   | no release            |

So `chore(api): tidy handler imports` deploys but doesn't release, and
`feat(playground): new footer` deploys but doesn't release. Only the four rows
above move the number.

The rules live in [`.releaserc.json`](../.releaserc.json). Two things about them
are non-obvious and easy to break:

- **Later rules override earlier ones.** The catch-all `{ "type": "*", "release":
  false }` must stay **first**, with the `api` rules after it. Put it last and
  nothing will ever release.
- **The `parserOpts` block is required for `!`.** Without it the default header
  pattern doesn't recognise `feat(api)!:` — the commit fails to parse entirely,
  contributing neither a release nor a changelog entry. The `BREAKING CHANGE:`
  footer works either way.

If you change those rules, verify them before merging (see
[Testing the rules](#testing-the-rules)).

## Scopes are checked selectively

[`commitlint.config.ts`](../commitlint.config.ts) requires a lower-case scope
from a fixed list on every commit except `docs`, `chore`, and `test`. Those
commit types may omit a scope or use any scope. For the other types, this exists
because the failure mode of scope gating is silent: `fix(API):` or `fix(apis):`
is a perfectly valid conventional commit that simply never matches the release
rules, so a real API change would ship with no version bump and no changelog
entry.

Requiring the scope catches "forgot to add one"; the enum catches "typed it
slightly wrong". Add to the list when a genuinely new area appears — it's a
guardrail, not a taxonomy.

`husky` checks this on commit locally. [`commitlint.yml`](../.github/workflows/commitlint.yml)
checks the whole PR range in CI, which covers commits made in the GitHub web UI
or with `--no-verify`.

**What it cannot catch** is misjudgement: deciding a change isn't an API change
when it is. Nothing automated will save you there, so when in doubt, scope it
`api` — an unnecessary patch release is cheap, a silently unreleased API change
is not.

## Valid scopes

- `api`
- `bulk`
- `ci`
- `deps`
- `docs`
- `infra`
- `playground`
- `release`
- `repo`

## How a release happens

1. You merge a PR to `main`. Vercel deploys it, as always — **every** merge
   deploys, regardless of scope.
2. [`release.yml`](../.github/workflows/release.yml) runs semantic-release.
3. If no `api`-scoped releasable commit has landed since the last release, it
   exits and nothing happens.
4. Otherwise it works out the next version, writes `CHANGELOG.md`,
   `package.json` and [`src/lib/version.ts`](../src/lib/version.ts), commits
   `chore(release): x.y.z [skip ci]` to `main`, tags `vx.y.z`, and publishes a
   GitHub Release.
5. That commit triggers a second Vercel deploy — the one that actually serves
   the new version.

**Accepted trade-off:** an `api` merge deploys twice, a couple of minutes apart,
and in the gap production reports the previous version in `swagger.json`. The
version's only surface is the OpenAPI document, so this is cosmetic.

Release notes are generated from commit subjects. They are what API consumers
read, so write `feat(api):` subjects for them, and edit the GitHub Release
afterwards if it warrants better prose.

## Branch protection

`main` is protected, and `GITHUB_TOKEN` cannot push to it. The release workflow
mints a token for a GitHub App on the bypass list via
`actions/create-github-app-token`, using two secrets:

| Secret                    | Value                       |
| ------------------------- | --------------------------- |
| `RELEASE_APP_ID`          | The App's ID                |
| `RELEASE_APP_PRIVATE_KEY` | The App's private key (PEM) |

The App needs `contents: write` on this repository and must be added to `main`'s
bypass list. Without it the workflow fails at the push step, after having
already tagged — so get it provisioned before the first `api` commit lands.

## The URL major is the semver major

The public API is served under `/api/v1`. That segment is bound to the project
version: `0.x` was served at `/api/v0`, `1.x` at `/api/v1`, `2.x` at `/api/v2`.
A breaking change bumps the major, which mints a new URL major and freezes the
previous one.

Because the binding is tight, `LATEST_API_MAJOR` in
[`src/lib/apiVersion.ts`](../src/lib/apiVersion.ts) is **derived** from
[`src/lib/version.ts`](../src/lib/version.ts) rather than maintained by hand —
two sources of truth could disagree, one cannot. `API_MAJORS` is still written
out, because Next resolves routes from static directories and the code cannot
discover them; `__tests__/api-version.test.ts` keeps the two in step.

This matters because the base URL is interpolated into live response payloads —
asset URLs and pagination links — so a bump must never move the URL space out
from under existing consumers. It does not: every major stays mounted, and each
serves its own URLs.

### Cutting a new major

1. Write the breaking change (see below). It releases the new version.
2. Add the major to `API_MAJORS`.
3. Create the three route files under `src/app/api/v<n>/`. Each is a six-line
   mount point over the factories in `src/lib/api/`; nothing is duplicated.
4. Mark anything the new major drops with `removedIn`. Anything it keeps needs
   no edit.
5. Pin the outgoing major in `FROZEN_AT` to the last version released while it
   was current — the release this bump replaces. Do it at merge time, so a late
   fix to the old major is not left out.
6. Update the discovery surfaces: `public/.well-known/api-catalog`,
   `public/robots.txt`, `public/auth.md`, the agent skill and its sha256 in
   `public/.well-known/agent-skills/index.json`, `next.config.mjs`, and
   `src/app/sitemap.ts`.
7. Update [ENDPOINTS.md](ENDPOINTS.md) and the docs.

Expect a short window between merging and releasing where the new major is
`pending`: its routes are live and correct, but the project version still names
the previous one, so that is still the current major. It resolves itself when
the release deploys, with no code change.

### Keeping an old major frozen

A frozen major takes fixes, but no new features. Two mechanisms hold that, and
both are needed:

- **`addedIn` / `removedIn`** keep new and superseded procedures out. A
  procedure written with `protectedProcedure` has no `addedIn` and is served
  only at the latest major, so forgetting to think about versions freezes the
  old ones rather than leaking into them. `v0Procedure` is the marker for
  everything that predates the split.
- **The contract snapshots** in `__tests__/__snapshots__/` catch everything
  else. Metadata cannot stop a shared Zod schema gaining a field, because the
  schemas are shared on purpose; the snapshot turns that into a CI failure.

Read a snapshot diff by which major it is on. On the current major it is
expected, and worth eyeballing as the API change it represents. On a frozen
major it is a red flag: justify it in the PR as a fix rather than a feature, or
rework it as a superseding procedure.

### Superseding an endpoint

`addedIn` gates whole procedures, and tRPC fixes `.output()` at definition time,
so a response shape cannot be chosen per request. To diverge an endpoint, keep
the old procedure and mark it `removedIn`, then add a twin at the same
`openapi.path` under a different router key:

```ts
getLesson: v0Procedure
  .meta({ removedIn: 'v2', openapi: { path: '/lessons/{lesson}/summary', ... } })
  .output(lessonSummaryResponseSchemaV1),

getLessonV2: protectedProcedure
  .meta({ openapi: { path: '/lessons/{lesson}/summary', operationId: 'getLessonsGetLesson', ... } })
  .output(lessonSummaryResponseSchema),
```

Each major's router holds exactly one of them, so there is no route collision
and each document describes one operation. Set `operationId` explicitly on the
twin so generated clients keep a stable name — operation ids are otherwise
identical across majors, deliberately, since renaming them would break anyone
who upgrades.

Duplication is paid at the point of divergence, not up front. That is the whole
reason the majors share one router.

## Releasing on 1.x

The `0.x` licence to change anything at any time is spent. A breaking change now
needs a real major, which is also a new URL major — so it is a bigger commitment
than it was, and worth batching.

Note that commitlint rejects the `feat(api)!:` shorthand: its parser does not
accept the `!` marker, so use a `BREAKING CHANGE:` footer instead. The analyser
treats both as major, and the footer is what reaches the release notes.

## Testing the rules

`.releaserc.json` is configuration with real failure modes and no test coverage.
To check a change to it, call the analyser directly:

```bash
node --input-type=module -e "
import { analyzeCommits } from '@semantic-release/commit-analyzer';
import { readFile } from 'node:fs/promises';
const rc = JSON.parse(await readFile('.releaserc.json', 'utf8'));
const [, config] = rc.plugins.find(p => Array.isArray(p) && p[0] === '@semantic-release/commit-analyzer');
for (const m of ['feat(api): x', 'fix(api): x', 'feat(api)!: x', 'feat: x', 'chore(api): x']) {
  console.log(String(await analyzeCommits(config, { commits: [{ hash: 'a', message: m }], logger: { log: () => {} } })).padEnd(6), m);
}"
```

Expected: `minor`, `patch`, `major`, `null`, `null`.

## Where the version is exposed

The only runtime surface is the OpenAPI document's `info.version`, visible in
`/playground` and `swagger.json`.

The **current** major reports the deployment's version, from
[`src/lib/version.ts`](../src/lib/version.ts). A **frozen** major reports the
version it was last current at, pinned in `FROZEN_AT` in
[`src/lib/apiVersion.ts`](../src/lib/apiVersion.ts) — `/api/v0` reports `0.11.2`
and always will.

Without the pin, a frozen major would inherit the deployment's version, so
`/api/v0` would advertise `1.4.0` after three `v1` features: a version implying
endpoints it does not have, whose major contradicts its own URL.
`__tests__/openapi-versions.test.ts` asserts that a major's reported version and
its URL segment always agree.

The trade-off is that a fix to a frozen major does not move its document
version, so that field alone will not tell a consumer the document changed.

The `/changelog` and `/changelog/latest` endpoints were removed; GitHub Releases
and [CHANGELOG.md](../CHANGELOG.md) replace them. The entries at `0.7.0` and
below in that file are the hand-written historical record and sit below a marker
comment — semantic-release only ever prepends above it.

`package.json` keeps `private: true`; nothing is published to npm.
