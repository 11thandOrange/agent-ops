import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { sidebarSections, sectionKeyForPath } from '../../data/navigation';
import { cn } from '../../lib/cn';

// Full multi-section navigation tree. The header carries no tabs, so this is
// the primary navigator: every section is listed, each collapsible; the
// section for the current route auto-expands, and collapse state persists.
const STORAGE_KEY = 'wiki-sidebar-collapsed';

function loadCollapsed(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function Sidebar() {
  const location = useLocation();
  const activeKey = sectionKeyForPath(location.pathname);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed);

  const toggle = (key: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const isChildActive = (href: string) => location.pathname === href;

  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-surface-border bg-background">
      <nav className="flex-1 p-4 sticky top-16 self-start space-y-1">
        <Link
          to="/"
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-fast',
            location.pathname === '/' ? 'bg-brand-muted text-brand font-medium' : 'text-content-secondary hover:text-white hover:bg-surface-hover'
          )}
        >
          <Home size={15} />
          Overview
        </Link>

        {Object.entries(sidebarSections).map(([key, section]) => {
          const hasChildren = section.children.length > 0;
          // Expanded by default; the active section is always expanded.
          const isOpen = key === activeKey || !collapsed[key];
          return (
            <div key={key} className="pt-1">
              <div className="flex items-center">
                <Link
                  to={section.href}
                  className={cn(
                    'flex-1 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-fast',
                    key === activeKey ? 'text-white' : 'text-content-muted hover:text-white'
                  )}
                >
                  {section.title}
                </Link>
                {hasChildren && (
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    aria-label={isOpen ? 'Collapse' : 'Expand'}
                    className="p-1.5 text-content-muted hover:text-white transition-fast"
                  >
                    <ChevronRight size={14} className={cn('transition-fast', isOpen && 'rotate-90')} />
                  </button>
                )}
              </div>
              {hasChildren && isOpen && (
                <div className="mt-0.5 space-y-0.5">
                  {section.children.map((item) => (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={cn(
                        'block rounded-lg px-3 py-1.5 text-sm transition-fast',
                        isChildActive(item.href)
                          ? 'bg-brand-muted text-brand font-medium'
                          : 'text-content-secondary hover:text-white hover:bg-surface-hover'
                      )}
                    >
                      {item.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
