/** Loads and lightly validates a repo's wiki.config.yaml. */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';

/**
 * @param {string} configPath - path to wiki.config.yaml
 * @returns {object} the parsed config
 */
export function loadWikiConfig(configPath) {
  if (!existsSync(configPath)) {
    throw new Error(
      `wiki.config.yaml not found at ${configPath}. Copy templates/wiki-site/wiki.config.example.yaml into the target repo's root and fill it in.`
    );
  }
  const raw = readFileSync(configPath, 'utf8');
  const config = parse(raw);

  if (!config || typeof config !== 'object') {
    throw new Error(`${configPath} did not parse to an object.`);
  }
  if (!config.site?.title) {
    throw new Error(`${configPath}: site.title is required.`);
  }
  if (!config.extractors || typeof config.extractors !== 'object') {
    throw new Error(`${configPath}: extractors: block is required (may declare all extractors disabled).`);
  }
  if (!config.output?.dataDir || !config.output?.contentDir) {
    throw new Error(`${configPath}: output.dataDir and output.contentDir are required.`);
  }

  return config;
}

/** Resolves the output data-dir / content-dir absolute paths for a given site checkout root. */
export function resolveOutputPaths(config, siteRoot) {
  return {
    dataDir: resolve(siteRoot, config.output.dataDir),
    contentDir: resolve(siteRoot, config.output.contentDir),
  };
}
