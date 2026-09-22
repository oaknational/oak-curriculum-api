# Public release record

This document records the decisions taken when preparing `oaknational/oak-openapi`
for public release against Oak's checklist for releasing public GitHub
repositories. It exists so a reviewer can tell "not relevant" apart from
"not done".

Last reviewed: **20 August 2026**.

## Scope and triage

| Conditional item                                   | Applies | Decision                                                                                                                                                                                               |
| -------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CITATION.cff` and a DOI                           | No      | Not a research output, dataset or ontology. This repository publishes the code for an API service. Revisit if Oak later publishes a citable dataset from it.                                           |
| `.env.example`                                     | Yes     | Present. The code reads environment variables.                                                                                                                                                         |
| Data provenance and licensing review               | No      | No datasets are committed to this repository. Curriculum data is served at runtime from Oak's systems, not stored here.                                                                                |
| Accessibility statement                            | Yes     | See [accessibility.md](accessibility.md). Held to WCAG 2.2 AA.                                                                                                                                         |
| Release artefacts and checksums                    | No      | Releases are Git tags with generated notes. No built files are attached to GitHub releases. The `bulk-data` container image is published to Oak's private Artifact Registry, not distributed publicly. |
| Published artefact validation and build provenance | No      | As above — nothing is distributed publicly. Bulk outputs are validated by `pnpm bulk:schema-check` before upload.                                                                                      |
| SBOM archived per release                          | No      | Skipped. No executables or container images are distributed to the public. Revisit if the `bulk-data` image is ever published publicly, or if a consumer requires one.                                 |
| Named maintainer and stated support expectation    | Yes     | @oaknational/devs, first response within 5 working days. See [SUPPORT.md](../SUPPORT.md).                                                                                                              |

## Secret scan

A full-history scan was run before publication:

```sh
gitleaks detect --log-opts="--all" --redact
```

**20 August 2026** — 1,046 commits scanned, six findings, all assessed:

| Finding                  | Location                                              | Assessment                                                               |
| ------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------ |
| `Bearer YOUR_API_KEY` ×2 | `.agent/summary/deep-dives/deep-dive.md` @ `7bde3dec` | False positive. Documentation placeholder in a file since deleted.       |
| `key="…"` ×2             | `__tests__/landing-page-data.test.tsx`                | False positive. React `key` props in test fixtures.                      |
| `_key: '…'`              | `__tests_/landing-page-data.test.tsx`                 | False positive. Sanity portable-text block identifier in a test fixture. |

No environment or OS files are tracked. Verified with:

```sh
git ls-files | grep -iE '\.env|\.DS_Store|\.pem$|id_rsa'
```

`.env.example` contains placeholder keys with empty values only.

## Licensing

The repository is licensed under the **MIT License**
([LICENSE](../LICENSE)), as a single licence covering the whole repository. No
code/data split is needed because no datasets are committed here.

`package.json` declares the SPDX identifier `MIT`. Confirm how GitHub
reports it after publishing:

```sh
gh api repos/:owner/:repo --jq .license.spdx_id
```

If this returns `NOASSERTION`, the licence terms must be stated prominently near
the top of the README so a reader never relies on the sidebar. The README
already does this.

### Attribution

When using this work, please credit "Oak National Academy".

### Dependency licences

Scanned on **20 August 2026** with `pnpm licenses list --json`, covering direct
and transitive dependencies (1,716 packages).

| Licence         | Packages          |
| --------------- | ----------------- |
| MIT             | 1,445             |
| Apache-2.0      | 130               |
| ISC             | 58                |
| BSD-3-Clause    | 33                |
| BSD-2-Clause    | 26                |
| BlueOak-1.0.0   | 10                |
| CC0-1.0         | 4                 |
| Everything else | fewer than 4 each |

**No GPL, AGPL, EUPL or SSPL anywhere in the tree.** The copyleft and
unresolved cases are:

| Package                        | Licence               | Assessment                                                                                                                                                                                                                                                                                                                                |
| ------------------------------ | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@img/sharp-libvips-*`         | LGPL-3.0-or-later     | Platform-specific native binaries reached transitively through Next.js image optimisation. LGPL permits dynamic linking without relicensing the calling code, and the binaries are used unmodified. Allowed explicitly in `dependency-review.yml` so a routine Next.js bump does not fail the check, rather than weakening the deny-list. |
| `axe-core`, `@vercel/stega`    | MPL-2.0               | File-level copyleft: obligations attach only to modified MPL files. Neither is modified.                                                                                                                                                                                                                                                  |
| `dompurify`                    | MPL-2.0 OR Apache-2.0 | Dual-licensed; Oak takes it under Apache-2.0.                                                                                                                                                                                                                                                                                             |
| `@prisma/extension-accelerate` | Unlicensed            | Version 2.0.2 ships no `license` field and no licence file. Prisma's own repository states Apache-2.0, but the published package does not.                                                                                                                                                                                                |

