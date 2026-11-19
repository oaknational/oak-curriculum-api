# AGENTS.md

Read [AGENT.md](.agent/directives/AGENT.md) before starting any task.

## No `any`, explicit or inferred

`any` is never allowed, and that includes an `any` TypeScript infers without
being told. Watch for the common sources:

- `let x = null;` (or `let x;`) with no annotation, which evolves as `any`:
  annotate it (`let next: string | null = null`) or use a `const` where it is
  assigned.
- `declare module 'some-package';` with no body, which makes every import from
  that package `any`: install its types, write a typed declaration, or drop the
  package.
- Untyped library returns such as `Response.json()` or `JSON.parse()`: narrow
  them at the boundary, with a Zod schema at runtime or a single typed cast in
  tests, rather than letting `any` flow on.

`pnpm lint` is not a complete check for this: the `no-unsafe-*` rules only warn,
and they do not catch an `any` that is never used unsafely. Hover the types
you introduce. The editor must use the repo's TypeScript
(`typescript.tsdk` in `.vscode/settings.json`); if it reports errors the CLI
does not, restart the TS and ESLint servers before chasing them, since both
can hold a stale program after files are added.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
