import { useParams } from 'react-router-dom';
import { Layout } from '../components/Layout/Layout';
import { Breadcrumbs } from '../components/Layout/Breadcrumbs';
import { automation, getAutomation } from '../data/automation';
import { CodeBlock } from '../components/ui/CodeBlock';

export function Automation() {
  const { pipeline: slug } = useParams();
  const pipeline = slug ? getAutomation(slug) : automation[0];

  if (!pipeline) {
    return (
      <Layout>
        <p className="prose-body">No automation pipelines have been extracted yet. Run the wiki generator to populate this page.</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <Breadcrumbs items={[{ title: 'Automation', href: '/automation' }, { title: pipeline.name }]} />
      <h1 className="mt-4 text-heading-lg font-bold text-white">{pipeline.name}</h1>
      <p className="mt-2 prose-body">{pipeline.description}</p>

      <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-content-muted">Handler</div>
          <div className="mt-1 font-mono text-content">{pipeline.handler}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-content-muted">Execution</div>
          <div className="mt-1 font-mono text-content">
            {pipeline.executionKind}
            {pipeline.workflow ? ` (${pipeline.workflow})` : ''}
          </div>
        </div>
      </div>

      {pipeline.triggers.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-content-muted">Triggers</div>
          <ul className="list-disc list-inside space-y-1 prose-body">
            {pipeline.triggers.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-content-muted">Params</div>
        <CodeBlock code={JSON.stringify(pipeline.params, null, 2)} language="json" />
      </div>
    </Layout>
  );
}
