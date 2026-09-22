# API docs

Purpose

- Provide lightweight guidance for using the API and navigating OpenAPI docs.

Start here

- [`docs/api/quickstart.md`](quickstart.md)

Discovery

- The homepage returns RFC 8288 `Link` response headers for agent discovery:
  `/.well-known/api-catalog` as `api-catalog`, `/api/v1/swagger.json` as
  `service-desc`, plus the API overview and playground as `service-doc`.
- The API catalogue is published as a Linkset document at
  `/.well-known/api-catalog`.
- Authentication instructions for agents are published at `/auth.md`. OAuth 2.0,
  OpenID Connect, dynamic client registration, and auth.md agent registration
  flows are not currently supported.

Related docs

- [`docs/README.md`](../README.md) (docs index)
- [`README.md`](../../README.md) (repo overview and quickstart)
