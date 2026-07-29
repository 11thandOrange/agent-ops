import { Link } from 'react-router-dom';

export function Breadcrumbs({ items }: { items: { title: string; href?: string }[] }) {
  return (
    <nav className="flex items-center gap-2 text-sm text-content-muted">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-2">
          {item.href ? (
            <Link to={item.href} className="hover:text-white transition-fast">
              {item.title}
            </Link>
          ) : (
            <span className="text-content-secondary">{item.title}</span>
          )}
          {i < items.length - 1 && <span>/</span>}
        </span>
      ))}
    </nav>
  );
}
