#!/usr/bin/env node
// Local companion prefill script — NOT part of the deployed orchestrator.
// You run this yourself, on your own machine, against your own saved
// session for whichever site the job link belongs to (not LinkedIn-only —
// see --sessions-dir), to open it with its form fields pre-filled from a
// completed application package. It NEVER submits anything: it
// fills fields and then waits for you to review and click submit yourself
// in the same visible browser window. There is no flag, mode, or code path
// in this file that clicks a submit-like button — that boundary is
// permanent as of when this was built (see SKILL.md).
//
// Lives inside orchestrator/ (not under skills/, where the rest of this
// project's docs live) so Node's ESM resolver finds `playwright` via the
// normal node_modules walk-up — it resolves relative to *this file's own*
// location, not the shell's cwd, and skills/ isn't an ancestor of
// orchestrator/node_modules. Run from within orchestrator/:
//   node scripts/job-application-form-prefill.mjs \
//     --url "https://www.linkedin.com/jobs/view/12345" \
//     --data ./application-fields.json \
//     --sessions-dir "$SITE_SESSIONS_DIR"
//
// --data points at a JSON file holding the `formFields` object from a
// personal-pipeline ApplicationPackage: a flat { "Label": "value" } map.
//
// Handles text/textarea/select fields, standalone checkboxes, and radio
// groups (grouped by shared `name`, matched as one question, then the
// single best-matching option is checked). Detection walks every frame on
// the page (main document + iframes), not just the top level, so fields
// inside an embedded ATS widget are found too. Multi-step/wizard forms are
// supported by clicking a detected "Next"/"Continue" control and re-running
// detection on each subsequent screen — that detector is a strict allowlist
// (must positively match next/continue wording AND not match any
// submit-like wording), specifically so it can never mistake a real submit
// button for a "next" button. Field-matching is heuristic (label/aria-label/
// placeholder/name token overlap against your field-data keys) with an
// optional LLM-assisted fallback (--litellm-url/--litellm-key/--model) for
// fields the heuristic can't confidently match — this is a real first
// draft, not verified against live production sites (only a hand-built
// multi-step test page with a checkbox, radio group, and iframe — see
// scratchpad test harness used during development). Expect to tune the
// matching threshold or add site-specific hints after trying it against a
// real form.
import { chromium } from "playwright";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";

// Resolves whichever session applies for --url: an explicit --storage-state
// wins; otherwise --sessions-dir is checked for "<hostname>.json" (same
// convention as orchestrator/src/integrations/site_sessions.ts, duplicated
// here rather than imported since this script runs standalone, outside the
// compiled orchestrator package). Falls back to unauthenticated if neither
// resolves anything — not every site needs a saved session.
export function resolveStorageState(args, url) {
  if (args["storage-state"]) return args["storage-state"];
  if (!args["sessions-dir"]) return undefined;
  const hostname = new URL(url).hostname.replace(/^www\./, "");
  const candidate = path.join(args["sessions-dir"], `${hostname}.json`);
  return existsSync(candidate) ? candidate : undefined;
}

export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, "");
    args[key] = argv[i + 1];
  }
  return args;
}

