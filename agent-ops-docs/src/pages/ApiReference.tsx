import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { Layout } from '../components/Layout/Layout';
import { Breadcrumbs } from '../components/Layout/Breadcrumbs';
import { endpointGroups, getGroup } from '../data/endpoints';
import { EndpointDoc } from '../components/ApiReference/EndpointDoc';
import { Sandbox } from '../components/ApiReference/Sandbox';
import { MethodBadge } from '../components/ui/Badge';
import { cn } from '../lib/cn';

function scrollToEndpoint(slug: string) {
  document.getElementById(slug)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function ApiReference() {
  const { group: slug = endpointGroups[0]?.slug } = useParams();
  const group = getGroup(slug ?? '') ?? endpointGroups[0];
  const endpoints = group?.endpoints ?? [];
  const [activeSlug, setActiveSlug] = useState(endpoints[0]?.slug);
  const activeEndpoint = endpoints.find((e) => e.slug === activeSlug) ?? endpoints[0];

  if (!group) {
    return (
      <Layout>
        <p className="prose-body">No API endpoints have been extracted yet. Run the wiki generator to populate this page.</p>
      </Layout>
    );
  }

  const rightPanel =
    endpoints.length > 0 && activeEndpoint ? (
      <div>
        <div className="mb-4 text-sm font-semibold text-white">Try it out</div>
        {endpoints.length > 1 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {endpoints.map((e) => (
              <button
                key={e.slug}
                onClick={() => setActiveSlug(e.slug)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-medium transition-fast',
                  activeEndpoint.slug === e.slug ? 'bg-brand text-white' : 'bg-surface text-content-secondary hover:text-white'
                )}
              >
                {e.title}
              </button>
            ))}
          </div>
        )}
        <Sandbox key={activeEndpoint.slug} endpoint={activeEndpoint} />
      </div>
    ) : undefined;

  return (
    <Layout rightPanel={rightPanel}>
      <Breadcrumbs items={[{ title: 'API Reference', href: '/api' }, { title: group.title }]} />
      <h1 className="mt-4 text-heading-lg font-bold text-white">{group.title}</h1>
      <p className="mt-2 prose-body">{group.description}</p>

      {endpoints.length > 1 && (
        <div className="mt-6 rounded-card border border-surface-border bg-white/[0.02] p-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-content-muted">On this page</div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {endpoints.map((e) => (
              <button key={e.slug} onClick={() => scrollToEndpoint(e.slug)} className="flex items-center gap-2 text-left text-sm text-content-secondary hover:text-white transition-fast">
                <MethodBadge method={e.method} />
                {e.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        {endpoints.map((endpoint) => (
          <EndpointDoc key={endpoint.slug} endpoint={endpoint} />
        ))}
      </div>
    </Layout>
  );
}
