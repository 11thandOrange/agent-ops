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
//   node scripts/apply-assist.mjs \
//     --url "https://www.linkedin.com/jobs/view/12345" \
//     --data ./application-fields.json \
//     --sessions-dir "$SITE_SESSIONS_DIR"
//
// --data points at a JSON file holding the `formFields` object from a
// personal-pipeline ApplicationPackage: a flat { "Label": "value" } map.
//
// Field-matching is heuristic (label/aria-label/placeholder/name token
// overlap against your field-data keys) with an optional LLM-assisted
// fallback (--litellm-url/--litellm-key/--model) for fields the heuristic
// can't confidently match — this is a real first draft, not verified
// against live sites in the environment this was built in (no browser
// session was available there). Expect to tune the matching threshold or
// add site-specific hints after trying it against a real form.
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
function resolveStorageState(args, url) {
  if (args["storage-state"]) return args["storage-state"];
  if (!args["sessions-dir"]) return undefined;
  const hostname = new URL(url).hostname.replace(/^www\./, "");
  const candidate = path.join(args["sessions-dir"], `${hostname}.json`);
  return existsSync(candidate) ? candidate : undefined;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, "");
    args[key] = argv[i + 1];
  }
  return args;
}

function tokenize(text) {
  return (text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function overlapScore(a, b) {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.max(ta.size, tb.size);
}

const MATCH_THRESHOLD = 0.4;

function heuristicMatch(fieldLabels, dataKeys) {
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

async function llmAssistedMatch(litellmUrl, litellmKey, model, unmatchedLabels, unmatchedKeys) {
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.url || !args.data) {
    console.error(
      "Usage: node scripts/apply-assist.mjs --url <jobUrl> --data <fields.json> " +
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

  // Tag each candidate field with a temporary marker attribute so it can be
  // targeted by a Playwright locator after this evaluate pass returns —
  // raw DOM handles from evaluate can't be filled directly via the
  // Playwright API (which is what dispatches realistic input events).
  const fields = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll("input, textarea, select")).filter((el) => {
      const type = (el.getAttribute("type") || "").toLowerCase();
      return el.tagName !== "INPUT" || !["hidden", "submit", "button", "checkbox", "radio", "file"].includes(type);
    });
    return candidates.map((el, i) => {
      el.setAttribute("data-agent-ops-idx", String(i));
      const labelEl = el.id ? document.querySelector(`label[for="${el.id}"]`) : null;
      const label = labelEl?.textContent?.trim() || el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.getAttribute("name") || "";
      return { idx: i, tag: el.tagName.toLowerCase(), label };
    });
  });

  const labeled = fields.filter((f) => f.label);
  const heuristic = heuristicMatch(
    labeled.map((f) => f.label),
    dataKeys,
  );
  const unmatchedLabels = labeled.map((f) => f.label).filter((l) => !heuristic.has(l));
  const unmatchedKeys = dataKeys.filter((k) => ![...heuristic.values()].includes(k));
  const assisted = await llmAssistedMatch(args["litellm-url"], args["litellm-key"], args.model ?? "planning", unmatchedLabels, unmatchedKeys);
  const allMatches = new Map([...heuristic, ...assisted]);

  let filled = 0;
  for (const field of labeled) {
    const dataKey = allMatches.get(field.label);
    if (!dataKey) continue;
    const value = fieldData[dataKey];
    const locator = page.locator(`[data-agent-ops-idx="${field.idx}"]`);
    if (field.tag === "select") {
      await locator.selectOption({ label: value }).catch(() => locator.selectOption(value).catch(() => {}));
    } else {
      await locator.fill(String(value)).catch(() => {});
    }
    filled++;
  }

  console.log(`Filled ${filled} of ${labeled.length} detected form fields.`);
  const stillUnfilled = labeled.filter((f) => !allMatches.has(f.label)).map((f) => f.label);
  if (stillUnfilled.length) {
    console.log("Left blank (no confident match — fill these yourself):");
    for (const label of stillUnfilled) console.log(`  - ${label}`);
  }
  console.log("\nReview everything before submitting. This script will never click submit for you.");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((resolve) => rl.question("Press Enter when you're done (this closes the browser)... ", resolve));
  rl.close();
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
