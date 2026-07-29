import { useState } from 'react';
import { AlertTriangle, Play } from 'lucide-react';
import type { EndpointDoc } from '../../types';
import { CodeBlock } from '../ui/CodeBlock';
import { wikiConfig } from '../../wiki.config.generated';
import { cn } from '../../lib/cn';

interface SandboxProps {
  endpoint: EndpointDoc;
}

type Result = { status: number; body: string; mock?: boolean } | { error: string };
type CodeLang = 'curl' | 'fetch';
type AuthMode = 'none' | 'bearer' | 'header';

/**
 * "Try it" sandbox (issue #286). Unlike the old per-app docs sites, this
 * works for every endpoint, not just unauthenticated ones: the request is
 * never made directly from the browser to the target API (which is what
 * caused the old CORS dead-end) - it's always routed through this repo's
 * own wiki-backend instance (wikiConfig.proxyBaseUrl, same-origin or at
 * least CORS-allowed relative to this docs site), which forwards it
 * server-side to wikiConfig.targetApiBaseUrl (configured on the backend
 * itself, not sent by the client - see templates/wiki-backend). Auth is
 * supplied here, per request, by whoever is using the sandbox at QA time;
 * it is only ever kept in component state and is never written to
 * localStorage/cookies/a request log.
 */
