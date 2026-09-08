# Oak Curriculum API

[![Latest release](https://img.shields.io/github/v/release/oaknational/oak-openapi?label=release)](https://github.com/oaknational/oak-openapi/releases)
[![Tests](https://github.com/oaknational/oak-openapi/actions/workflows/test.yml/badge.svg)](https://github.com/oaknational/oak-openapi/actions/workflows/test.yml)
[![Lint](https://github.com/oaknational/oak-openapi/actions/workflows/lint.yml/badge.svg)](https://github.com/oaknational/oak-openapi/actions/workflows/lint.yml)
[![Licence: MIT](https://img.shields.io/badge/licence-MIT-blue)](LICENSE)
[![Last commit](https://img.shields.io/github/last-commit/oaknational/oak-openapi)](https://github.com/oaknational/oak-openapi/commits/main)
[![API status](https://img.shields.io/badge/API-v0%20public%20beta-green)](https://open-api.thenational.academy/)

> **Licence:** this repository is published under the [MIT License](LICENSE).
> When using this work, please credit "Oak National Academy". See
> [Licence](#licence) for the full terms.

## In plain English

Oak National Academy publishes a free curriculum of lessons for schools in
England. This repository holds the code for the **Oak Curriculum API** — the
service that lets other people's software read that curriculum directly, rather
than by copying it off a website.

A software developer building a lesson-planning tool, a research project, or an
AI assistant for teachers can ask the API questions like "which maths units are
taught in Key Stage 3?" or "give me the lesson plan, slides and quiz for this
lesson", and get back structured data they can build with. There is also a bulk
download route for people who need everything at once rather than a query at a
time.

We have published this code so that anyone relying on the API can see exactly how
it works, and so that the way Oak's curriculum data is shaped and shared is open
to inspection. **The API is currently v0 — a public alpha moving towards public
beta**, so endpoints may still change.

You do not need to read any further unless you are a software developer.

## Contents

- [In plain English](#in-plain-english)
- [Contents](#contents)
- [Who this API is for](#who-this-api-is-for)
- [Quickstart](#quickstart)
- [Repository docs](#repository-docs)
- [Development](#development)
  - [Prerequisites](#prerequisites)
- [Environment](#environment)
- [Documentation and CMS](#documentation-and-cms)
- [API keys](#api-keys)
- [Available subjects](#available-subjects)
- [Errors](#errors)
- [Analytics Logging](#analytics-logging)
- [Batch requests for video urls](#batch-requests-for-video-urls)
- [Infrastructure](#infrastructure)
- [Repository structure](#repository-structure)
- [Bulk Download](#bulk-download)
  - [Using the Bulk Download Script](#using-the-bulk-download-script)
    - [Prerequisites](#prerequisites-1)
    - [Running the Script](#running-the-script)
    - [Output Structure](#output-structure)
- [Load testing](#load-testing)
  - [Required env values](#required-env-values)
- [Styling](#styling)
- [Versioning and releases](#versioning-and-releases)
- [Support](#support)
- [Contributing](#contributing)
- [Accessibility](#accessibility)
- [Security](#security)
- [Licence](#licence)
- [Attribution and citation](#attribution-and-citation)
- [Acknowledgements and contact](#acknowledgements-and-contact)

## Who this API is for

- **Edtech and lesson-planning tools** that need Oak's units, lessons and
  assets as structured data.
- **Researchers** analysing curriculum coverage across key stages and subjects.
- **AI and agent developers** — the API ships an OpenAPI document, an
  [agent skill manifest](public/.well-known/agent-skills/oak-openapi/SKILL.md)
  and lesson transcripts.
- **Schools and MATs** wanting an offline copy of a whole sequence through the
  bulk download route.

Every endpoint requires an API key. See [API keys](#api-keys).


## Quickstart

1. Copy `.env.example` to `.env` and fill in required values.
2. Install dependencies: `pnpm install`
3. Start dev server: `pnpm dev`
4. Open:
   - API: `http://localhost:2727/api/v0/subjects`
   - Playground: `http://localhost:2727/playground`

## Repository docs

- [docs/README.md](docs/README.md) (docs index and start-here links)
- [docs/accessibility.md](docs/accessibility.md) (conformance level and reporting a barrier)
- [docs/api/quickstart.md](docs/api/quickstart.md) (API usage and auth examples)
- [README_BULK_DOWNLOAD.md](README_BULK_DOWNLOAD.md) (bulk download process)
- [src/cms/README.md](src/cms/README.md) (CMS integration)

## Development

### Prerequisites

These are the system-level tools you need, not just the npm dependencies:

| Tool      | Version                                                  | Notes                                                                                                         |
| --------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Node.js   | `>=24.12 <25`                                            | Pinned in `.nvmrc` (`24`) and `engines` in `package.json`. `nvm use` picks it up.                             |
| pnpm      | `>=10`                                                   | The only supported package manager. `corepack enable` will install the pinned version from `packageManager`.  |
| Docker    | any recent                                               | Only needed to build the `bulk-data` image locally (see [Dockerfile](Dockerfile)). Not needed for `pnpm dev`. |
| Terraform | see [infrastructure/README.md](infrastructure/README.md) | Only needed to change hosting.                                                                                |
| Artillery | latest                                                   | Only needed for [load testing](#load-testing).                                                                |

You also need **access to the OWA Hasura staging instance** — an Oak-internal
credential. Without it the server starts but data endpoints will fail. If you are
outside Oak, you can still read the code, run the unit tests that do not hit
Hasura, and read the generated OpenAPI document; you cannot run the full stack.

Installation and development:

1. `pnpm install`
2. `pnpm dev`

Development server should be running on http://localhost:2727 and the interactive playground is at http://localhost:2727/playground

An API key is required to call REST endpoints.

If the `API_KEY` value is in your `.env` file, there is also a command line helper to run API requests:

```sh
bin/g /subjects/maths
```

This can also be used to request against production:

```sh
bin/g prod /subjects/maths
```

## Environment

- Copy `.env.example` to `.env` and fill in required values.
- Core API requires `OAK_GRAPHQL_HOST`, `OAK_GRAPHQL_SECRET`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN`.
- See `.env.example` for optional values and feature-specific settings.

## Documentation and CMS

See [src/cms/README.md](src/cms/README.md) for detail.

## API keys

Currently these are managed by Oak through an admin tool in this repo, at
`/admin`. It has three areas:

| Path                | Purpose                                                             |
| ------------------- | ------------------------------------------------------------------- |
| `/admin/new`        | Create a user and issue their first key                             |
| `/admin/users`      | Search and list users                                               |
| `/admin/users/<id>` | View a user's details and usage, edit them, or regenerate their key |

Everything under `/admin` (pages and API routes alike) is behind HTTP Basic
auth, so `AUTH_USERNAME` and `AUTH_PASSWORD` must be set to use it locally. See
[docs/ENDPOINTS.md](docs/ENDPOINTS.md) for the routes behind it.

The same operations are available from the command line, sharing the data layer
in `src/lib/apikeys.ts`:

```shell
$ pnpm tsx bin/find-api-user.ts someone@example.com   # look up (add a number to set their rate limit)
$ pnpm tsx bin/roll-api-key.ts someone@example.com    # regenerate a key
```

Accounts are stored in a redis database on [upstash](https://console.upstash.com/login).

## Available subjects

The subjects and key stages available in the endpoints on the API are hard coded (automatically) into the project. This is generated using a build command (which can be updated locally), but the code is committed to the repository.

To update the subjects list (say if there's a new cohort of lessons and subjects):

1. Start the development server: `$ pnpm dev`
2. Then run the build script in a separate terminal (as it uses the server to generate the subjects:

```shell
$ pnpm run build-subjects
```

This will update the file `@/lib/keyStageAndSubjects.json` which will need to be committed to the repo.

## Errors

As a note, throwing errors using vanilla JavaScript should _only_ be used for development errors (specifically when they'll be caught and handled), as they include the stack and get sent back to the user.

In nearly all cases, the `TRPCError` should be thrown with the appropriate HTTP code.

For example, an internal error would throw as such:

```ts
throw new TRPCError({
  message: 'Unexpected answer type',
  code: 'INTERNAL_SERVER_ERROR',
});
```

A user error (such as an unknown subject is requested) is:

```ts
throw new TRPCError({
  message: `Invalid subject: ${res.subjectSlug}`,
  code: 'BAD_REQUEST',
});
```

## Analytics Logging

Currently the following data is connected to user accounts (in upstash):

1. Rate limit
2. Total request count
3. Last request timestamp

In datadog, under the `open-api.thenational.academy` service, each request is logged and includes the following key data:

1. Requesting `userId`
2. `url` requested (this is different from `path` which is always the `[...trpc]` path)
3. `query` which includes arguments passed (such as `year` on endpoints) and `trpc` arguments (that slot into the endpoint URL).

## Batch requests for video urls

In some cases, whilst we don't have the bulk download features up and running, a 3rd party may require direct Mux URLs to videos.

A script is available to generate this. You will need the following prerequisites:

1. `OAK_GRAPHQL_HOST` pointing to production Hasura (to ensure the latest data)
2. `MUX_TOKEN` with read access as some videos won't be available and the Mux API is required to both find the static renditions, but also (in future) render the static mp4 files when entirely missing
3. A JSON file containing an array of strings, those strings being the lesson slugs

Assuming your environment is in place, and assuming that your slugs are in `./slugs.json`, run the following command:

```sh
pnpx tsx bin/get-direct-video-links.ts ./slugs.json > results.csv
```

The results.csv file is a CSV (without a header) that contains the URL and the lesson slug. This is to help ensure that the order is aligned to the original list.

## Infrastructure

- TypeScript across nearly all code (exceptions being eslint config and next config)
- pnpm is used to manage dependencies
- The project uses Nextjs for routing
- trpc-server for types
- zod to define the types
- trpc-openapi to add the openapi metadata
- graphql and some direct sql is used against the Oak Web Application (OWA) hasura based database

## Repository structure

```
.
├── bin/                 # One-off and scheduled scripts (bulk export, key admin, codegen)
├── docs/                # Repository documentation — start at docs/README.md
├── eslint-rules/        # Custom lint rules for this codebase
├── infrastructure/      # Terraform for hosting and the bulk-upload job
├── public/              # Static assets, robots.txt, agent skill manifest, auth.md
├── src/
│   ├── app/             # Next.js App Router — API routes and UI pages
│   │   ├── api/v0/      # The public API surface
│   │   └── api/admin/   # Basic-auth admin for API keys
│   ├── cms/             # Sanity CMS integration (see src/cms/README.md)
│   ├── components/      # React components for the site and playground
│   ├── lib/
│   │   ├── handlers/    # One directory per endpoint: logic + schemas/ + examples
│   │   ├── zod-openapi/ # Builds the OpenAPI document from the Zod schemas
│   │   └── owaClient.ts # Hasura resolver and view name constants
│   └── old/             # Legacy pages and styles, being migrated
├── __tests__/           # Vitest suites and the Artillery load test
└── .github/workflows/   # CI — see .github/workflows/README.md
```

Request and response shapes live in each handler's `schemas/` directory and are
the single source of truth. The OpenAPI document is generated from them at
runtime by `src/lib/zod-openapi/schema/generateDocument.ts`; there is no separate
generation step.

## Bulk Download

The bulk download feature allows you to download all assets (videos, worksheets, slide decks, quizzes, etc.) for entire sequences, organised into tar archives.

See [README_BULK_DOWNLOAD.md](README_BULK_DOWNLOAD.md) for the full release and ops process.

### Using the Bulk Download Script

The prepare-bulk.ts script creates organised archives of Oak educational content for offline use.

#### Prerequisites

1. Access to Oak's Google Cloud Storage (set via `GOOGLE_APPLICATION_CREDENTIALS_JSON` env variable)
2. OWA Hasura access (for GraphQL queries via `OAK_GRAPHQL_HOST` and `OAK_GRAPHQL_SECRET`)

#### Running the Script

To generate bulk download packages:

```sh
pnpx tsx bin/prepare-bulk.ts
```

#### Output Structure

The script generates a directory structure in the `out` folder organised by sequence:

```
out/
  └── {sequence-slug}/
      ├── sequence.json           # Metadata about the sequence
      ├── units.jsonl             # Information about each unit
      ├── lessons.jsonl           # Details about each lesson including asset references
      ├── {sequence-slug}-videos.tar       # Archive of all video files
      ├── {sequence-slug}-worksheets.tar   # Archive of all worksheets and answer sheets
      ├── {sequence-slug}-slide-decks.tar  # Archive of all presentation files
      ├── {sequence-slug}-quizzes.tar      # Archive of all starter and exit quizzes
      └── {sequence-slug}-resources.tar    # Archive of all supplementary resources
```

Each file inside the tar archives is named with the sequence slug prefix (e.g., `math-primary-lesson1.mp4`).

The lessons.jsonl file contains references to all assets for each lesson, using the format `{tar-filename}:{file-path-in-tar}`.

## Load testing

Required dependencies:

1. [Artillery](https://www.artillery.io/docs/get-started/get-artillery) installed globally

How to run:

1. Set env vars for target URL and auth token.
2. `pnpm load-test`

### Required env values

Complete the values in `.env.example` and rename to `.env`

## Styling

To stay consistent with Oak repositories, all styling should be done via `styled-components`. The `pages` folder contains the following:

```
src/app/(pages)/playground/playground.css
src/old/pages/styles/playgroundStyles.tsx
```

1. To update the styling of the playground, have a look through `src/app/(pages)/playground/playground.css` first, to identify if the selectors for the required component already exist.

2. To view local changes, you can edit `src/old/pages/styles/playgroundStyles.tsx` directly. If you update those legacy styles, keep the playground CSS in sync and update the tree below.

The CSS file is sectioned into several sections as referenced below:

```

playground.css/
├── PAGE GENERICS
├── HEADER
│   ├── Top level title
│   ├── Header links
│   ├── Server dropdown component
│   ├── Authorise button
│   └── Version tags
├── API DOCUMENTATION
│   ├── Section headers
│   ├── Closed Accordion
│   │   ├── GET tag
│   │   └── Icons
│   ├── Open accordion
│   │   ├── Sub-section headers
│   │   ├── Spacing
│   │   ├── Parameter section
│   │   │   └── Cancel button
│   │   ├── Response table
│   │   └── Default section
│   ├── Font overrides
│   ├── Div spacing
│   └── Authorisation modal
└── SCHEMA DOCUMENTATION
    ├── Accordion
    └── Spacing

```

## Versioning and releases

This project uses [Semantic Versioning](https://semver.org/) via
[semantic-release](https://semantic-release.gitbook.io/), driven by
[Conventional Commits](https://www.conventionalcommits.org/).

`MAJOR.MINOR.PATCH` applies to **the public API contract**, not to internal
refactors:

- **MAJOR** — a breaking change to an endpoint, its parameters, or its response
  shape.
- **MINOR** — a new endpoint, field or capability, backwards compatible.
- **PATCH** — a bug fix that does not change the contract.

Only commits scoped to `api` produce a release, so `feat(api):` cuts a minor and
`chore(deps):` cuts nothing. The rules are in
[`.releaserc.json`](.releaserc.json), and the process is described in
[docs/RELEASING.md](docs/RELEASING.md).

The **API itself is v0** — a separate thing from the package version. While the
API is v0, breaking changes may happen with notice rather than a major bump. Past
releases are listed in [CHANGELOG.md](CHANGELOG.md) and on the
[releases page](https://github.com/oaknational/oak-openapi/releases).

## Support

Questions, bug reports, data corrections and feature requests go through the
**[API feedback form](https://bvumd.share.hsforms.com/2nacebr1eQuKMoA-vGpkjCA)**.
GitHub issues and discussions are turned off on this repository.

Triage is owned by the **@oaknational/devs** team, with a **first response within
5 working days**. That is an acknowledgement, not a fix — we do not commit to a
fix timescale while the API is in public alpha.

[SUPPORT.md](SUPPORT.md) sets out what is in and out of scope.

## Contributing

**Pull requests are accepted from the Oak internal engineering team only.** The
API backs a production service with access to Oak's content systems, so changes
go through Oak's internal review and release process. We would rather say that
plainly than leave an external pull request unanswered.

Feedback from everyone is very welcome through the form above — it is the most
useful thing you can send us. [CONTRIBUTING.md](CONTRIBUTING.md) explains what
kinds of feedback help most, and how Oak engineers work on this repository.

Everyone interacting with this project is expected to follow the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Accessibility

The API site, playground and documentation published from this repository are
held to **WCAG 2.2 AA**. The authoritative statement, including known issues, is
published at
[thenational.academy/legal/accessibility-statement-api-version](https://www.thenational.academy/legal/accessibility-statement-api-version).

[docs/accessibility.md](docs/accessibility.md) records the conformance level,
what it covers, how to write accessible documentation for this repository, and
how to report a barrier.

## Security

Report vulnerabilities as described in [SECURITY.md](SECURITY.md) — through
Oak's [security.txt](https://www.thenational.academy/.well-known/security.txt),
**not** through the feedback form or a public channel.

## Licence

This repository is published under the **MIT License**. The full terms are in
[LICENSE](LICENSE).

You are free to use, copy, modify, merge, publish, distribute, sublicense and
sell copies of this software, provided the copyright notice and permission
notice are included.

Curriculum content served *through* the API — lesson materials, videos,
worksheets and quizzes — is not covered by this repository's licence. Its terms
are set by Oak's [copyright notice](https://www.thenational.academy/legal/copyright-notice)
and, for some material, by third-party rights that Oak is not able to sublicense.
See the gating rules in `src/lib/queryGate.ts`.

## Attribution and citation

When using this work, please credit:

> Oak National Academy

This repository does not currently carry a DOI or a `CITATION.cff`, because it
publishes an API service rather than a citable research output or dataset. That
decision is recorded in [docs/public-release.md](docs/public-release.md) and will
be revisited if Oak publishes a citable dataset from it.

## Acknowledgements and contact

Built and maintained by the engineering team at
[Oak National Academy](https://www.thenational.academy). Oak is an arm's-length
body of the Department for Education.

The API is built on [tRPC](https://trpc.io/), [Zod](https://zod.dev/),
[Next.js](https://nextjs.org/) and
[zod-openapi](https://github.com/samchungy/zod-openapi), and the playground on
[Swagger UI](https://swagger.io/tools/swagger-ui/). Thank you to their
maintainers.

- **API feedback and support** — [feedback form](https://bvumd.share.hsforms.com/2nacebr1eQuKMoA-vGpkjCA)
- **General Oak enquiries** — [support.thenational.academy](https://support.thenational.academy/)
- **API docs and playground** — [open-api.thenational.academy](https://open-api.thenational.academy/)
- **Service status** — [status.thenational.academy](https://status.thenational.academy/)
