/**
 * Skills extractor (agent-ops issue #286 extension).
 *
 * Registers the repo's skills from every `SKILL.md` under the configured
 * roots. Each SKILL.md carries YAML frontmatter (`name`, `description`,
 * optional `applies_to`); the skill's slug is its containing directory name
 * and its category is derived from the path (e.g. skills/shared/dev/foo ->
 * "shared/dev", skills/personal/bar -> "personal"). Description is ingested
 * verbatim from frontmatter — never rewritten.
 */

import { readFileSync } from 'node:fs';
import { resolve, join, dirname, relative, sep } from 'node:path';
import { globSync } from './glob.mjs';
import { splitFrontmatter } from './features.mjs';
import { mergeEntries, readJsonSidecar, writeJsonSidecar, writeGeneratedTsWrapper, hashSource } from './merge.mjs';

function categoryFromPath(relPath, roots) {
  // relPath like "skills/shared/dev/project-conventions/SKILL.md" ->
  // "shared/dev"; strip the leading configured root and the trailing
  // <skill-dir>/SKILL.md.
  const parts = dirname(relPath).split(sep).filter(Boolean);
  const rootParts = (roots[0] ?? 'skills').split('/').filter(Boolean);
  const afterRoot = parts.slice(rootParts.length, -1); // drop root + skill dir
  return afterRoot.join('/') || 'general';
}

export async function extract({ repoRoot, config, outputPaths }) {
  const opts = config.extractors.skills;
  if (!opts?.enabled) return { skipped: true };

  const roots = opts.roots ?? ['skills'];
  const files = roots.flatMap((r) => globSync(`${r}/**/SKILL.md`, { cwd: repoRoot }));

  const incoming = files.map((relPath) => {
    const raw = readFileSync(resolve(repoRoot, relPath), 'utf8');
    const { data } = splitFrontmatter(raw);
    const slug = data.name ?? dirname(relPath).split(sep).pop();
    return {
      slug,
      title: data.name ?? slug,
      description: (data.description ?? '').trim(),
      appliesTo: data.applies_to != null ? String(data.applies_to) : '',
      category: categoryFromPath(relPath, roots),
      path: relPath,
      _sourceHash: hashSource(raw),
    };
  });

  const sidecarPath = join(outputPaths.dataDir, 'skills.generated.json');
  const existing = readJsonSidecar(sidecarPath, []);
  const result = mergeEntries(existing, incoming, { key: 'slug' });

  writeJsonSidecar(sidecarPath, result.merged);
  writeGeneratedTsWrapper(
    join(outputPaths.dataDir, 'skills.ts'),
    `import type { SkillDoc } from '../types';\nimport data from './skills.generated.json';\n\nexport const skills = data as unknown as SkillDoc[];\n\nexport function getSkill(slug: string) {\n  return skills.find((s) => s.slug === slug);\n}\n`
  );

  return { kind: 'skills', ...result };
}
