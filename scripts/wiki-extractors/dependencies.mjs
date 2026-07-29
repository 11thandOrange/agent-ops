/**
 * Dependencies extractor (agent-ops issue #286 extension).
 *
 * Reads each package.json listed under extractors.dependencies.manifests
 * (relative to the repo root) and emits one DependencyDoc per declared
 * dependency, tagged with the component (the manifest's directory) and
 * whether it is a runtime `dependency` or a `devDependency`. Versions are
 * taken verbatim from the manifest. Non-npm third parties (the GitHub App,
 * Cloud Run, LiteLLM, external APIs) are NOT here — those are authored in
 * the `integrations` extractor, since they live in no manifest.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { mergeEntries, readJsonSidecar, writeJsonSidecar, writeGeneratedTsWrapper, hashSource } from './merge.mjs';

export async function extract({ repoRoot, config, outputPaths }) {
  const opts = config.extractors.dependencies;
  if (!opts?.enabled) return { skipped: true };

  const manifests = opts.manifests ?? ['package.json'];
  const incoming = [];

  for (const manifestRel of manifests) {
    const abs = resolve(repoRoot, manifestRel);
    if (!existsSync(abs)) continue;
    const raw = readFileSync(abs, 'utf8');
    const pkg = JSON.parse(raw);
    const component = pkg.name ?? (dirname(manifestRel) === '.' ? 'root' : dirname(manifestRel));

    for (const [kind, field] of [
      ['dependency', 'dependencies'],
      ['devDependency', 'devDependencies'],
    ]) {
      for (const [name, version] of Object.entries(pkg[field] ?? {})) {
        incoming.push({
          slug: `${component}::${name}`,
          name,
          version: String(version),
          kind,
          component,
          packageFile: manifestRel,
          _sourceHash: hashSource(`${component}|${name}|${version}|${kind}`),
        });
      }
    }
  }

  const sidecarPath = join(outputPaths.dataDir, 'dependencies.generated.json');
  const existing = readJsonSidecar(sidecarPath, []);
  const result = mergeEntries(existing, incoming, { key: 'slug' });

  writeJsonSidecar(sidecarPath, result.merged);
  writeGeneratedTsWrapper(
    join(outputPaths.dataDir, 'dependencies.ts'),
    `import type { DependencyDoc } from '../types';\nimport data from './dependencies.generated.json';\n\nexport const dependencies = data as unknown as DependencyDoc[];\n\nexport function dependenciesByComponent(): Record<string, DependencyDoc[]> {\n  return dependencies.reduce((acc, d) => {\n    (acc[d.component] ??= []).push(d);\n    return acc;\n  }, {} as Record<string, DependencyDoc[]>);\n}\n`
  );

  return { kind: 'dependencies', ...result };
}
