# Working on API majors

How a change reaches `/api/v0`, `/api/v1`, or both — and what has to change
before majors can be maintained on separate branches.

[RELEASING.md](RELEASING.md) covers the release machinery: what triggers a
version bump, how semantic-release runs, how a new major is cut. This document
covers the day-to-day decision that sits in front of it: **which majors should
this change reach, and how do I make it reach exactly those?**

## The model today

One deployment serves every major. There is one router, one set of handlers,
one Zod schema per shape; the major a request arrives on selects a *subset* of
that shared router, and nothing else.

| Concern                         | Where it lives                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Which majors exist              | `API_MAJORS` in [`src/lib/apiVersion.ts`](../src/lib/apiVersion.ts)                                     |
| Which major takes new work      | `LATEST_API_MAJOR`, derived from [`src/lib/version.ts`](../src/lib/version.ts)                          |
| Which procedures a major serves | `addedIn` / `removedIn` meta, filtered by [`src/lib/versionedRouter.ts`](../src/lib/versionedRouter.ts) |
| What each major's URL space is  | `src/app/api/v<n>/` — six-line mounts over `src/lib/api/`                                               |
| What each major promises        | `__tests__/__snapshots__/api-v<n>-surface.json`                                                         |

The consequence worth internalising: **implementation is shared, contract is
not.** A change to a handler's body reaches every major at once. A change to a
handler's *shape* is meant to reach only the current one, and the snapshots are
what make that a CI failure rather than a silent breach.

Read `addedIn` as "has been served since". `v0Procedure` is `addedIn: 'v0'` and
marks everything that predates the split. A procedure written with plain
`protectedProcedure` has no `addedIn`, so it defaults to the latest major only —
forgetting to think about versions freezes the old majors rather than leaking
into them.

## Fixing something on v0

A frozen major takes fixes. It takes no new features. The line between them is
the contract: **if a consumer's existing, correct request gets a differently
shaped answer, it is not a fix.**

| Change                                           | Fix on v0?                 |
| ------------------------------------------------ | -------------------------- |
| Wrong data in an existing field                  | Yes                        |
| 500 or 404 where a valid response was due        | Yes                        |
| Security or rate-limit correction                | Yes                        |
| Performance, caching, upstream query change      | Yes                        |
| Field description, example, or summary corrected | Yes                        |
| A new optional response field                    | **No** — v1                |
| A new endpoint                                   | **No** — v1                |
| A parameter loosened to accept more input        | **No** — v1                |
| An error status changed for the same request     | **No** — treat as breaking |

### How to make one

1. **Fix the shared handler.** There is no v0 copy to edit. The procedure is
   `v0Procedure`, so the fix lands in every major that serves it — which is
   almost always what you want: a bug in `/api/v0/lessons/{lesson}/summary` is
   the same bug in `/api/v1`.
