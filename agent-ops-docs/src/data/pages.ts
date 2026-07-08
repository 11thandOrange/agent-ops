export interface CodeExample {
  language: string;
  label?: string;
  code: string;
}

export interface PageSection {
  type: 'heading' | 'paragraph' | 'code' | 'table' | 'callout' | 'list' | 'steps' | 'diagram';
  level?: number;
  content?: string;
  items?: string[];
  headers?: string[];
  rows?: string[][];
  variant?: 'info' | 'warning' | 'success' | 'danger';
  steps?: { title: string; content: string }[];
  caption?: string;
}

export interface PageContent {
  title: string;
  description: string;
  route: string;
  sections: PageSection[];
  codeExamples?: CodeExample[];
}

// Populated incrementally, one module per content task (see the per-section
// files under data/pages/) and merged here. Keeping pages.ts itself free of
// actual content keeps this file small and stable while each section's
// content task only ever touches its own file.
export const pages: Record<string, PageContent> = {};

export function registerPages(newPages: Record<string, PageContent>): void {
  Object.assign(pages, newPages);
}

const fallbackPage: PageContent = {
  title: 'Page not found',
  description: 'This page has not been written yet.',
  route: '/',
  sections: [
    {
      type: 'paragraph',
      content: 'Nothing is here yet — pick a page from the sidebar.',
    },
  ],
};

export function getPage(route: string): PageContent {
  return pages[route] ?? fallbackPage;
}
