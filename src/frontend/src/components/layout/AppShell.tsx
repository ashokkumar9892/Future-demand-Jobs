import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Award,
  BookOpen,
  Bookmark,
  Briefcase,
  Calendar,
  ChevronRight,
  ClipboardList,
  Code2,
  FileText,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  MessagesSquare,
  Moon,
  Network,
  NotebookPen,
  PlayCircle,
  Route,
  Search,
  Settings,
  Shield,
  Sun,
  Target,
  X,
} from 'lucide-react';
import { useAuth, useTheme } from '@/app/providers';
import { api } from '@/lib/api';
import { cn, initials } from '@/lib/format';
import type { SearchResponse } from '@/types/api';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  adminOnly?: boolean;
}

const NAV_GROUPS: { heading: string; items: NavItem[] }[] = [
  {
    heading: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
      { to: '/careers', label: 'Career Paths', icon: <Briefcase size={16} /> },
      { to: '/roadmap', label: 'My Roadmap', icon: <Route size={16} /> },
    ],
  },
  {
    heading: 'Learn',
    items: [
      { to: '/courses', label: 'Courses', icon: <BookOpen size={16} /> },
      { to: '/videos', label: 'Videos', icon: <PlayCircle size={16} /> },
      { to: '/skills', label: 'Skill Matrix', icon: <Target size={16} /> },
    ],
  },
  {
    heading: 'Practise',
    items: [
      { to: '/practice', label: 'Practice', icon: <ClipboardList size={16} /> },
      { to: '/coding-labs', label: 'Coding Labs', icon: <Code2 size={16} /> },
      { to: '/architecture-lab', label: 'Architecture Lab', icon: <Network size={16} /> },
      { to: '/projects', label: 'Projects', icon: <GraduationCap size={16} /> },
    ],
  },
  {
    heading: 'Get hired',
    items: [
      { to: '/certifications', label: 'Certifications', icon: <Award size={16} /> },
      { to: '/interview-prep', label: 'Interview Prep', icon: <MessagesSquare size={16} /> },
      { to: '/mock-interview', label: 'Mock Interview', icon: <MessagesSquare size={16} /> },
      { to: '/job-readiness', label: 'Job Readiness', icon: <Gauge size={16} /> },
      { to: '/resume', label: 'Resume Builder', icon: <FileText size={16} /> },
    ],
  },
  {
    heading: 'Personal',
    items: [
      { to: '/calendar', label: 'Calendar', icon: <Calendar size={16} /> },
      { to: '/bookmarks', label: 'Bookmarks', icon: <Bookmark size={16} /> },
      { to: '/notes', label: 'Notes', icon: <NotebookPen size={16} /> },
      { to: '/settings', label: 'Settings', icon: <Settings size={16} /> },
      { to: '/admin', label: 'Admin', icon: <Shield size={16} />, adminOnly: true },
    ],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  return (
    <div className="flex min-h-full bg-surface-base">
      {mobileOpen && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col border-r border-line bg-surface-raised transition-transform lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-line px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500">
            <Route size={17} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold tracking-tight text-ink">
              FutureTech Academy
            </p>
            <p className="truncate text-[10px] uppercase tracking-[0.1em] text-ink-faint">
              Career platform
            </p>
          </div>
          <button
            className="ml-auto text-ink-faint lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter((i) => !i.adminOnly || user?.role === 'Admin');
            if (items.length === 0) return null;

            return (
              <div key={group.heading}>
                <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                  {group.heading}
                </p>
                <div className="space-y-0.5">
                  {items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition',
                          isActive
                            ? 'bg-brand-600/15 text-ink'
                            : 'text-ink-muted hover:bg-surface-overlay hover:text-ink',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span className={isActive ? 'text-brand-400' : 'text-ink-faint'}>
                            {item.icon}
                          </span>
                          <span className="truncate">{item.label}</span>
                          {isActive && <ChevronRight size={14} className="ml-auto text-brand-400" />}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-line p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600/20 text-[11px] font-semibold text-brand-300">
              {initials(user?.displayName ?? 'FT')}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-ink">{user?.displayName}</p>
              <p className="truncate text-[10px] text-ink-faint">{user?.targetCareerTitle ?? user?.email}</p>
            </div>
            <button
              onClick={toggle}
              className="rounded-md p-1.5 text-ink-faint transition hover:bg-surface-overlay hover:text-ink"
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button
              onClick={logout}
              className="rounded-md p-1.5 text-ink-faint transition hover:bg-surface-overlay hover:text-rose-300"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-[264px]">
        <Topbar onOpenNav={() => setMobileOpen(true)} />
        <main className="flex-1 animate-fade-up px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

function Topbar({ onOpenNav }: { onOpenNav: () => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ['search', query],
    queryFn: () => api.get<SearchResponse>(`/search?q=${encodeURIComponent(query)}&limit=5`),
    enabled: query.trim().length >= 2,
  });

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Ctrl/Cmd+K focuses search, the shortcut people already expect.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.getElementById('global-search')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = (link?: string) => {
    if (!link) return;
    setOpen(false);
    setQuery('');
    navigate(link);
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-surface-base/85 px-4 backdrop-blur sm:px-6 lg:px-8">
      <button
        className="rounded-md p-2 text-ink-muted transition hover:bg-surface-overlay lg:hidden"
        onClick={onOpenNav}
        aria-label="Open navigation"
      >
        <Menu size={18} />
      </button>

      <div ref={containerRef} className="relative w-full max-w-lg">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
        />
        <input
          id="global-search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search courses, lessons, practice, projects…"
          className="h-9 w-full rounded-lg border border-line bg-surface-raised pl-9 pr-16 text-sm text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-ink-faint sm:block">
          ⌘K
        </kbd>

        {open && query.trim().length >= 2 && (
          <div className="absolute left-0 right-0 top-11 z-30 overflow-hidden rounded-xl border border-line bg-surface-overlay shadow-lift">
            {data && data.results.length > 0 ? (
              <>
                <ul className="max-h-80 overflow-y-auto py-1">
                  {data.results.slice(0, 8).map((result) => (
                    <li key={`${result.type}-${result.id}`}>
                      <button
                        onClick={() => go(result.deepLink)}
                        className="flex w-full items-start gap-3 px-3 py-2 text-left transition hover:bg-surface-sunken"
                      >
                        <span className="mt-0.5 shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-faint">
                          {result.type}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] text-ink">{result.title}</span>
                          {result.subtitle && (
                            <span className="block truncate text-[11px] text-ink-faint">
                              {result.subtitle}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-line px-3 py-1.5 text-[11px] text-ink-faint">
                  {data.total} result{data.total === 1 ? '' : 's'}
                </div>
              </>
            ) : (
              <p className="px-3 py-4 text-[13px] text-ink-faint">
                {data ? 'Nothing matched that search.' : 'Searching…'}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="ml-auto hidden items-center gap-2 sm:flex">
        <Link
          to="/practice"
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-surface-overlay hover:text-ink"
        >
          Practice
        </Link>
        <Link
          to="/job-readiness"
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-surface-overlay hover:text-ink"
        >
          Readiness
        </Link>
      </div>
    </header>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: { label: string; to?: string }[];
}) {
  return (
    <div className="mb-6">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-faint">
          {breadcrumb.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 && <ChevronRight size={11} />}
              {crumb.to ? (
                <Link to={crumb.to} className="transition hover:text-ink">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-ink-muted">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
          {description && (
            <div className="mt-1 max-w-3xl text-sm text-ink-muted">{description}</div>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
