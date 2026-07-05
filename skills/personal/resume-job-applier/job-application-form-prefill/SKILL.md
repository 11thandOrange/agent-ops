---
name: resume-job-applier-job-application-form-prefill
description: Local companion script that pre-fills a job application's form fields when you open the link yourself. Fill-only — never submits.
---

# Apply-assist (local companion prefill script)

Not part of the deployed orchestrator — this runs on your own machine, triggered by you, against your own saved browser session. It exists because the personal pipeline's drafted `formFields` data (a flat label→value map, part of every `ApplicationPackage`) is otherwise just something you'd copy/paste by hand.

## Permanent boundary: fill-only

**This script has no code path that clicks submit, and none should ever be added to it.** It fills detected form fields from your drafted data, prints a summary of what it filled and what it left blank, and then waits — via an explicit `readline` prompt — for you to press Enter after you've reviewed (and, if you choose, submitted) the application yourself in the same visible browser window it opened. The browser is launched with `headless: false` specifically so you see it happen, not so it can run unattended.

This was confirmed explicitly during planning: fill-only *for now*, with revisiting an opt-in auto-submit path left as a future decision — not something this script should drift toward implementing quietly.

## Running it

The script itself lives at `orchestrator/scripts/job-application-form-prefill.mjs`, not under this skill folder — Node's ESM resolver finds the `playwright` dependency by walking up from the *script's own* location, not the shell's working directory, so it has to live somewhere `orchestrator/node_modules` is actually an ancestor of. Run it from within `orchestrator/`:

```
node scripts/job-application-form-prefill.mjs \
  --url "<job posting URL>" \
  --data ./application-fields.json \
  --sessions-dir "$SITE_SESSIONS_DIR" \
  --litellm-url "$LITELLM_PROXY_URL" --litellm-key "$LITELLM_VIRTUAL_KEY" --model planning
```

- `--data` — a JSON file containing the `formFields` object from a personal-pipeline result (e.g. save it from the chat response or a `the-store` CSV row's linked data).
- `--sessions-dir` — optional; a directory of saved Playwright storage-state files, one per site, named `<hostname>.json` (e.g. `linkedin.com.json`) — resolved automatically by `--url`'s hostname. **(Revised)** this used to be a single `--storage-state <path>` pointing at one fixed (LinkedIn) session; that didn't generalize once more than one site was in scope. `--storage-state <path>` still works too, if you'd rather point at one file explicitly for a single run — it takes priority over `--sessions-dir` if both are given.
- `--litellm-url`/`--litellm-key`/`--model` — optional; enables an LLM-assisted fallback for fields the heuristic matcher can't confidently pair up. Runs heuristic-only if omitted.

## How field matching works, and its real limits

1. **Heuristic first:** each detected form field's label (from an associated `<label>`, a wrapping `<label>` with no `for`/`id` — common for checkbox/radio options — `aria-label`, `placeholder`, or `name` attribute) is token-matched against your `formFields` data keys by word overlap. A match only counts above a similarity threshold — a low-confidence guess is left blank rather than filled with something wrong.
2. **LLM-assisted fallback (optional):** whatever's left unmatched on both sides is sent to the model once, asking it to pair remaining labels to remaining data keys — still no guessing forced; the model is told to omit a label rather than force a bad match.
3. **Whatever's still unmatched is printed and left blank** for you to fill by hand.

**(New) Checkboxes and radio groups are handled, not just text/select fields.** A standalone checkbox is matched by its own label and set checked/unchecked from whether your data value reads as truthy ("yes"/"true"/"1"/"agree"/etc.). Radio buttons sharing a `name` are treated as one grouped question — matched as a whole (via the group's `<fieldset><legend>`, `role="radiogroup"` label, or humanized `name`), then only the single best-matching option within that group is checked.

**(New) Multi-step/wizard forms are supported.** After filling the current screen, the script looks for a "Next"/"Continue" control and clicks it, then re-detects and fills the next screen — up to 10 steps. This is a strict allowlist, not a blocklist: a control must positively match next/continue wording **and** must not also match submit-like wording ("submit"/"apply"/"send"/"finish"/"complete"/"review"), so an ambiguous or unrecognized control is left alone rather than risking a false-positive click on the real submit button. The fill-only boundary above still applies at every step — this only ever advances the form, never submits it.

**(New) Field detection walks every frame on the page**, not just the top-level document — an embedded ATS widget living in an iframe is now found and filled the same as top-level fields.

**Honest limitation on real-site verification:** the checkbox/radio, multi-step, and iframe logic above is verified against a hand-built local test (a two-step form with a checkbox, a radio group, and an iframe field — all matched and filled correctly, and the step-2 "Submit Application" button was correctly never treated as "Next"). It has **not** been run against a live production application form (LinkedIn Easy Apply, Greenhouse, Lever, Workday, etc.) — the environment this was built in has no outbound access to arbitrary external sites to try one. Different sites structure their forms very differently (a plain HTML form vs. a React-rendered modal behave differently for element detection and `fill()`), so treat this as a strong first draft and expect to need site-specific adjustments after trying it against a real posting, similar to `sourcing/scraping/SKILL.md`'s selectors.
