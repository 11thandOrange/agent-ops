import { Layout } from '../components/Layout/Layout';
import { wikiConfig } from '../wiki.config.generated';
import { topNav } from '../data/navigation';
import { Card } from '../components/ui/Card';
import { Link } from 'react-router-dom';

export function Home() {
  return (
    <Layout>
      <h1 className="text-heading-lg font-bold text-white">{wikiConfig.title}</h1>
      {wikiConfig.description && <p className="mt-3 prose-body">{wikiConfig.description}</p>}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {topNav
          .filter((n) => n.href !== '/')
          .map((n) => (
            <Link key={n.href} to={n.href}>
              <Card className="hover:border-surface-border-hover transition-fast h-full">
                <div className="text-sm font-semibold text-white">{n.title}</div>
              </Card>
            </Link>
          ))}
      </div>
    </Layout>
  );
}