export function Sandbox({ endpoint }: SandboxProps) {
  const [authMode, setAuthMode] = useState<AuthMode>(endpoint.auth === 'none' ? 'none' : 'bearer');
  const [authValue, setAuthValue] = useState('');
  const [customHeaderName, setCustomHeaderName] = useState('x-api-key');
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [codeLang, setCodeLang] = useState<CodeLang>('curl');

  const pathParams = endpoint.params.filter((p) => p.in === 'path');
  const queryParams = endpoint.params.filter((p) => p.in === 'query');
  const bodyParams = endpoint.params.filter((p) => p.in === 'body' && p.type !== 'file');

  const resolvedPath = () =>
    pathParams.reduce((p, param) => p.replace(`:${param.name}`, encodeURIComponent(paramValues[param.name] || `{${param.name}}`)), endpoint.path);

  const buildQueryString = () => {
    const qs = queryParams
      .filter((p) => paramValues[p.name])
      .map((p) => `${p.name}=${encodeURIComponent(paramValues[p.name])}`)
      .join('&');
    return qs ? `?${qs}` : '';
  };

  const bodyJson = () => {
    const body: Record<string, string> = {};
    for (const p of bodyParams) body[p.name] = paramValues[p.name] || `{${p.name}}`;
    return body;
  };

  const authHeaders = (): Record<string, string> => {
    if (authMode === 'bearer' && authValue) return { Authorization: `Bearer ${authValue}` };
    if (authMode === 'header' && authValue && customHeaderName) return { [customHeaderName]: authValue };
    return {};
  };

  const displayUrl = () => `${wikiConfig.targetApiBaseUrl || '{targetApiBaseUrl}'}${resolvedPath()}${buildQueryString()}`;

  const curlSnippet = () => {
    const headers = { 'Content-Type': 'application/json', ...authHeaders() };
    const headerFlags = Object.entries(headers)
      .map(([k, v]) => `  -H "${k}: ${v}"`)
      .join(' \\\n');
    if (endpoint.method === 'GET') return `curl "${displayUrl()}" \\\n${headerFlags}`;
    return `curl -X ${endpoint.method} "${displayUrl()}" \\\n${headerFlags} \\\n  -d '${JSON.stringify(bodyJson())}'`;
  };

  const fetchSnippet = () => {
    const headers = { 'Content-Type': 'application/json', ...authHeaders() };
    if (endpoint.method === 'GET') {
      return `fetch("${displayUrl()}", { headers: ${JSON.stringify(headers)} })\n  .then((res) => res.json())\n  .then(console.log);`;
    }
    return `fetch("${displayUrl()}", {\n  method: "${endpoint.method}",\n  headers: ${JSON.stringify(headers)},\n  body: JSON.stringify(${JSON.stringify(bodyJson())}),\n})\n  .then((res) => res.json())\n  .then(console.log);`;
  };

  const send = async () => {
    // Widen to string before the emptiness guard: wiki.config.generated.ts
    // is emitted `as const`, so when backend.proxyBaseUrl is unset it has
    // the literal type "" and the guard below would narrow it to `never`,
    // breaking the .replace() call for any repo that doesn't configure a
    // backend proxy (e.g. agent-ops's own docs site).
    const proxyBaseUrl: string = wikiConfig.proxyBaseUrl;
    if (!proxyBaseUrl) {
      setResult({ error: 'No backend proxy configured (wikiConfig.proxyBaseUrl is empty) - set backend.proxyBaseUrl in wiki.config.yaml.' });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${proxyBaseUrl.replace(/\/$/, '')}/api/proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: endpoint.method,
          path: `${resolvedPath()}${buildQueryString()}`,
          headers: authHeaders(),
          body: endpoint.method === 'GET' ? undefined : bodyJson(),
        }),
      });
      const data = await res.json();
      if (!res.ok && data?.error) {
        setResult({ error: data.error });
      } else {
        setResult({ status: data.status, body: typeof data.body === 'string' ? data.body : JSON.stringify(data.body, null, 2) });
      }
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 rounded-input border border-status-warning/30 bg-status-warning/5 p-3 text-xs text-content-secondary">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-status-warning" />
        <span>
          Requests are proxied server-side through this wiki's own backend - never sent directly from your browser. Use a
          development/test credential, not a production one. {endpoint.authNote}
        </span>
      </div>

      {endpoint.auth !== 'none' && (
        <div>
          <label className="mb-1 block text-xs font-medium text-content-secondary">Auth</label>
          <div className="mb-2 flex gap-1.5">
            {(['bearer', 'header'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setAuthMode(mode)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-fast',
                  authMode === mode ? 'bg-surface-active text-white' : 'text-content-muted hover:text-content-secondary'
                )}
              >
                {mode === 'bearer' ? 'Bearer token' : 'Custom header'}
              </button>
            ))}
          </div>
          {authMode === 'header' && (
            <input
              value={customHeaderName}
              onChange={(e) => setCustomHeaderName(e.target.value)}
              placeholder="Header name, e.g. x-api-key"
              className="mb-2 w-full rounded-input border border-surface-border bg-background px-3 py-2 text-sm text-white placeholder:text-content-muted focus:border-brand focus:outline-none"
            />
          )}
          <input
            value={authValue}
            onChange={(e) => setAuthValue(e.target.value)}
            type="password"
            placeholder={authMode === 'bearer' ? 'Bearer token (never stored)' : 'Header value (never stored)'}
            className="w-full rounded-input border border-surface-border bg-background px-3 py-2 text-sm text-white placeholder:text-content-muted focus:border-brand focus:outline-none"
          />
        </div>
      )}

      {[...pathParams, ...queryParams, ...bodyParams].map((p) => (
        <div key={`${p.in}-${p.name}`}>
          <label className="mb-1 block text-xs font-medium text-content-secondary">
            {p.name} <span className="text-content-muted">({p.in})</span>
            {p.required && <span className="text-status-error"> *</span>}
          </label>
          <input
            value={paramValues[p.name] ?? ''}
            onChange={(e) => setParamValues((prev) => ({ ...prev, [p.name]: e.target.value }))}
            placeholder={p.description || p.name}
            className="w-full rounded-input border border-surface-border bg-background px-3 py-2 text-sm text-white placeholder:text-content-muted focus:border-brand focus:outline-none"
          />
        </div>
      ))}

      <button
        onClick={send}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-button bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-fast hover:bg-brand-hover disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Play size={14} />
        {loading ? 'Sending...' : 'Try it'}
      </button>

      {result && (
        <div>
          {'error' in result ? (
            <div className="rounded-input border border-status-error/30 bg-status-error/5 p-3 text-xs text-status-error">{result.error}</div>
          ) : (
            <>
              <div className="mb-1.5 text-xs font-medium text-content-secondary">
                Response · <span className={result.status < 400 ? 'text-status-success' : 'text-status-error'}>{result.status}</span>
              </div>
              <CodeBlock code={result.body} language="json" />
            </>
          )}
        </div>
      )}

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-content-muted">Code examples (direct call, for reference)</div>
        <div className="mb-2 flex gap-1.5">
          {(['curl', 'fetch'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => setCodeLang(lang)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-fast',
                codeLang === lang ? 'bg-surface-active text-white' : 'text-content-muted hover:text-content-secondary'
              )}
            >
              {lang === 'curl' ? 'cURL' : 'fetch'}
            </button>
          ))}
        </div>
        <CodeBlock code={codeLang === 'curl' ? curlSnippet() : fetchSnippet()} language={codeLang === 'curl' ? 'bash' : 'javascript'} />
      </div>
    </div>
  );
}
