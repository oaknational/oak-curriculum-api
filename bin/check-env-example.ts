#!/usr/bin/env tsx
/**
 * Guards against `.env.example` drifting away from what the code actually
 * reads. A public repository whose setup instructions are incomplete is worse
 * than one with no instructions, because the gap is invisible until someone
 * tries to follow them.
 *
 * Run by the lint workflow. Fails if any `process.env.X` read in `src/` or
 * `bin/` is absent from `.env.example`, unless X is supplied by the runtime
 * rather than by the developer.
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

/** Supplied by Node, Next.js, Vercel, Vitest or the shell — not by the developer. */
const PROVIDED_BY_RUNTIME = new Set([
  'NODE_ENV',
  'PORT',
  'TERM',
  'TEST',
  'VITEST',
  'NEXT_BUILD_ID',
  'VERCEL_BRANCH_URL',
  'VERCEL_DEPLOYMENT_ID',
  'VERCEL_ENV',
  'VERCEL_GIT_COMMIT_SHA',
  // Minted per invocation for workload identity federation, and written to
  // .env.local by `vercel env pull` for local dev. It is a short-lived
  // credential, so it must never be documented as something to fill in.
  'VERCEL_OIDC_TOKEN',
  'VERCEL_URL',
  // custom vars that are for local dev
  'REPORT_MEMORY_USAGE',
]);

const files = execSync("git ls-files 'src/**' 'bin/**'", { encoding: 'utf8' })
  .split('\n')
  .filter((f) => /\.(m?[jt]sx?)$/.test(f));

/**
 * Strip `//` line and block comments so that a `process.env.*` reference
 * mentioned in a comment isn't mistaken for one the code actually reads.
 * Walks character by character to avoid tripping over comment-like sequences
 * inside strings, template literals or regexes.
 */
function stripComments(source: string): string {
  let out = '';
  let i = 0;
  const n = source.length;
  while (i < n) {
    const c = source[i];
    const next = source[i + 1];

    // Line comment
    if (c === '/' && next === '/') {
      i += 2;
      while (i < n && source[i] !== '\n') i++;
      continue;
    }

    // Block comment
    if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    // String / template literal — copy through verbatim, honouring escapes
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      out += c;
      i++;
      while (i < n) {
        out += source[i];
        if (source[i] === '\\') {
          out += source[i + 1] ?? '';
          i += 2;
          continue;
        }
        if (source[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    out += c;
    i++;
  }
  return out;
}

const used = new Set<string>();
for (const file of files) {
  const source = stripComments(readFileSync(file, 'utf8'));
  for (const match of source.matchAll(
    /process\.env(?:\.([A-Z0-9_]+)|\[['"`]([A-Z0-9_]+)['"`]\])/g,
  )) {
    used.add(match[1] ?? match[2]);
  }
}

const example = readFileSync('.env.example', 'utf8');
const documented = new Set(
  [...example.matchAll(/^#?\s*([A-Z0-9_]+)=/gm)].map((m) => m[1]),
);

const missing = [...used]
  .filter((name) => !PROVIDED_BY_RUNTIME.has(name) && !documented.has(name))
  .sort((a, b) => a.localeCompare(b));

// A documented variable may legitimately be consumed outside src/ and bin/ —
// schema.prisma reads one via `env()`, the Artillery config reads another — so
// check the whole tree before calling it unused.
const tracked = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && !f.startsWith('.env'));
const everywhere = tracked
  .map((f) => {
    try {
      return readFileSync(f, 'utf8');
    } catch {
      return '';
    }
  })
  .join('\n');

const unused = [...documented]
  .filter((name) => !used.has(name) && !everywhere.includes(name))
  .sort((a, b) => a.localeCompare(b));

if (missing.length > 0) {
  console.error(
    `.env.example is missing ${missing.length} variable(s) the code reads:\n` +
      missing.map((n) => `  ${n}`).join('\n') +
      '\n\nAdd them to .env.example, or to PROVIDED_BY_RUNTIME in this script ' +
      'if the runtime supplies them.',
  );
  process.exit(1);
}

if (unused.length > 0) {
  console.warn(
    `.env.example documents ${unused.length} variable(s) no longer read in ` +
      `src/ or bin/: ${unused.join(', ')}`,
  );
}

console.log(
  `.env.example covers all ${used.size - PROVIDED_BY_RUNTIME.size} developer-supplied variables.`,
);
