// Detects whether navigation landed on a login/sign-in wall instead of the
// actual posting — previously indistinguishable from a wrong selector, a
// slow-loading page, or a site markup change, all of which produced the
// same generic selector-timeout error. Not exhaustive (there's no reliable
// universal signal for "this is a login wall"), but catches the common
// cases: a URL redirect to something login-shaped, or common "sign in to
// continue" wording on the landed page.
import type { Page } from "playwright";

const URL_PATTERN = /\b(login|signin|sign-in)\b/;
const BODY_TEXT_PATTERN = /(sign in to (view|continue|apply)|log in to (view|continue|apply)|please (sign|log) in)/;

export async function detectLoginWall(page: Page): Promise<boolean> {
  if (URL_PATTERN.test(page.url().toLowerCase())) return true;
  const bodyText = (await page.locator("body").innerText().catch(() => "")).toLowerCase();
  return BODY_TEXT_PATTERN.test(bodyText.slice(0, 2000));
}