export function tokenize(text) {
  return (text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function overlapScore(a, b) {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.max(ta.size, tb.size);
}

export const MATCH_THRESHOLD = 0.4;

export function heuristicMatch(fieldLabels, dataKeys) {
  const matches = new Map(); // fieldLabel -> dataKey
  const usedKeys = new Set();
  for (const label of fieldLabels) {
    let best = { key: undefined, score: 0 };
    for (const key of dataKeys) {
      if (usedKeys.has(key)) continue;
      const score = overlapScore(label, key);
      if (score > best.score) best = { key, score };
    }
    if (best.key && best.score >= MATCH_THRESHOLD) {
      matches.set(label, best.key);
      usedKeys.add(best.key);
    }
  }
  return matches;
}

export async function llmAssistedMatch(litellmUrl, litellmKey, model, unmatchedLabels, unmatchedKeys) {
  if (!litellmUrl || !litellmKey || unmatchedLabels.length === 0 || unmatchedKeys.length === 0) return new Map();
  const res = await fetch(`${litellmUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${litellmKey}` },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "Match application form field labels to the closest semantically-equivalent data key. " +
            "Respond with ONLY a JSON object mapping each form field label to its best-matching data key. " +
            "Omit a label entirely if none of the data keys are a reasonable match — do not guess.",
        },
        { role: "user", content: `Form field labels:\n${JSON.stringify(unmatchedLabels)}\n\nAvailable data keys:\n${JSON.stringify(unmatchedKeys)}` },
      ],
    }),
  });
  if (!res.ok) {
    console.warn(`LLM-assisted matching failed (${res.status}) — continuing with heuristic matches only.`);
    return new Map();
  }
  const body = await res.json();
  try {
    const mapping = JSON.parse(body.choices[0].message.content);
    return new Map(Object.entries(mapping));
  } catch {
    console.warn("LLM-assisted matching returned invalid JSON — continuing with heuristic matches only.");
    return new Map();
  }
}

// A checkbox's fieldData value is a plain string/boolean, not natively a
// checked state — this is the (necessarily heuristic) mapping between them.
export function isTruthy(value) {
  if (typeof value === "boolean") return value;
  return ["yes", "true", "1", "y", "agree", "checked"].includes(String(value ?? "").trim().toLowerCase());
}

function humanize(name) {
  return name.replace(/[_-]+/g, " ").trim();
}

// Detects fillable fields within a single frame (main document or an
// iframe — Playwright's automation protocol can interact with cross-origin
// iframe content even though in-page JS couldn't, so no same-origin
// filtering is needed here). Tags each candidate with a temporary marker
// attribute, scoped to this frame, so it can be targeted by a frame-scoped
// locator after this evaluate pass returns — raw DOM handles from evaluate
// can't be filled directly via the Playwright API (which is what dispatches
// realistic input events).
export async function detectFields(frame) {
  try {
    return await frame.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll("input, textarea, select")).filter((el) => {
        const type = (el.getAttribute("type") || "").toLowerCase();
        return el.tagName !== "INPUT" || !["hidden", "submit", "button", "file"].includes(type);
      });
      return candidates.map((el, i) => {
        el.setAttribute("data-agent-ops-idx", String(i));
        const type = (el.getAttribute("type") || "").toLowerCase();
        const labelEl = el.id ? document.querySelector(`label[for="${el.id}"]`) : null;
        // Radio/checkbox options are very often wrapped rather than
        // for/id-associated (<label><input type="radio"> Yes</label>) — that
        // wrapping label's text is the option's real visible text, whereas
        // falling straight through to the name attribute would give the
        // whole group's shared name instead of this one option's text.
        const wrappingLabelEl = el.closest("label");
        const label =
          labelEl?.textContent?.trim() ||
          wrappingLabelEl?.textContent?.trim() ||
          el.getAttribute("aria-label") ||
          el.getAttribute("placeholder") ||
          el.getAttribute("name") ||
          "";
        // Radios answer one shared question as a group — their own label is
        // usually just the option text ("Yes"/"No"), not the question
        // itself, so also capture whatever names the group as a whole.
        let groupLabel = "";
        if (type === "radio") {
          const fieldset = el.closest("fieldset");
          const legend = fieldset?.querySelector("legend");
          const radiogroup = el.closest('[role="radiogroup"]');
          const labelledBy = radiogroup?.getAttribute("aria-labelledby");
          groupLabel =
            legend?.textContent?.trim() ||
            radiogroup?.getAttribute("aria-label") ||
            (labelledBy ? document.getElementById(labelledBy)?.textContent?.trim() : "") ||
            "";
        }
        return {
          idx: i,
          tag: el.tagName.toLowerCase(),
          type,
          label,
          groupLabel,
          name: el.getAttribute("name") || "",
          optionValue: el.getAttribute("value") || "",
        };
      });
    });
  } catch {
    // A frame that's mid-navigation, detached, or blocks evaluate (rare,
    // e.g. some ad/analytics iframes) — skip it rather than fail the run.
    return [];
  }
}

