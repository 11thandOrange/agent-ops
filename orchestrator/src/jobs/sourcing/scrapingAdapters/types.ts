// Common shape every scraping adapter implements. Takes an already-
// navigated page (context/session/goto already handled by scraping.ts) and
// returns the posting's extracted text — performing whatever additional
// navigation its own pattern needs (e.g. clicking through a wizard) before
// extracting, entirely internal to the adapter.
import type { Page } from "playwright";

export interface ScrapingAdapter {
  extract(page: Page): Promise<string>;
}
