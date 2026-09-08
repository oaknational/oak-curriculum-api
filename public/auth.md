# Oak Curriculum API auth.md

Oak Curriculum API does not currently support OAuth 2.0, OpenID Connect, dynamic client
registration, or auth.md agent registration flows.

Do not try to discover OAuth or OpenID Connect metadata for this service. These
endpoints are intentionally not published:

- `/.well-known/openid-configuration`
- `/.well-known/oauth-authorization-server`
- `/.well-known/oauth-protected-resource`

Unsupported OAuth and agent registration capabilities:

- No OAuth authorisation endpoint
- No OAuth token endpoint
- No OAuth revocation endpoint
- No OpenID Connect issuer
- No JSON Web Key Set for issued access tokens
- No dynamic client registration endpoint
- No agent identity, claim, or registration endpoints

Supported authentication:

- Oak issues API keys out of band.
- Send the API key as an opaque bearer credential:

```http
Authorization: Bearer <API_KEY>
```

Request an API key:

- <https://share.hsforms.com/1gQQFsrHDRf-eZUDajj6NzQbvumd>

Agent audience:

- Agents, applications, and developers integrating with the Oak Curriculum API.

Registration and provisioning:

- Automated agent registration is not currently supported.
- API-key provisioning is handled out of band through the API-key request form.

Supported credential method:

- Opaque API key in the HTTP `Authorization` header using the `Bearer` scheme.

Useful documentation:

- API overview: `/docs/about-oaks-api/api-overview`
- OpenAPI description: `/api/v0/swagger.json`
- Interactive playground: `/playground`
