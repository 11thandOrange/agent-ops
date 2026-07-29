import type { ReactNode } from 'react';
import { Lightbulb, Info, AlertTriangle, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/cn';

// GitHub-style admonition blurb, used throughout the site to surface the
// authored notes/tradeoffs/gotchas an extractor could never derive.
const STYLES = {
  tip: { icon: Lightbulb, label: 'Tip', bar: 'border-status-success', text: 'text-status-success', bg: 'bg-status-success/[0.06]' },
  note: { icon: Info, label: 'Note', bar: 'border-brand', text: 'text-brand', bg: 'bg-brand-muted' },
  important: { icon: AlertCircle, label: 'Important', bar: 'border-brand', text: 'text-brand', bg: 'bg-brand-muted' },
  warning: { icon: AlertTriangle, label: 'Warning', bar: 'border-status-warning', text: 'text-status-warning', bg: 'bg-status-warning/[0.06]' },
} as const;

export type CalloutKind = keyof typeof STYLES;

export function Callout({ kind = 'note', title, children }: { kind?: CalloutKind; title?: string; children: ReactNode }) {
  const s = STYLES[kind] ?? STYLES.note;
  const Icon = s.icon;
  return (
    <div className={cn('my-4 rounded-r-card border-l-4 px-4 py-3', s.bar, s.bg)}>
      <div className={cn('mb-1 flex items-center gap-2 text-sm font-semibold', s.text)}>
        <Icon size={16} />
        {title ?? s.label}
      </div>
      <div className="prose-body text-sm leading-relaxed">{children}</div>
    </div>
  );
}
