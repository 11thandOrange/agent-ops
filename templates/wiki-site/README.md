# wiki-site template

Shared React + TypeScript + Tailwind + Vite documentation site template
(agent-ops issue #286). This directory is not meant to be developed against
directly for a specific app - it's bootstrapped into each consuming repo's
own `docs/` (or whatever `--site-dir` the caller workflow configures) by
`scripts/wiki-generate.mjs`, which copies any file here that doesn't already
exist in the target checkout, then runs the configured extractors to
populate `src/data/*.generated.json` + `src/data/*.ts` and `src/content/*.md`.

## What's generated vs. hand-owned

| Path | Owner |
|---|---|
| `src/data/*.generated.json` | extractors (idempotent merge - safe to hand-edit between runs) |
| `src/data/*.ts` | extractors/driver (always fully regenerated - never hand-edit) |
| `src/content/*.md` | markdown extractor (verbatim copies of source docs) |
| `src/wiki.config.generated.ts` | driver, from the repo's `wiki.config.yaml` |
| everything else (components, pages, config files) | the consuming repo, once bootstrapped - customize freely, the generator never overwrites an existing file outside the paths above |

## Content model

Every page renders one of the typed arrays in `src/data/*.ts`
(`EndpointGroup[]`, `AppDoc[]`, `WorkflowDoc[]`, `AutomationDoc[]`,
`TestSuiteDoc[]`, `MarkdownPageDoc[]` - see `src/types/index.ts`) - there is
no markdown-prose-as-page-source and no LLM in the generation loop. The
`DocsPage` route is the one exception in spirit only: it renders ingested
markdown files verbatim, but which files exist and their nav placement is
still driven by the typed `MarkdownPageDoc[]` registry, not free text.

## Sandbox ("Try it")

`src/components/ApiReference/Sandbox.tsx` never calls the target API
directly from the browser - it always POSTs to `wikiConfig.proxyBaseUrl +
"/api/proxy"` (see `../wiki-backend`), which forwards server-side to
`wikiConfig.targetApiBaseUrl`. This is what makes every endpoint (not just
unauthenticated ones) live-testable: auth is supplied per-request in the
sandbox UI and is never persisted.

## Local development

```bash
npm install
npm run dev
```

Without a real `wiki.config.yaml`-driven generation pass, all data arrays
are empty placeholders and pages render an empty state - run
`node ../../scripts/wiki-generate.mjs --repo-root <target-repo> --control-repo <agent-ops-checkout>`
first (from a bootstrapped site) to see real content.
