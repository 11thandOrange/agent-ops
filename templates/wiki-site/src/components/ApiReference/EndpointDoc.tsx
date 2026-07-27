import type { EndpointDoc as EndpointDocType } from '../../types';
import { MethodBadge, Badge } from '../ui/Badge';
import { CodeBlock } from '../ui/CodeBlock';

export function EndpointDoc({ endpoint }: { endpoint: EndpointDocType }) {
  return (
    <div id={endpoint.slug} className="scroll-mt-24 border-b border-surface-border py-10 first:pt-0 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <MethodBadge method={endpoint.method} />
        <code className="font-mono text-sm text-content-secondary">{endpoint.path}</code>
        {endpoint.liveTestable && <Badge tone="success">Sandbox-testable</Badge>}
      </div>
      <h3 className="mt-3 text-heading-sm font-semibold text-white">{endpoint.title}</h3>
      <p className="mt-2 prose-body">{endpoint.description}</p>

      <div className="mt-4 rounded-input border border-surface-border bg-white/[0.02] px-3 py-2 text-xs text-content-muted">
        <span className="font-medium text-content-secondary">Auth: </span>
        {endpoint.authNote}
      </div>

      {endpoint.params.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-content-muted">Parameters</div>
          <div className="overflow-hidden rounded-input border border-surface-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border bg-white/[0.02] text-left text-xs text-content-muted">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">In</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {endpoint.params.map((p) => (
                  <tr key={p.name} className="border-b border-surface-border last:border-b-0">
                    <td className="px-3 py-2 font-mono text-content">
                      {p.name}
                      {p.required && <span className="text-status-error"> *</span>}
                    </td>
                    <td className="px-3 py-2 text-content-muted">{p.in}</td>
                    <td className="px-3 py-2 text-content-muted font-mono">{p.type}</td>
                    <td className="px-3 py-2 text-content-secondary">{p.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {endpoint.requestExample && (
        <div className="mt-6">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-content-muted">Request body</div>
          <CodeBlock code={endpoint.requestExample} language="json" />
        </div>
      )}

      <div className="mt-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-content-muted">Example response</div>
        <CodeBlock code={endpoint.responseExample} language="json" />
      </div>
    </div>
  );
}
