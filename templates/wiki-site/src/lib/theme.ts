import { wikiConfig } from '../wiki.config.generated';

/**
 * Applies wiki.config.yaml's literal theme/title/favicon values at runtime,
 * once, on load. Everything here comes straight from wiki.config.generated.ts
 * (itself a deterministic passthrough of wiki.config.yaml written by
 * scripts/wiki-generate.mjs) - never computed or invented.
 */
export function applyTheme() {
  const root = document.documentElement;
  root.style.setProperty('--wiki-accent', wikiConfig.theme.accent);
  root.style.setProperty('--wiki-accent-hover', wikiConfig.theme.accentHover);
  root.style.setProperty('--wiki-accent-muted', wikiConfig.theme.accentMuted);

  document.title = wikiConfig.title;

  const favicon = document.getElementById('wiki-favicon');
  if (favicon) favicon.setAttribute('href', wikiConfig.favicon);
}
