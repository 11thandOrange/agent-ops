import { useParams } from 'react-router-dom';
import { Layout } from '../components/Layout/Layout';
import { Breadcrumbs } from '../components/Layout/Breadcrumbs';
import { workflows, getWorkflow } from '../data/workflows';

export function CiCd() {
  const { workflow: slug } = useParams();
  const workflow = slug ? getWorkflow(slug) : workflows[0];

  if (!workflow) {
    return (
      <Layout>
        <p className="prose-body">No GitHub Actions workflows have been extracted yet. Run the wiki generator to populate this page.</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <Breadcrumbs items={[{ title: 'CI/CD', href: '/ci-cd' }, { title: workflow.title }]} />
      <h1 className="mt-4 text-heading-lg font-bold text-white">{workflow.title}</h1>
      <code className="mt-1 block font-mono text-xs text-content-muted">{workflow.file}</code>
      <div className="mt-3 rounded-input border border-surface-border bg-white/[0.02] px-3 py-2 text-xs text-content-muted">
        <span className="font-medium text-content-secondary">Trigger: </span>
        {workflow.trigger}
      </div>
      <p className="mt-4 prose-body">{workflow.description}</p>

      <div className="mt-8 space-y-6">
        {workflow.jobs.map((job) => (
          <div key={job.name} className="rounded-card border border-surface-border bg-white/[0.02] p-5">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-white">{job.name}</h3>
              <span className="text-xs text-content-muted">{job.runsOn}</span>
            </div>
            <ol className="mt-3 space-y-2">
              {job.steps.map((step, i) => (
                <li key={i} className="text-sm">
                  <span className="text-content">{step.name}</span>
                  {step.detail && <span className="block text-xs text-content-muted">{step.detail}</span>}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </Layout>
  );
}
