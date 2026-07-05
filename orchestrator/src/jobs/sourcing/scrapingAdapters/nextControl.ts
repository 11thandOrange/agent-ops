// Shared "advance to the next screen, never click anything submit-like"
// helper for scraping adapters that need to click through a multi-step
// posting page before the actual description text is reachable.
//
// Deliberately NOT identical to job-application-form-prefill.mjs's
// findNextControl, despite solving the same class of problem — the two
// contexts have different risk profiles. That script fills an
// already-loaded application form, where a button literally labeled
// "Apply"/"Apply Now" is the form's own final-submit-equivalent action, so
// it's correctly treated as terminal/blocked there. Here, scraping is
// reading a job POSTING page, where "Apply"/"Easy Apply" is what you'd
// click to *enter* the application flow — but on some sites (LinkedIn Easy
// Apply included) that single click can immediately submit an application
// using an already-complete profile, with no further form to fill at all.
// Since this system's core guarantee is that nothing auto-submits, "apply"
// is never treated as next-like below, and is additionally kept in the
// terminal set — so a button whose text merely mentions it alongside
// next/continue wording (e.g. "Continue to Apply") is still excluded, not
// clicked. If a page requires clicking something apply-flavored to reveal
// its description, this deliberately fails to extract rather than risk it.
import type { Locator, Page } from "playwright";

export async function findNextControl(page: Page): Promise<Locator | null> {
  const locator = page.locator('button, [role="button"], input[type="button"], a[role="button"]');
  const count = await locator.count();
  for (let i = 0; i < count; i++) {
    const el = locator.nth(i);
    const text = ((await el.textContent().catch(() => "")) || "").trim().toLowerCase();
    const aria = ((await el.getAttribute("aria-label").catch(() => "")) || "").toLowerCase();
    const combined = `${text} ${aria}`;
    // "apply" is absent from looksNext (never a reason to click) and
    // present in looksTerminal (blocks ambiguous combinations) — see header.
    const looksNext = /\b(next|continue)\b/.test(combined);
    const looksTerminal = /\b(submit|apply|send|finish|complete|review)\b/.test(combined);
    if (looksNext && !looksTerminal) return el;
  }
  return null;
}
