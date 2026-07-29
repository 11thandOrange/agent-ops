---
title: Wiki Generator
order: 1
summary: Config-driven shared generator that builds a target repo's docs site from its own source, then deploys it to GitHub Pages.
status: stable
implements:
  workflows: [wiki-generate-reusable]
  skills: []
  dependencies: ["yaml"]
  integrations: [github-app, github-actions]
runWith:
  - "App repos call the reusable workflow via a thin caller (templates/wiki-caller.yml); locally via node scripts/wiki-generate.mjs."
tradeoffs:
  - "Extractors are resolved by naming convention (config key fooBar -> foo-bar.mjs), so adding a doc kind is a new module plus config key, never a change to the driver's core loop."
notes:
  - kind: note
    body: "The site bootstrap only copies template files that don't already exist, so hand-customized site source is never overwritten on later runs."
---

## What it does
The shared wiki generator (agent-ops issue #286) builds a documentation site for a target repository directly from that repo's own source code and config. A single driver reads the target's `wiki.config.yaml`, runs only the extractors it declares, writes generated data and content into a React/Vite site, and the reusable CI workflow commits the output back and deploys it to GitHub Pages. Nothing is hardcoded per repo, and no site content is LLM-generated — extractors emit deterministic data from source.

## How it works
`scripts/wiki-generate.mjs` loads `wiki.config.yaml` and iterates the keys under `extractors:`. Each key resolves by convention to a module in `scripts/wiki-extractors/` (config key `fooBar` -> `foo-bar.mjs` exporting `extract(ctx)`); a missing module or one lacking `extract()` is skipped with a warning. Before running extractors it bootstraps `templates/wiki-site/` into the target's site dir, copying only files that don't already exist. Extractors write `src/data/*.generated.json` plus `.ts` wrappers and `src/content/*.md`; the driver then derives `src/data/navigation.ts` from whichever extractors were enabled and writes a literal-values-only `src/wiki.config.generated.ts` (title, theme, backend URLs) plus `public/CNAME` when a custom domain is set.

## Configuration & running
Each consuming repo copies `templates/wiki-site/wiki.config.example.yaml` to its root as `wiki.config.yaml` and enables extractor kinds (Express/Kotlin endpoints, workflows, automation, tests, markdown, app-list). App repos add a thin caller based on `templates/wiki-caller.yml` that invokes the reusable workflow `.github/workflows/wiki-generate-reusable.yml`. That workflow checks out both the target repo and the control repo (agent-ops) using a GitHub App token, installs the generator's `yaml` dependency from `scripts/package.json`, runs the generator, commits any changed generated files back to the target's default branch, then builds the Vite site (React + react-router-dom + react-markdown + tailwind) and deploys the `dist/` output to GitHub Pages. Locally: `node scripts/wiki-generate.mjs --repo-root <target> --control-repo <agent-ops> [--config <path>] [--site-dir docs]`.
