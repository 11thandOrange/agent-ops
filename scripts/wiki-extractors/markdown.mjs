/**
 * Ingests existing markdown docs verbatim (no LLM rewriting) per
 * config.extractors.markdown.sources (each a glob + navSection).
 * Copies file content byte-for-byte into src/content/<slug>.md and
 * registers metadata into src/data/pages.generated.json + pages.ts.
 *
 * Idempotent: only rewrites a copied .md file when its source content has
 * actually changed (byte comparison); registry entries follow the same
 * add/update/never-remove rule as every other extractor via mergeEntries().
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { globSync } from './glob.mjs';
import { mergeEntries, readJsonSidecar, writeJsonSidecar, writeGeneratedTsWrapper, hashSource } from './merge.mjs';

function slugify(relPath) {
  return relPath
    .replace(/\.md$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, '-')
    .replace(/\//g, '__')
    .replace(/(^-|-$)/g, '');
}

function titleFromMarkdown(content, fallback) {
  const h1 = /^#\s+(.+)$/m.exec(content);
  return h1 ? h1[1].trim() : fallback;
}

export async function extract({ repoRoot, config, outputPaths }) {
  const opts = config.extractors.markdown;
  if (!opts?.enabled) return { skipped: true };

  const incoming = [];
  for (const source of opts.sources ?? []) {
    const files = globSync(source.glob, { cwd: repoRoot });
    for (const relFile of files) {
      const abs = resolve(repoRoot, relFile);
      const content = readFileSync(abs, 'utf8');
      const slug = slugify(relFile);
      const contentFile = `${slug}.md`;
      const destAbs = join(outputPaths.contentDir, contentFile);

      let shouldWrite = true;
      if (existsSync(destAbs)) {
        shouldWrite = readFileSync(destAbs, 'utf8') !== content;
      }
      if (shouldWrite) {
        mkdirSync(dirname(destAbs), { recursive: true });
        writeFileSync(destAbs, content, 'utf8');
      }

      incoming.push({
        slug,
        title: titleFromMarkdown(content, basename(relFile, '.md')),
        sourcePath: relFile,
        contentFile,
        navSection: source.navSection ?? 'Docs',
        _sourceHash: hashSource(content),
      });
    }
  }

  const sidecarPath = join(outputPaths.dataDir, 'pages.generated.json');
  const existing = readJsonSidecar(sidecarPath, []);
  const result = mergeEntries(existing, incoming, { key: 'slug' });

  writeJsonSidecar(sidecarPath, result.merged);
  writeGeneratedTsWrapper(
    join(outputPaths.dataDir, 'pages.ts'),
    `import type { MarkdownPageDoc } from '../types';\nimport data from './pages.generated.json';\n\nexport const markdownPages = data as unknown as MarkdownPageDoc[];\n\nexport function getPage(slug: string) {\n  return markdownPages.find((p) => p.slug === slug);\n}\n`
  );

  return { kind: 'markdown', ...result };
}
