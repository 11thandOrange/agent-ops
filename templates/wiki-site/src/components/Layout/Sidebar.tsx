import { Link, useLocation } from 'react-router-dom';
import { sidebarSections, sectionKeyForPath } from '../../data/navigation';
import { cn } from '../../lib/cn';

export function Sidebar() {
  const location = useLocation();
  const sectionKey = sectionKeyForPath(location.pathname);
  const section = sidebarSections[sectionKey];

  if (!section) return null;

  const isActive = (href: string) => location.pathname === href;

  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-surface-border bg-background">
      <nav className="flex-1 p-4 sticky top-16 self-start">
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-content-muted">{section.title}</div>
        <div className="mt-1 space-y-0.5">
          {section.children.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'block rounded-lg px-3 py-2 text-sm transition-fast',
                isActive(item.href) ? 'bg-brand-muted text-brand font-medium' : 'text-content-secondary hover:text-white hover:bg-surface-hover'
              )}
            >
              {item.title}
            </Link>
          ))}
        </div>
      </nav>
    </aside>
  );
}
