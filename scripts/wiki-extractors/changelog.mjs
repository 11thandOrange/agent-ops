/**
 * Changelog extractor (agent-ops issue #286 extension).
 *
 * Reads an authored, committed changelog manifest (default:
 * `wiki-content/changelog.yaml` at the repo root) — a list of entries, each
 * `{ date, added?, changed?, fixed? }` — and emits ChangelogEntry[] for the
 * Changelog page's dated timeline. Authored + version-controlled (approach
 * A), keyed by date; newest first at render time.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { parse } from 'yaml';
import { mergeEntries, readJsonSidecar, writeJsonSidecar, writeGeneratedTsWrapper, hashSource, stableStringify } from './merge.mjs';

export async function extract({ repoRoot, config, outputPaths }) {
  const opts = config.extractors.changelog;
  if (!opts?.enabled) return { skipped: true };

  const srcPath = resolve(repoRoot, opts.source ?? 'wiki-content/changelog.yaml');
  if (!existsSync(srcPath)) {
    throw new Error(`extractors.changelog is enabled but no changelog source at ${srcPath}`);
  }
  const entries = parse(readFileSync(srcPath, 'utf8')) ?? [];

  const incoming = entries.map((e) => {
    const entry = {
      slug: String(e.date),
      date: String(e.date),
      added: e.added ?? [],
      changed: e.changed ?? [],
      fixed: e.fixed ?? [],
    };
    return { ...entry, _sourceHash: hashSource(stableStringify(entry)) };
  });

  const sidecarPath = join(outputPaths.dataDir, 'changelog.generated.json');
  const existing = readJsonSidecar(sidecarPath, []);
  const result = mergeEntries(existing, incoming, { key: 'slug' });

  writeJsonSidecar(sidecarPath, result.merged);
  writeGeneratedTsWrapper(
    join(outputPaths.dataDir, 'changelog.ts'),
    `import type { ChangelogEntry } from '../types';\nimport data from './changelog.generated.json';\n\nexport const changelog = (data as unknown as ChangelogEntry[]).slice().sort((a, b) => (a.date < b.date ? 1 : -1));\n`
  );

  return { kind: 'changelog', ...result };
}
