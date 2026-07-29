import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Layout } from '../components/Layout/Layout';
import { wikiConfig } from '../wiki.config.generated';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { features } from '../data/features';

// Optional authored overview prose (src/content/overview.md). Rendered under
// the title on the landing page; absent for repos that don't author one.
const overviewGlob = import.meta.glob('../content/overview.md', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
const overview = (overviewGlob['../content/overview.md'] ?? '').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');

export function Home() {
  return (
    <Layout>
      <h1 className="text-heading-lg font-bold text-white">{wikiConfig.title}</h1>
      {wikiConfig.description && <p className="mt-3 text-lg text-content-secondary">{wikiConfig.description}</p>}

      {overview && (
        <div className="markdown-body mt-6">
          <ReactMarkdown>{overview}</ReactMarkdown>
        </div>
      )}

      {features.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-content-muted">Features</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {features.map((f) => (
              <Link key={f.slug} to={`/features/${f.slug}`}>
                <Card className="h-full hover:border-surface-border-hover transition-fast">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-white">{f.title}</div>
                    <Badge tone={f.status === 'stable' ? 'success' : 'warning'}>{f.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-content-secondary">{f.summary}</p>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
}
