import { cn } from '../../lib/cn';

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-status-success/10 text-status-success',
  POST: 'bg-brand-muted text-brand',
  PUT: 'bg-status-warning/10 text-status-warning',
  PATCH: 'bg-status-warning/10 text-status-warning',
  DELETE: 'bg-status-error/10 text-status-error',
};

export function MethodBadge({ method }: { method: string }) {
  return (
    <span className={cn('rounded-md px-2 py-0.5 font-mono text-xs font-semibold', METHOD_COLORS[method] ?? 'bg-surface text-content-secondary')}>
      {method}
    </span>
  );
}

export function Badge({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'success' | 'warning' | 'error' }) {
  const tones: Record<string, string> = {
    default: 'bg-surface text-content-secondary',
    success: 'bg-status-success/10 text-status-success',
    warning: 'bg-status-warning/10 text-status-warning',
    error: 'bg-status-error/10 text-status-error',
  };
  return <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone])}>{children}</span>;
}
