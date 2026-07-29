import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Layout } from '../components/Layout/Layout';
import { Breadcrumbs } from '../components/Layout/Breadcrumbs';
import { markdownPages, getPage } from '../data/pages';

// Vite eager-globs every ingested markdown file's raw text at build time,
// keyed by its path relative to this file - matches each MarkdownPageDoc's
// `contentFile` (a plain "<slug>.md" filename under src/content/) written
// by scripts/wiki-extractors/markdown.mjs. Ingestion is verbatim - this
// component only renders it, it never rewrites the text.
const contentModules = import.meta.glob('../content/*.md', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;

function contentFor(contentFile: string): string | undefined {
  return contentModules[`../content/${contentFile}`];
}

function slugSection(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Serves every markdown navSection under its own path (/roadmap, /contributing,
// ...): `:section/:page` renders a specific page; `:section` alone renders the
// first page in that section.
export function DocsPage() {
  const { section, page: slug } = useParams();
  let page = slug ? getPage(slug) : undefined;
  if (!page && section) page = markdownPages.find((p) => slugSection(p.navSection) === section);
  if (!page) page = markdownPages[0];

  if (!page) {
    return (
      <Layout>
        <p className="prose-body">No markdown docs have been ingested yet. Run the wiki generator to populate this page.</p>
      </Layout>
    );
  }

  const content = contentFor(page.contentFile) ?? `*(content file ${page.contentFile} not found - re-run the wiki generator)*`;

  return (
    <Layout>
      <Breadcrumbs items={[{ title: page.navSection, href: `/${slugSection(page.navSection)}` }, { title: page.title }]} />
      <div className="markdown-body mt-4">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
      <div className="mt-8 text-xs text-content-muted">Source: {page.sourcePath} (ingested verbatim, not rewritten).</div>
    </Layout>
  );
}