2. **Run the tests.** `pnpm test`. If
   [`openapi-frozen-surface.test.ts`](../__tests__/openapi-frozen-surface.test.ts)
   fails on `api-v0-surface.json`, stop: your fix changed v0's contract. Either
   it is a feature in disguise, or it needs
   [superseding](RELEASING.md#superseding-an-endpoint) so the new shape lands on
   v1 only. The snapshot deliberately ignores prose and `info.version`, so a
   corrected description will not trip it.
3. **Commit `fix(api): …`.** That is a patch release on the project version —
   `1.0.0` → `1.0.1`.
4. **Say which majors it reached, in the release notes.** This is the only
   channel that can carry it, and it matters more than it looks:

   A fix ships to `/api/v0`, but `/api/v0`'s reported version stays `0.11.2`
   forever. That is deliberate — see
   [Why the patch does not cycle](RELEASING.md#why-the-patch-does-not-cycle) —
   and it means the document version will never tell a v0 consumer that
   something changed underneath them. Write the note so it does: *"fixes
   missing child subjects; affects `/api/v0` and `/api/v1`"*.

### If a fix cannot be shared

Occasionally the correct behaviour on v1 is the wrong behaviour on v0 — fixing
v1 would itself break a v0 consumer who has coded around the bug. Today the
only tool for that is a superseding procedure: keep the old one, mark it
`removedIn: 'v1'`, add a twin under a different router key.

That is honest for one or two endpoints and unpleasant for ten. **It is also
the clearest signal that the branched model below is due** — see
[When to switch](#when-to-switch).

## Adding a feature to v1

v1 is the current major, so it is the default destination and needs no
ceremony.

1. **Write the procedure with `protectedProcedure`.** No `addedIn`. It is
   served at the latest major only, which is v1 today and v2 when that comes —
   correct in both cases without an edit.
2. **Adding a field to an existing endpoint?** The Zod schemas are shared, so
   the field appears in v0's document too. That is what the snapshots catch.
   If `api-v0-surface.json` moves, the field has to be gated by superseding the
   procedure rather than widening the shared schema in place. Pay that
   duplication at the point of divergence, not before.
3. **Update the snapshots deliberately.** `api-v1-surface.json` moving is
   expected — eyeball the diff as the API change it represents.
   `api-v0-surface.json` moving is a red flag, every time.
4. **Update [ENDPOINTS.md](ENDPOINTS.md)** in the same PR if you added or
   removed an endpoint. Required by [AGENT.md](../.agent/directives/AGENT.md).
5. **Commit `feat(api): …`.** Minor release — `1.0.0` → `1.1.0`. v0 is
   untouched and still reports `0.11.2`.

Breaking changes are a different exercise: they mint `/api/v2` and freeze
`/api/v1`. That procedure is in
[Cutting a new major](RELEASING.md#cutting-a-new-major). Note that commitlint
rejects the `feat(api)!:` shorthand — use a `BREAKING CHANGE:` footer.

## Quick reference

| I want to…                                    | Do this                                                                      |
| --------------------------------------------- | ---------------------------------------------------------------------------- |
| Fix a bug in behaviour, all majors            | Edit the shared handler, `fix(api):`, note the majors                        |
| Add an endpoint                               | `protectedProcedure`, `feat(api):` — v1 only                                 |
| Add an optional field to an existing response | Check `api-v0-surface.json` first; supersede if it moves                     |
| Change an existing response shape             | Supersede the procedure, or cut v2                                           |
| Remove an endpoint from the next major        | `removedIn: 'v<next>'` on the existing procedure                             |
| Retire a major entirely                       | Not yet exercised — see [the transition](#the-transition-to-branched-majors) |

## The transition to branched majors

Everything above describes a **single-branch, single-deployment** model: one
`main`, one Vercel project, majors distinguished by metadata inside a shared
router. That is a deliberate simplification for two majors, one of which is
frozen and identical to the other.

It is **not** the model Oak has agreed to. **RFC-52: API versioning/release
strategy** (Notion; approved 29 October 2025 by Simon Rose and Jim Cresswell)
specifies maintenance branches per major, separate deployables per major, and
multi-branch semantic-release. This repository is
explicitly named in that RFC's assumptions as an API that should adhere to it.

So the current model is an interim position, and this section records what is
owed, what triggers paying it, and how.

### Where we stand against RFC-52

| RFC-52 requirement                                | Status | Notes                                                                                                                     |
| ------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| Major in URI path, AIP-185                        | Done   | `/api/v0`, `/api/v1`. Prefixed `/api` rather than bare `/v1`, which AIP-185 permits.                                      |
| Versioned OpenAPI spec per major                  | Done   | Generated per major at `/api/v<n>/swagger.json` from the router that actually serves it.                                  |
| GitHub Flow, `main` always releasable             | Done   | Short-lived PRs, protected `main`.                                                                                        |
| semantic-release + Conventional Commits           | Done   | Single-branch. Commitlint gates scope; see [RELEASING.md](RELEASING.md).                                                  |
| Per-PR preview environments                       | Done   | Vercel previews, with a `preview` env-var group in Terraform.                                                             |
| Per-major metrics                                 | Partly | `api_major` is on every PostHog event. No alerting on lingering traffic to a frozen major.                                |
| **Maintenance branch per major** (`release/1.x`)  | **No** | Single `main`. Majors are separated by `addedIn`/`removedIn`, not by branch.                                              |
| **semantic-release multi-branch**                 | **No** | `.releaserc.json` has `"branches": ["main"]`. A v0 fix cannot be tagged `0.11.3`.                                         |
| **Separate deployable per major**                 | **No** | One Next app serves both. No runtime isolation; a bad deploy takes every major down together.                             |
| **Contract testing / OpenAPI diff in CI**         | Partly | Surface snapshots catch shape drift per major. No OpenAPI-diff tool, no consumer-driven contracts.                        |
| **Deprecation headers** (`Sunset`, `Deprecation`) | **No** | Only `Link: rel="successor-version"` (RFC 5829) is emitted, from [`versionHeaders.ts`](../src/lib/api/versionHeaders.ts). |
| **`X-Api-Version` response header**               | **No** | The version's only surface is the OpenAPI document's `info.version`.                                                      |

Note also that RFC-52 lists *"single repo & directories per major (`src/v1`,
`src/v2`)"* as a **rejected** alternative, on the grounds of cross-contamination
risk. The current model is a close cousin: one codebase, one router, majors
selected by metadata. The cross-contamination risk it names is real and is
exactly what the surface snapshots exist to contain. They contain it well for
two majors with an identical surface. They will contain it less well as the
majors genuinely diverge.

### When to switch

Do not branch pre-emptively. Branch when one of these becomes true:

1. **A fix cannot be shared.** The second or third time an endpoint has to be
   superseded because the right answer differs per major, the shared router is
   costing more than it saves.
2. **v0 needs a release of its own.** The moment someone needs to tag, ship, or
   roll back a change to a frozen major independently of `main`, the
   single-branch model has run out — there is no `0.11.3` to cut.
3. **A third live major appears.** Two majors where one is frozen and identical
   is cheap. Three, with real divergence, is not.
4. **Runtime isolation is required.** If a v2 deploy could plausibly break v1 —
   a datastore change, a dependency upgrade the old major cannot take — the
   majors need separate deployables, which needs separate branches to build
   from.
5. **An external consumer commits to a deprecation window.** A 90–180 day
   window with a `Sunset` date is a promise that the old major stays serviceable
   while the new one moves; that is far easier to keep on its own branch.

### How to switch, per RFC-52

The RFC's own prescriptions, in the order they would be applied here. This is a
plan, not a completed change.

1. **Cut the maintenance branch at the freeze point.** `release/0.x` from the
   `v0.11.2` tag — the last release made while v0 was current, and the version
   already recorded in `FROZEN_AT`. Generalise as `release/<n>.x` per frozen major.
2. **Make semantic-release multi-branch.** Add the maintenance branch to
   `.releaserc.json`'s `branches`, per
   [Release Workflow Configuration](https://semantic-release.org/foundation/workflow-configuration/)
   and the
   [maintenance releases recipe](https://semantic-release.org/recipes/release-workflow/maintenance-releases/):

   ```json
   "branches": [{ "name": "release/0.x", "range": "0.x" }, "main"]
   ```

   A fix on the maintenance branch then tags `0.11.3` instead of contributing
   nothing. `range` is what stops a stray `feat` on that branch releasing a
   `1.x`; it is required here because the branch is not itself named `N.x`.
   `channel` is left at its default — it is an npm dist-tag, and this package
   is `private`.

3. **Decide the backport direction and write it down.** The RFC accepts manual
   backporting. Fix-forward — land on `main`, cherry-pick to `release/0.x` — is
   the better default here: the current major is the one most consumers are on,
   and the cherry-pick is a positive act that says which majors a fix reached.
4. **Split the deployable.** One Vercel project per major
   (`oak-curriculum-api-v0`, `-v1`), routing `/api/v0/**` and `/api/v1/**` by
   path at the edge; Terraform pins each to its own branch. At this point
   `API_MAJORS`, `LATEST_API_MAJOR` and the `versionedRouter` filtering become
   dead weight on the maintenance branch and should be deleted *there* — each
   branch serves exactly one major.
5. **Freeze the contract per branch.** The surface snapshot moves with its
   branch and stops being a cross-major guard; add an OpenAPI-diff gate in CI
   comparing each branch's generated document against its last released one, so
   breaking changes fail the build rather than a reviewer's eye.
6. **Turn on the deprecation surface.** `Deprecation` and `Sunset` headers on
   the frozen major, the `Sunset` date surfaced in its OpenAPI description,
   Slack announcements at the window's start and midpoint, and an alert on
   traffic to a major inside its final 30 days. The
   `Link: rel="successor-version"` header is already in place to build on.
7. **Revisit the version-per-major question.** Once each major has its own
   branch and its own release line, a frozen major *can* report a real
   `0.11.3`, because there is a tag behind it. The reasoning in
   [Why the patch does not cycle](RELEASING.md#why-the-patch-does-not-cycle) is
   conditional on the single-branch model, and this is the step that lifts it.

### TODO

- [ ] Agree the trigger. The conditions in [When to switch](#when-to-switch) are
      a proposal, not a decision.
- [ ] Multi-branch `.releaserc.json` and a `release/0.x` branch (steps 1–2).
- [ ] Backport policy in [rules.md](../.agent/directives/rules.md) (step 3).
- [ ] Per-major deployables and edge routing (step 4).
- [ ] OpenAPI-diff CI gate per branch (step 5).
- [ ] `Deprecation` / `Sunset` headers and a deprecation window for `/api/v0`
      (step 6).
- [ ] `X-Api-Version` response header, per RFC-52 §4.
- [ ] Alerting on traffic to a frozen major. `api_major` is already captured.

Until these land, the rule is simply: **a frozen major takes fixes through the
shared router, and the surface snapshots decide whether it was a fix.**
