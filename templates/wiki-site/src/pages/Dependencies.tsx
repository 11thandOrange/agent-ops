import { Layout } from '../components/Layout/Layout';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Callout } from '../components/ui/Callout';
import { dependenciesByComponent } from '../data/dependencies';
import { integrations } from '../data/integrations';

export function Dependencies() {
  const byComponent = dependenciesByComponent();
  const components = Object.keys(byComponent).sort();

  return (
    <Layout>
      <h1 className="text-heading-lg font-bold text-white">Dependencies &amp; Integrations</h1>
      <p className="mt-2 prose-body">
        NPM packages are extracted from each component's <code className="font-mono text-xs">package.json</code>; external
        integrations (the GitHub App, LiteLLM, Cloud Run, external APIs) live in no manifest and are documented by hand.
      </p>

      {integrations.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-content-muted">External integrations</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {integrations.map((it) => (
              <Card key={it.slug} className="h-full">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-white">{it.name}</div>
                  <Badge>{it.kind}</Badge>
                </div>
                <p className="mt-2 text-sm text-content-secondary">{it.summary}</p>
                {it.auth && (
                  <p className="mt-2 text-xs text-content-muted">
                    <span className="font-medium text-content-secondary">Auth: </span>
                    {it.auth}
                  </p>
                )}
                {it.url && (
                  <a href={it.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-mono text-xs text-brand hover:underline">
                    {it.url}
                  </a>
                )}
                {it.notes.map((n, i) => (
                  <Callout key={i} kind={n.kind}>{n.body}</Callout>
                ))}
              </Card>
            ))}
          </div>
        </section>
      )}

      {components.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-content-muted">NPM packages</h2>
          {components.map((component) => (
            <div key={component} className="mt-4">
              <div className="mb-2 font-mono text-xs text-content-secondary">{component}</div>
              <div className="overflow-x-auto rounded-card border border-surface-border">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-surface-border text-xs uppercase tracking-wider text-content-muted">
                      <th className="px-4 py-2 font-medium">Package</th>
                      <th className="px-4 py-2 font-medium">Version</th>
                      <th className="px-4 py-2 font-medium">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byComponent[component]
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((d) => (
                        <tr key={d.slug} className="border-b border-surface-border/50 last:border-0">
                          <td className="px-4 py-2 font-mono text-content">{d.name}</td>
                          <td className="px-4 py-2 font-mono text-content-secondary">{d.version}</td>
                          <td className="px-4 py-2">
                            <Badge tone={d.kind === 'dependency' ? 'success' : 'default'}>
                              {d.kind === 'dependency' ? 'runtime' : 'dev'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>
      )}
    </Layout>
  );
}
