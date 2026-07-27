import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-card border border-surface-border bg-white/[0.02] p-5', className)}>{children}</div>;
}
