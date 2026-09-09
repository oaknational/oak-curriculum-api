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

Rate limits:

- Requests are rate limited per API key over a sliding one-hour window.
- The default allowance is 1000 requests per hour. A key may be issued with a
  different allowance, so treat the headers below as authoritative for your key.
- Responses carry `X-RateLimit-Limit`, `X-RateLimit-Remaining` and
  `X-RateLimit-Reset`, apart from error responses from the lesson-asset
  download and `/api/bulk`, which drop them.
- These headers are not listed in `Access-Control-Expose-Headers`, so a browser
  client cannot read them cross-origin. Call the endpoint below instead.
- `GET /api/v0/rate-limit` returns the same three values as JSON and does not
  count against the allowance.
- Once the allowance is spent, requests are rejected and the response carries
  `X-Retry-After`.
- `X-RateLimit-Reset` and `X-Retry-After` both hold the end of the current
  clock-hour bucket, in milliseconds since the Unix epoch. The window slides,
  so the allowance returns gradually before then rather than all at once at it.
  Back off on `X-RateLimit-Remaining` rather than sleeping to the timestamp.

Support:

- Report API bugs, data errors, and documentation that is wrong or unclear
  through the API feedback form.
- <https://bvumd.share.hsforms.com/2nacebr1eQuKMoA-vGpkjCA>
- First response within five working days. GitHub issues and discussions are
  turned off, so the form is the route that reaches the team.
- Do not report security vulnerabilities through the form. Follow the
  disclosure route in <https://www.thenational.academy/.well-known/security.txt>.

Useful documentation:

- API overview: `/docs/about-oaks-api/api-overview`
- OpenAPI description: `/api/v0/swagger.json`
- Interactive playground: `/playground`
