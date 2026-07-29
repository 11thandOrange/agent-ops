/**
 * Thin wrapper around Node's built-in fs.globSync (stable since Node 22),
 * returning repo-root-relative POSIX-style paths and always excluding
 * node_modules/.git regardless of pattern. Kept as its own module so every
 * extractor imports globbing from one place - if a future Node LTS target
 * needs a userland fallback (the `glob` npm package), only this file changes.
 */

import { globSync as fsGlobSync } from 'node:fs';

const EXCLUDED_SEGMENTS = new Set(['node_modules', '.git', 'dist', 'build', '.next']);

export function globSync(pattern, { cwd }) {
  // fs.globSync already returns paths relative to `cwd`, matching the
  // pattern's own path style (POSIX separators) - no extra relative()
  // needed, and doing so would be wrong for patterns that don't start
  // under cwd verbatim (e.g. absolute patterns).
  const matches = fsGlobSync(pattern, { cwd });
  return matches.filter((m) => !m.split('/').some((seg) => EXCLUDED_SEGMENTS.has(seg)));
}
