import { useMemo, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useOwnerLayoutData } from '@/hooks/useOwnerLayoutData';
import ApperIcon from '@/components/ApperIcon';
import UserMenu from '@/components/UserMenu';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { cn } from '@/lib/utils';

export default function OwnerLayout() {
  const { navItems = [], navGroups = [], displayName = 'Student' } = useOwnerLayoutData();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const items = useMemo(() => {
    if (Array.isArray(navItems) && navItems.length) return navItems;
    if (Array.isArray(navGroups)) return navGroups.flatMap((group) => group.items || []);
    return [];
  }, [navItems, navGroups]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-accent/70">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ApperIcon name="GraduationCap" size={22} />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-mono text-sm font-bold tracking-tight">NORTHSTAR</span>
              <span className="block truncate text-[11px] text-muted-foreground">JEE + NEET preparation</span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground md:inline">Workspace · {displayName}</span>
            <UserMenu />
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card md:hidden"
              aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen((value) => !value)}
            >
              <ApperIcon name={mobileNavOpen ? 'X' : 'Menu'} size={18} />
            </button>
          </div>
        </div>

        <nav className={cn('mx-auto max-w-[1600px] px-4 pb-3 sm:px-6 lg:px-8', !mobileNavOpen && 'hidden md:block')}>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {items.map((item, index) => {
              const href = item.path || item.to || item.href;
              const label = item.label || item.name;
              if (!href || !label) return null;
              return (
                <NavLink
                  key={item.path || item.to || label || index}
                  to={href}
                  end={href === '/'}
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) => cn(
                    'inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-background hover:text-foreground'
                  )}
                >
                  {item.icon ? <ApperIcon name={item.icon} size={15} /> : null}
                  {label}
                </NavLink>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="mx-auto min-h-[calc(100vh-116px)] max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>

      <footer className="border-t border-border bg-card/70">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>Northstar · Evidence-led exam preparation</span>
          <span>Academic content is subject to source verification and expert review.</span>
        </div>
      </footer>
    </div>
  );
}
