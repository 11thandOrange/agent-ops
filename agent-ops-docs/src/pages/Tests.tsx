import { Layout } from '../components/Layout/Layout';
import { testSuites } from '../data/tests';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

export function Tests() {
  return (
    <Layout>
      <h1 className="text-heading-lg font-bold text-white">Test Coverage</h1>
      <p className="mt-2 prose-body">Suite-level test coverage, extracted from this repo's test directories.</p>

      <div className="mt-6 space-y-4">
        {testSuites.length === 0 && <p className="prose-body">No test suites have been extracted yet. Run the wiki generator to populate this page.</p>}
        {testSuites.map((suite) => (
          <Card key={suite.slug}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">{suite.name}</h3>
              <Badge>{suite.framework}</Badge>
            </div>
            <p className="mt-2 prose-body text-sm">{suite.description}</p>
            <code className="mt-2 block font-mono text-xs text-content-muted">{suite.path}</code>
          </Card>
        ))}
      </div>
    </Layout>
  );
}