// Fills every detected field on the current step (main document + all
// iframes), returns { filled, unfilledLabels, totalDetected }. Text/select
// fields are matched and filled individually; checkboxes are matched
// individually and set truthy/falsy from fieldData's value; radios are
// grouped by (frame, name) into one question per group, matched as a whole,
// then only the single best-matching option within that group is checked.
export async function fillCurrentStep(page, fieldData, dataKeys, args) {
  const frames = page.frames();
  const perFrame = await Promise.all(frames.map((f) => detectFields(f)));

  const textFields = []; // {frame, idx, tag, label}
  const checkboxFields = []; // {frame, idx, label}
  const radioGroups = new Map(); // "frameIdx::name" -> {groupLabel, options: [{frame, idx, optionValue, label}]}

  perFrame.forEach((fields, frameIdx) => {
    const frame = frames[frameIdx];
    for (const f of fields) {
      if (f.type === "checkbox") {
        if (f.label) checkboxFields.push({ frame, idx: f.idx, label: f.label });
      } else if (f.type === "radio") {
        const key = `${frameIdx}::${f.name || f.label}`;
        if (!radioGroups.has(key)) {
          radioGroups.set(key, { groupLabel: f.groupLabel || humanize(f.name) || f.label, options: [] });
        }
        radioGroups.get(key).options.push({ frame, idx: f.idx, optionValue: f.optionValue, label: f.label });
      } else if (f.label) {
        textFields.push({ frame, idx: f.idx, tag: f.tag, label: f.label });
      }
    }
  });

  const textLabels = textFields.map((f) => f.label);
  const checkboxLabels = checkboxFields.map((f) => f.label);
  const groupList = [...radioGroups.values()];
  const groupLabels = groupList.map((g) => g.groupLabel);

  // Each kind is matched against the full dataKeys pool independently — a
  // checkbox and a text field never compete for the same key in practice,
  // since they represent structurally different questions on the form.
  const textHeuristic = heuristicMatch(textLabels, dataKeys);
  const checkboxHeuristic = heuristicMatch(checkboxLabels, dataKeys);
  const groupHeuristic = heuristicMatch(groupLabels, dataKeys);

  const unmatchedLabels = [
    ...textLabels.filter((l) => !textHeuristic.has(l)),
    ...checkboxLabels.filter((l) => !checkboxHeuristic.has(l)),
    ...groupLabels.filter((l) => !groupHeuristic.has(l)),
  ];
  const usedKeys = new Set([...textHeuristic.values(), ...checkboxHeuristic.values(), ...groupHeuristic.values()]);
  const unmatchedKeys = dataKeys.filter((k) => !usedKeys.has(k));
  const assisted = await llmAssistedMatch(args["litellm-url"], args["litellm-key"], args.model ?? "planning", unmatchedLabels, unmatchedKeys);

  let filled = 0;
  const unfilledLabels = [];

  for (const field of textFields) {
    const dataKey = textHeuristic.get(field.label) ?? assisted.get(field.label);
    if (!dataKey) {
      unfilledLabels.push(field.label);
      continue;
    }
    const value = fieldData[dataKey];
    const locator = field.frame.locator(`[data-agent-ops-idx="${field.idx}"]`);
    if (field.tag === "select") {
      await locator.selectOption({ label: String(value) }).catch(() => locator.selectOption(String(value)).catch(() => {}));
    } else {
      await locator.fill(String(value)).catch(() => {});
    }
    filled++;
  }

  for (const field of checkboxFields) {
    const dataKey = checkboxHeuristic.get(field.label) ?? assisted.get(field.label);
    if (!dataKey) {
      unfilledLabels.push(field.label);
      continue;
    }
    const locator = field.frame.locator(`[data-agent-ops-idx="${field.idx}"]`);
    await locator.setChecked(isTruthy(fieldData[dataKey])).catch(() => {});
    filled++;
  }

  for (const group of groupList) {
    const dataKey = groupHeuristic.get(group.groupLabel) ?? assisted.get(group.groupLabel);
    if (!dataKey) {
      unfilledLabels.push(group.groupLabel);
      continue;
    }
    const desired = String(fieldData[dataKey]);
    let best = { option: undefined, score: 0 };
    for (const option of group.options) {
      const score = overlapScore(option.label || option.optionValue, desired);
      if (score > best.score) best = { option, score };
    }
    if (best.option && best.score >= MATCH_THRESHOLD) {
      await best.option.frame.locator(`[data-agent-ops-idx="${best.option.idx}"]`).setChecked(true).catch(() => {});
      filled++;
    } else {
      unfilledLabels.push(group.groupLabel);
    }
  }

  return { filled, unfilledLabels, totalDetected: textFields.length + checkboxFields.length + groupList.length };
}

