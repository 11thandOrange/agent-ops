import { Link, useLocation } from 'react-router-dom';
import { topNav } from '../../data/navigation';
import { wikiConfig } from '../../wiki.config.generated';
import { cn } from '../../lib/cn';

export function Header() {
  const location = useLocation();

  const isActive = (href: string) => {
    const section = href.split('/').filter(Boolean)[0];
    return location.pathname.split('/').filter(Boolean)[0] === section;
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-surface-border bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-container-lg items-center justify-between px-6">
        <div className="flex items-center gap-8 min-w-0">
          <Link to="/" className="flex items-center gap-1.5 text-xl font-bold shrink-0 truncate">
            <span className="text-brand">{wikiConfig.title}</span>
          </Link>
          <nav className="hidden lg:flex items-center gap-6 text-sm overflow-x-auto">
            {topNav.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'whitespace-nowrap transition-fast',
                  isActive(item.href) ? 'text-white font-medium' : 'text-content-secondary hover:text-white'
                )}
              >
                {item.title}
              </Link>
            ))}
          </nav>
        </div>
        {wikiConfig.githubUrl && (
          <a
            href={wikiConfig.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-button border border-surface-border bg-surface px-3 py-1.5 text-sm text-content-secondary hover:text-white hover:border-surface-border-hover transition-fast"
          >
            GitHub
          </a>
        )}
      </div>
    </header>
  );
}