**Reasoning, not just the list.** These obligations attach to *distributing* a
dependency or *modifying* its source. Oak does neither:

- API consumers receive JSON over HTTP. No dependency code reaches them, so no
  obligation arises from operating the service.
- Oak engineers install from the npm registry themselves, from a committed
  lockfile. The repository distributes a manifest, not the packages.
- The one case that *is* distribution is the `bulk-data` container image built
  by `build-bulk-data-image.yml`, which bundles `node_modules`. It is pushed
  only to Oak's private Artifact Registry. **If that image is ever published
  publicly, this analysis must be redone** — the MPL and LGPL packages above
  would then carry real notice and source-availability obligations.

GitHub's dependency-graph SBOM was deliberately not used as the licence source:
it leaves many packages unresolved and reports registry metadata verbatim.

## Data protection

The correction and takedown route is published: the
[API feedback form](https://bvumd.share.hsforms.com/2nacebr1eQuKMoA-vGpkjCA),
documented in [SUPPORT.md](../SUPPORT.md).

## Static analysis

CodeQL was run locally on **20 August 2026** before the workflow was ever
merged, using the same `security-and-quality` suite the workflow configures.

### Workflow files (`actions` language)

**Zero findings** across all 10 workflow files — no script injection, no
env-var injection, no cache poisoning, no unpinned-action paths.

### TypeScript (`javascript-typescript` language)


| Rule                                | Location                                   | Assessment                                                                                                                                                                       |
| ----------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `js/http-to-file-access` (6.3)      | `bin/build-subjects-and-key-stages.ts:102` | **Accepted.** A developer-run build script writing Oak's own API response into `keyStageAndSubjects.json`. The result is reviewed and committed, so the write is not unattended. |
| `js/xss-through-dom` (7.8)          | `coverage/sorter.js:116`                   | **Not applicable.** Generated Istanbul coverage output produced by a local run. `coverage/` is gitignored, so a clean CI checkout never contains it.                             |
| `js/superfluous-trailing-arguments` | `__tests__/headers.test.ts:130`            | Cosmetic. `getConfig('')` takes no arguments.                                                                                                                                    |

Reproduce with:

```sh
codeql database create /tmp/db-js --language=javascript-typescript --source-root=.
codeql database analyze /tmp/db-js \
  'codeql/javascript-queries:codeql-suites/javascript-security-and-quality.qls' \
  --format=sarif-latest --output=/tmp/js.sarif
```

## Repository settings applied

Applied on **20 August 2026** and verified through the API:

| Setting                                         | Value                 | Why                                                                                                                                                            |
| ----------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `default_workflow_permissions`                  | `read`                | Every workflow declares the permissions its jobs need. `release.yml` pushes with a GitHub App token, not `GITHUB_TOKEN`, so a read-only default costs nothing. |
| `can_approve_pull_request_reviews`              | `false`               | Actions must not be able to approve pull requests.                                                                                                             |
| `allowed_actions`                               | `selected`            | GitHub-owned and verified creators, plus `oaknational/*`, `pnpm/action-setup@*`, `google-github-actions/*` and `lycheeverse/lychee-action@*`.                  |
| `sha_pinning_required`                          | `true`                | Tags are mutable. Every action in this repository is pinned to a full commit SHA with the version in a trailing comment.                                       |
| `secret_scanning`                               | `enabled`             | Detection.                                                                                                                                                     |
| `secret_scanning_push_protection`               | `enabled`             | Stops a secret being committed, rather than reporting it afterwards.                                                                                           |
| `secret_scanning_non_provider_patterns`         | `enabled`             | Catches generic credentials, not just recognised provider formats.                                                                                             |
| `secret_scanning_validity_checks`               | `enabled`             | Tells us whether a detected secret is still live.                                                                                                              |
| `has_issues`                                    | `false`               | Bug reports go through the API feedback form. Stated in README, CONTRIBUTING and SUPPORT so readers are not left guessing.                                     |
| `has_wiki` / `has_projects` / `has_discussions` | `false`               | Not used; the docs live in the repository.                                                                                                                     |
| `delete_branch_on_merge`                        | `true`                | Already set.                                                                                                                                                   |
| Merge methods                                   | merge, squash, rebase | Left as the team already works. Not a release blocker.                                                                                                         |
| `private_vulnerability_reporting`               | **pending**           | The endpoint 404s on a private repository. Enable immediately after going public                                                                               |

Confirm at any time with:

```sh
gh api repos/:owner/:repo --jq .security_and_analysis
gh api repos/:owner/:repo/actions/permissions
gh api repos/:owner/:repo/actions/permissions/workflow
```

