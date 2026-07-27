import { useParams } from 'react-router-dom';
import { Layout } from '../components/Layout/Layout';
import { Breadcrumbs } from '../components/Layout/Breadcrumbs';
import { apps, getApp } from '../data/apps';
import { Badge } from '../components/ui/Badge';

export function AppList() {
  const { app: slug } = useParams();
  const app = slug ? getApp(slug) : apps[0];

  if (!app) {
    return (
      <Layout>
        <p className="prose-body">No apps have been extracted yet. Run the wiki generator to populate this page.</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <Breadcrumbs items={[{ title: 'App List', href: '/apps' }, { title: app.name }]} />
      <div className="mt-4 flex items-center gap-3">
        <span className="h-8 w-8 rounded-lg" style={{ backgroundColor: app.color }} />
        <h1 className="text-heading-lg font-bold text-white">{app.name}</h1>
      </div>
      <p className="mt-2 prose-body">{app.tagline}</p>
      <div className="mt-3 flex gap-1.5">
        {app.plans.map((p) => (
          <Badge key={p}>{p}</Badge>
        ))}
      </div>

      <p className="mt-6 prose-body">{app.overview}</p>

      {app.keyFeatures.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-content-muted">Key features</div>
          <ul className="list-disc list-inside space-y-1 prose-body">
            {app.keyFeatures.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {app.configuration.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-content-muted">Configuration</div>
          <ul className="list-disc list-inside space-y-1 prose-body">
            {app.configuration.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {app.storefrontBehavior && (
        <div className="mt-6">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-content-muted">Behavior</div>
          <p className="prose-body">{app.storefrontBehavior}</p>
        </div>
      )}
    </Layout>
  );
}
