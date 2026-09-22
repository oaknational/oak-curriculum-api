# Security Policy

## Supported Versions

We continuously update and improve Oak National Academy's product and codebase,
including patching security vulnerabilities.

Only the version currently deployed at `open-api.thenational.academy` is
supported — fixes are rolled forward, not backported to earlier git tags.

That is compatible with `/api/v0` being frozen. Both majors are served from the
same deployment, so a fix reaches them at once: `/api/v0` is frozen to new
**features**, not to fixes.

| Version                                  | Supported          |
| ---------------------------------------- | ------------------ |
| Latest release, as deployed to production | :white_check_mark: |
| Any earlier release                       | :x:                |

## Reporting a Vulnerability

To report any vulnerability please see our [security.txt](https://www.thenational.academy/.well-known/security.txt) file

Please do **not** report vulnerabilities through the API feedback form, a pull
request, or any other public channel. See [SUPPORT.md](SUPPORT.md) for
non-security questions.
