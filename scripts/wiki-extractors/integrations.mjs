/**
 * Integrations extractor (agent-ops issue #286 extension).
 *
 * Third parties that live in no package.json — the pipeline-orchestrator
 * GitHub App, the LiteLLM gateway, Google Cloud Run, Supabase, SerpAPI,
 * JSearch, the model providers, marketplace Actions. These can't be derived
 * from source, so they're authored (approach A) as an `integrations:` list
 * in wiki.config.yaml and rendered alongside the npm packages on the
 * Dependencies & Integrations page. Every field is a literal from config.
 */

import { join } from 'node:path';
import { mergeEntries, readJsonSidecar, writeJsonSidecar, writeGeneratedTsWrapper, hashSource, stableStringify } from './merge.mjs';

export async function extract({ config, outputPaths }) {
  const opts = config.extractors.integrations;
  if (!opts?.enabled) return { skipped: true };

  const incoming = (opts.items ?? []).map((it) => {
    const entry = {
      slug: it.slug,
      name: it.name ?? it.slug,
      kind: it.kind ?? 'service',
      summary: it.summary ?? '',
      auth: it.auth ?? '',
      url: it.url ?? '',
      notes: (it.notes ?? []).map((n) => ({ kind: n?.kind ?? 'note', body: n?.body ?? '' })).filter((n) => n.body),
    };
    return { ...entry, _sourceHash: hashSource(stableStringify(entry)) };
  });

  const sidecarPath = join(outputPaths.dataDir, 'integrations.generated.json');
  const existing = readJsonSidecar(sidecarPath, []);
  const result = mergeEntries(existing, incoming, { key: 'slug' });

  writeJsonSidecar(sidecarPath, result.merged);
  writeGeneratedTsWrapper(
    join(outputPaths.dataDir, 'integrations.ts'),
    `import type { IntegrationDoc } from '../types';\nimport data from './integrations.generated.json';\n\nexport const integrations = data as unknown as IntegrationDoc[];\n\nexport function getIntegration(slug: string) {\n  return integrations.find((i) => i.slug === slug);\n}\n`
  );

  return { kind: 'integrations', ...result };
}
