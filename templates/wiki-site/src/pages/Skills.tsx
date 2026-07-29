import { Link, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout/Layout';
import { Breadcrumbs } from '../components/Layout/Breadcrumbs';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { skills, getSkill } from '../data/skills';
import { wikiConfig } from '../wiki.config.generated';

function sourceUrl(path: string): string | null {
  return wikiConfig.githubUrl ? `${wikiConfig.githubUrl}/blob/main/${path}` : null;
}

export function Skills() {
  const { slug } = useParams();

  if (!slug) {
    const byCategory = skills.reduce<Record<string, typeof skills>>((acc, s) => {
      (acc[s.category] ??= []).push(s);
      return acc;
    }, {});
    return (
      <Layout>
        <h1 className="text-heading-lg font-bold text-white">Skills</h1>
        <p className="mt-2 prose-body">Reusable skills the pipelines match at runtime — the shared dev skills and the personal-pipeline skills.</p>
        {Object.entries(byCategory).map(([category, list]) => (
          <div key={category} className="mt-8">
            <div className="mb-3 font-mono text-xs uppercase tracking-wider text-content-muted">{category}</div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {list.map((s) => (
                <Link key={s.slug} to={`/skills/${s.slug}`}>
                  <Card className="h-full hover:border-surface-border-hover transition-fast">
                    <div className="text-sm font-semibold text-white">{s.title}</div>
                    <p className="mt-2 line-clamp-3 text-sm text-content-secondary">{s.description}</p>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </Layout>
    );
  }

  const skill = getSkill(slug);
  if (!skill) {
    return (
      <Layout>
        <p className="prose-body">Skill "{slug}" not found.</p>
      </Layout>
    );
  }
  const src = sourceUrl(skill.path);

  return (
    <Layout>
      <Breadcrumbs items={[{ title: 'Skills', href: '/skills' }, { title: skill.title }]} />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-heading-lg font-bold text-white">{skill.title}</h1>
        <Badge>{skill.category}</Badge>
        {skill.appliesTo && <Badge tone="success">applies_to: {skill.appliesTo}</Badge>}
      </div>
      <p className="mt-4 prose-body">{skill.description}</p>
      <div className="mt-6 text-xs text-content-muted">
        Source:{' '}
        {src ? (
          <a href={src} target="_blank" rel="noopener noreferrer" className="font-mono text-content-secondary hover:text-white transition-fast">
            {skill.path}
          </a>
        ) : (
          <span className="font-mono">{skill.path}</span>
        )}
      </div>
    </Layout>
  );
}