// Only ever advances a multi-step form — never a submit-like control. This
// is an allowlist, not a blocklist: a control must positively match
// next/continue wording AND must NOT also match any submit-like wording, so
// an ambiguous or unrecognized control is left alone rather than risking a
// false-positive click on the real submit button. This is the load-bearing
// safety check for multi-step support — do not weaken it to a blocklist
// (matching anything that *isn't* submit-like) even for convenience.
export async function findNextControl(page) {
  const locator = page.locator('button, [role="button"], input[type="button"]');
  const count = await locator.count();
  for (let i = 0; i < count; i++) {
    const el = locator.nth(i);
    const text = ((await el.textContent().catch(() => "")) || "").trim().toLowerCase();
    const aria = ((await el.getAttribute("aria-label").catch(() => "")) || "").toLowerCase();
    const combined = `${text} ${aria}`;
    const looksNext = /\b(next|continue)\b/.test(combined);
    const looksTerminal = /\b(submit|apply|send|finish|complete|review)\b/.test(combined);
    if (looksNext && !looksTerminal) return el;
  }
  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.url || !args.data) {
    console.error(
      "Usage: node scripts/job-application-form-prefill.mjs --url <jobUrl> --data <fields.json> " +
        "[--storage-state <path> | --sessions-dir <dir>] [--litellm-url <url>] [--litellm-key <key>] [--model planning]",
    );
    process.exit(1);
  }
  const fieldData = JSON.parse(readFileSync(args.data, "utf-8"));
  const dataKeys = Object.keys(fieldData);
  const storageState = resolveStorageState(args, args.url);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext(storageState ? { storageState } : {});
  const page = await context.newPage();
  await page.goto(args.url, { waitUntil: "domcontentloaded" });

  const MAX_STEPS = 10; // guards against an infinite Next-click loop on a misdetected control
  let totalFilled = 0;
  let totalDetected = 0;
  const allUnfilled = [];
  for (let step = 1; step <= MAX_STEPS; step++) {
    const { filled, unfilledLabels, totalDetected: detected } = await fillCurrentStep(page, fieldData, dataKeys, args);
    totalFilled += filled;
    totalDetected += detected;
    allUnfilled.push(...unfilledLabels);
    console.log(`Step ${step}: filled ${filled} of ${detected} detected fields.`);

    const next = await findNextControl(page);
    if (!next) break;
    const label = ((await next.textContent().catch(() => "")) || "").trim();
    console.log(`Step ${step}: advancing via "${label || "next control"}"...`);
    await next.click().catch(() => {});
    await page.waitForTimeout(1000); // heuristic settle time — no robust readiness signal exists across arbitrary forms
  }

  console.log(`\nFilled ${totalFilled} of ${totalDetected} detected form fields across all steps.`);
  if (allUnfilled.length) {
    console.log("Left blank (no confident match — fill these yourself):");
    for (const label of allUnfilled) console.log(`  - ${label}`);
  }
  console.log("\nReview everything before submitting. This script will never click submit for you.");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((resolve) => rl.question("Press Enter when you're done (this closes the browser)... ", resolve));
  rl.close();
  await browser.close();
}

// Guards main() so this file can also be imported (e.g. by a test harness)
// without launching a browser and waiting on stdin as a side effect.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
