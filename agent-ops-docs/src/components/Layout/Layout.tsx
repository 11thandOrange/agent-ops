import type { ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

/** Shared layout: header, sidebar, and a two-column main area (docs prose
 * left / optional sandbox right) - identical across every consuming repo's
 * wiki, per issue #286. `rightPanel` is the sandbox column; pages that
 * don't need it (e.g. plain markdown docs) omit it and get a single column. */
export function Layout({ children, rightPanel }: { children: ReactNode; rightPanel?: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-content">
      <Header />
      <div className="flex-1 flex pt-16">
        <div className="flex-1 flex max-w-container-lg w-full mx-auto">
          <Sidebar />
          <main className="flex-1 min-w-0">
            <div className="px-6 py-8 md:px-10 max-w-content">{children}</div>
          </main>
          {rightPanel && (
            <aside className="hidden lg:flex flex-col w-96 shrink-0 border-l border-surface-border bg-background-elevated/50">
              <div className="sticky top-16 overflow-y-auto max-h-[calc(100vh-64px)] p-6">{rightPanel}</div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
