# Docs index

Documentation for the Oak Curriculum API. Everything here is reachable from
the [repository README](../README.md) and checked by the link-check workflow.

## Version framing

The public API is **v1** (public alpha moving towards public beta), served at
`/api/v1`. Work focuses on correctness and trust.

`/api/v0` remains in place and frozen: it takes fixes, but new endpoints and
fields land in `/api/v1` only. The URL major tracks the package major — see
[RELEASING.md](RELEASING.md#the-url-major-is-the-semver-major).

## Using the API

- [`api/README.md`](api/README.md) — API docs index.
- [`api/quickstart.md`](api/quickstart.md) — authentication and sample requests.
- [`ENDPOINTS.md`](ENDPOINTS.md) — endpoint-to-source-file index.
- [`glossary.md`](glossary.md) — domain terms used across the API and the code.

## Working on the repository

- [`../CONTRIBUTING.md`](../CONTRIBUTING.md) — how to contribute, and who can.
- [`RELEASING.md`](RELEASING.md) — how a release happens and what triggers one.
- [`../README_BULK_DOWNLOAD.md`](../README_BULK_DOWNLOAD.md) — bulk pipeline guide.
- [`../src/cms/README.md`](../src/cms/README.md) — CMS integration.
- [`../infrastructure/README.md`](../infrastructure/README.md) — Terraform and hosting.
- [`../.github/workflows/README.md`](../.github/workflows/README.md) — what each CI workflow does.

## Policies and records

- [`accessibility.md`](accessibility.md) — conformance level and how to report a barrier.
- [`public-release.md`](public-release.md) — the public release record and triage decisions.
- [`../SUPPORT.md`](../SUPPORT.md) — where to ask questions and what to expect.
- [`../SECURITY.md`](../SECURITY.md) — supported versions and vulnerability reporting.
- [`../CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md) — expected behaviour.
