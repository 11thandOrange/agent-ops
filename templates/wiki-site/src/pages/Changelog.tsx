import { Layout } from '../components/Layout/Layout';
import { changelog } from '../data/changelog';

const GROUPS: { key: 'added' | 'changed' | 'fixed'; label: string; tone: string }[] = [
  { key: 'added', label: 'Added', tone: 'text-status-success' },
  { key: 'changed', label: 'Changed', tone: 'text-brand' },
  { key: 'fixed', label: 'Fixed', tone: 'text-status-warning' },
];

export function Changelog() {
  return (
    <Layout>
      <h1 className="text-heading-lg font-bold text-white">Changelog</h1>
      <p className="mt-2 prose-body">Notable changes to agent-ops, newest first.</p>

      <div className="mt-8 space-y-8 border-l border-surface-border pl-6">
        {changelog.map((entry) => (
          <div key={entry.date} className="relative">
            <span className="absolute -left-[27px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand" />
            <div className="font-mono text-sm font-semibold text-white">{entry.date}</div>
            <div className="mt-2 space-y-2">
              {GROUPS.map(({ key, label, tone }) =>
                entry[key]?.length ? (
                  <div key={key}>
                    <div className={`text-xs font-semibold uppercase tracking-wider ${tone}`}>{label}</div>
                    <ul className="mt-1 list-disc space-y-1 pl-5 prose-body text-sm">
                      {entry[key].map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null
              )}
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
