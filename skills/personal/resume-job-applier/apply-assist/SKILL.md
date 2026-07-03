---
name: resume-job-applier-apply-assist
description: Local companion script that pre-fills a job application's form fields when you open the link yourself. Fill-only — never submits.
---

# Apply-assist (local companion prefill script)

Not part of the deployed orchestrator — this runs on your own machine, triggered by you, against your own saved browser session. It exists because the personal pipeline's drafted `formFields` data (a flat label→value map, part of every `ApplicationPackage`) is otherwise just something you'd copy/paste by hand.

## Permanent boundary: fill-only

**This script has no code path that clicks submit, and none should ever be added to it.** It fills detected form fields from your drafted data, prints a summary of what it filled and what it left blank, and then waits — via an explicit `readline` prompt — for you to press Enter after you've reviewed (and, if you choose, submitted) the application yourself in the same visible browser window it opened. The browser is launched with `headless: false` specifically so you see it happen, not so it can run unattended.

This was confirmed explicitly during planning: fill-only *for now*, with revisiting an opt-in auto-submit path left as a future decision — not something this script should drift toward implementing quietly.

## Running it

The script itself lives at `orchestrator/scripts/apply-assist.mjs`, not under this skill folder — Node's ESM resolver finds the `playwright` dependency by walking up from the *script's own* location, not the shell's working directory, so it has to live somewhere `orchestrator/node_modules` is actually an ancestor of. Run it from within `orchestrator/`:

```
node scripts/apply-assist.mjs \
  --url "<job posting URL>" \
  --data ./application-fields.json \
  --storage-state "$LINKEDIN_STORAGE_STATE_PATH" \
  --litellm-url "$LITELLM_PROXY_URL" --litellm-key "$LITELLM_VIRTUAL_KEY" --model planning
```

- `--data` — a JSON file containing the `formFields` object from a personal-pipeline result (e.g. save it from the chat response or a `the-store` CSV row's linked data).
- `--storage-state` — optional; only needed if the application page requires your logged-in session to load correctly (e.g. LinkedIn Easy Apply).
- `--litellm-url`/`--litellm-key`/`--model` — optional; enables an LLM-assisted fallback for fields the heuristic matcher can't confidently pair up. Runs heuristic-only if omitted.

## How field matching works, and its real limits

1. **Heuristic first:** each detected form field's label (from an associated `<label>`, `aria-label`, `placeholder`, or `name` attribute) is token-matched against your `formFields` data keys by word overlap. A match only counts above a similarity threshold — a low-confidence guess is left blank rather than filled with something wrong.
2. **LLM-assisted fallback (optional):** whatever's left unmatched on both sides is sent to the model once, asking it to pair remaining labels to remaining data keys — still no guessing forced; the model is told to omit a label rather than force a bad match.
3. **Whatever's still unmatched is printed and left blank** for you to fill by hand.

**Honest limitation:** this has not been run against a live, authenticated application form in the environment it was built in (no browser session was available there) — treat it as a real first draft. Different sites structure their forms very differently (a plain HTML form vs. a React-rendered modal like LinkedIn Easy Apply behave differently for element detection and `fill()`), so expect to need site-specific adjustments after trying it against a real posting, similar to `sourcing/scraping/SKILL.md`'s selectors.
