import { Link } from 'react-router-dom';
import { wikiConfig } from '../../wiki.config.generated';

// Minimal header: the site title (which IS the home link) and a GitHub link.
// All section navigation lives in the sidebar - no top-nav tabs.
export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-surface-border bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-container-lg items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-1.5 text-xl font-bold shrink-0 truncate">
          <span className="text-brand">{wikiConfig.title}</span>
        </Link>
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
