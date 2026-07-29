import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Layout } from '../components/Layout/Layout';
import { Breadcrumbs } from '../components/Layout/Breadcrumbs';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Callout } from '../components/ui/Callout';
import { features, getFeature } from '../data/features';
import type { FeatureImplements } from '../types';

const bodies = import.meta.glob('../content/features/*.md', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;

function bodyFor(contentFile: string): string {
  const raw = bodies[`../content/${contentFile}`] ?? '';
  return raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, ''); // strip frontmatter
}

const LINKS: Record<keyof FeatureImplements, (slug: string) => string> = {
  workflows: (s) => `/ci-cd/${s}`,
  skills: (s) => `/skills/${s}`,
  dependencies: () => `/dependencies`,
  integrations: () => `/dependencies`,
};
const LABELS: Record<keyof FeatureImplements, string> = {
  workflows: 'Workflows',
  skills: 'Skills',
  dependencies: 'Packages',
  integrations: 'Integrations',
};

function Implements({ impl }: { impl: FeatureImplements }) {
  const groups = (Object.keys(LABELS) as (keyof FeatureImplements)[]).filter((k) => impl[k]?.length);
  if (!groups.length) return null;
  return (
    <div className="mt-8 rounded-card border border-surface-border bg-white/[0.02] p-5">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-content-muted">Implemented by / depends on</div>
      <div className="space-y-3">
        {groups.map((k) => (
          <div key={k} className="flex flex-wrap items-center gap-2">
            <span className="w-28 shrink-0 text-xs text-content-muted">{LABELS[k]}</span>
            {impl[k].map((slug) => (
              <Link key={slug} to={LINKS[k](slug)} className="rounded-full bg-surface px-2.5 py-1 font-mono text-xs text-content-secondary hover:text-white hover:bg-surface-hover transition-fast">
                {slug}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Features() {
  const { slug } = useParams();

  if (!slug) {
    return (
      <Layout>
        <h1 className="text-heading-lg font-bold text-white">Features</h1>
        <p className="mt-2 prose-body">Everything agent-ops does, one page each — what it is, how it works, how to run it, and the tradeoffs behind it.</p>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
      </Layout>
    );
  }

  const feature = getFeature(slug);
  if (!feature) {
    return (
      <Layout>
        <p className="prose-body">Feature "{slug}" not found.</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <Breadcrumbs items={[{ title: 'Features', href: '/features' }, { title: feature.title }]} />
      <div className="mt-4 flex items-center gap-3">
        <h1 className="text-heading-lg font-bold text-white">{feature.title}</h1>
        <Badge tone={feature.status === 'stable' ? 'success' : 'warning'}>{feature.status}</Badge>
      </div>
      <p className="mt-2 text-lg text-content-secondary">{feature.summary}</p>

      {feature.notes.map((n, i) => (
        <Callout key={i} kind={n.kind}>{n.body}</Callout>
      ))}

      <div className="markdown-body mt-6">
        <ReactMarkdown>{bodyFor(feature.contentFile)}</ReactMarkdown>
      </div>

      {feature.runWith.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-content-muted">How to run it</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 prose-body">
            {feature.runWith.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      {feature.tradeoffs.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-content-muted">Tradeoffs &amp; decisions</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 prose-body">
            {feature.tradeoffs.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </div>
      )}

      <Implements impl={feature.implements} />
    </Layout>
  );
}
