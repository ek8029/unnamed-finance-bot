'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  TrendingUp,
  FileText,
  Settings,
  LogOut,
  Loader2,
  ChevronDown,
  Zap,
  MessageSquare,
  BarChart3,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { HelmMark } from '@/components/helm-mark';
import { useSettings } from '@/contexts/settings-context';
import { LegalFooter } from '@/components/legal-footer';
import { useTier } from '@/hooks/use-tier';

const navigation = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  {
    name: 'Portfolio',
    href: '/dashboard/portfolio',
    icon: TrendingUp,
    children: [
      { name: 'Research', href: '/dashboard/chat', icon: MessageSquare },
      { name: 'Earnings', href: '/dashboard/earnings', icon: BarChart3, pro: true },
    ],
  },
  { name: 'Actions', href: '/dashboard/actions', icon: Zap },
  { name: 'Transactions', href: '/dashboard/transactions', icon: ArrowLeftRight },
  { name: 'Taxes', href: '/dashboard/taxes', icon: FileText, pro: true },
  { name: 'Wrapped', href: '/dashboard/wrapped', icon: Sparkles, pro: true },
];

const PORTFOLIO_HREFS = ['/dashboard/portfolio', '/dashboard/chat', '/dashboard/earnings'];

/* Map pathnames to page titles for the top bar */
const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Overview',
  '/dashboard/portfolio': 'Portfolio',
  '/dashboard/chat': 'Research',
  '/dashboard/earnings': 'Earnings',
  '/dashboard/actions': 'Actions',
  '/dashboard/transactions': 'Transactions',
  '/dashboard/taxes': 'Taxes',
  '/dashboard/wrapped': 'Wrapped',
  '/dashboard/accounts': 'Connected Accounts',
  '/dashboard/settings': 'Settings',
};

interface UserProfile {
  fullName: string;
  email: string;
  initials: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { settings } = useSettings();
  const { isPro } = useTier();
  const reduceMotion = settings.accessibility.reduceMotion;
  const [loggingOut, setLoggingOut] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [portfolioDropdownOpen, setPortfolioDropdownOpen] = useState(() =>
    PORTFOLIO_HREFS.includes(typeof window !== 'undefined' ? window.location.pathname : '')
  );
  const menuRef = useRef<HTMLDivElement>(null);

  // Auto-expand portfolio section when navigating to a child route
  useEffect(() => {
    if (PORTFOLIO_HREFS.includes(pathname)) {
      setPortfolioDropdownOpen(true);
    }
  }, [pathname]);

  // Close user menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch user profile on mount + re-fetch when profile is updated
  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch('/api/user/profile');
        if (res.ok) {
          const data = await res.json();
          const fullName = data.profile?.full_name || data.profile?.email?.split('@')[0] || 'User';
          const nameParts = fullName.split(' ');
          const initials = nameParts.length >= 2
            ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
            : fullName.slice(0, 2).toUpperCase();

          setProfile({
            fullName,
            email: data.profile?.email || '',
            initials,
          });
        }
      } catch (error) {
        console.error('Failed to fetch profile:', error);
      }
    }
    fetchProfile();

    // Re-fetch when settings page updates the profile
    const handleProfileUpdate = () => fetchProfile();
    window.addEventListener('helm:profile-updated', handleProfileUpdate);
    return () => window.removeEventListener('helm:profile-updated', handleProfileUpdate);
  }, []);

  // Handle logout
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        router.push('/login');
        router.refresh();
      }
    } catch (error) {
      console.error('Logout failed:', error);
      setLoggingOut(false);
    }
  };

  const isChatPage = pathname === '/dashboard/chat';
  const pageTitle = PAGE_TITLES[pathname] || 'Dashboard';

  return (
    <div className={cn(
      "bg-[var(--color-bg-base)] flex max-w-[100vw] overflow-x-hidden",
      isChatPage ? "h-screen overflow-hidden" : "min-h-screen"
    )}>

      {/* ═══════════════════════════════════════════════
          FIXED SIDEBAR
          ═══════════════════════════════════════════════ */}
      <aside className="fixed inset-y-0 left-0 z-40 w-64 flex flex-col bg-[var(--color-bg-surface)] border-r border-[var(--color-border-base)]">

        {/* ── Logo ── */}
        <div className="shrink-0 px-5 py-5">
          <Link href="/" className="flex items-center gap-2.5 group">
            <HelmMark size={28} />
            <span className="text-[15px] font-semibold tracking-tight text-[var(--color-text-primary)]">
              Helm
            </span>
          </Link>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-4">
          <div className="mb-3 px-3">
            <span className="tracking-widest uppercase text-[10px] font-medium text-[var(--color-text-muted)]">
              Navigation
            </span>
          </div>

          <div className="space-y-0.5">
            {navigation.map((item) => {
              // Items with children (Portfolio group)
              if ('children' in item && item.children) {
                const isGroupActive = PORTFOLIO_HREFS.includes(pathname);
                const isExactActive = pathname === item.href;

                return (
                  <div key={item.name}>
                    {/* Parent link */}
                    <div className="flex items-center">
                      <Link
                        href={item.href}
                        className={cn(
                          'flex-1 flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded transition-all duration-200',
                          isExactActive
                            ? 'sidebar-active'
                            : isGroupActive
                              ? 'text-[var(--color-text-primary)] bg-[var(--color-gold-surface)]'
                              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)]'
                        )}
                      >
                        <item.icon className={cn(
                          'w-5 h-5',
                          !isGroupActive && 'opacity-60'
                        )} />
                        <span>{item.name}</span>
                      </Link>
                      <button
                        onClick={() => setPortfolioDropdownOpen(!portfolioDropdownOpen)}
                        className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                        aria-label="Toggle portfolio sub-menu"
                      >
                        <ChevronDown className={cn(
                          'w-3.5 h-3.5 transition-transform duration-200',
                          portfolioDropdownOpen && 'rotate-180'
                        )} />
                      </button>
                    </div>

                    {/* Inline children */}
                    {portfolioDropdownOpen && (
                      <div className="ml-4 pl-4 border-l border-[var(--color-border-subtle)] space-y-0.5 mt-0.5 mb-1">
                        {item.children.map((child) => {
                          const isChildActive = pathname === child.href;
                          return (
                            <Link
                              key={child.name}
                              href={child.href}
                              className={cn(
                                'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded transition-all duration-200',
                                isChildActive
                                  ? 'text-[var(--color-gold)] bg-[var(--color-gold-surface)]'
                                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)]'
                              )}
                            >
                              <child.icon className={cn(
                                'w-4 h-4',
                                !isChildActive && 'opacity-60'
                              )} />
                              <span>{child.name}</span>
                              {'pro' in child && child.pro && !isPro && (
                                <span className="ml-auto text-[9px] uppercase tracking-wider font-semibold text-[var(--color-gold)] bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] px-1.5 py-0.5 rounded" style={{ fontFamily: 'var(--font-mono)' }}>Pro</span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              // Regular nav items
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded transition-all duration-200',
                    isActive
                      ? 'sidebar-active'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)]'
                  )}
                >
                  <item.icon className={cn(
                    'w-5 h-5',
                    !isActive && 'opacity-60'
                  )} />
                  <span>{item.name}</span>
                  {'pro' in item && item.pro && !isPro && (
                    <span className="ml-auto text-[9px] uppercase tracking-wider font-semibold text-[var(--color-gold)] bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] px-1.5 py-0.5 rounded" style={{ fontFamily: 'var(--font-mono)' }}>Pro</span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* ── Account section ── */}
          <div className="mt-6 mb-3 px-3">
            <span className="tracking-widest uppercase text-[10px] font-medium text-[var(--color-text-muted)]">
              Account
            </span>
          </div>

          <div className="space-y-0.5">
            <Link
              href="/dashboard/accounts"
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded transition-all duration-200',
                pathname === '/dashboard/accounts'
                  ? 'sidebar-active'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)]'
              )}
            >
              <Wallet className={cn('w-5 h-5', pathname !== '/dashboard/accounts' && 'opacity-60')} />
              <span>Connected Accounts</span>
            </Link>
            <Link
              href="/dashboard/settings"
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded transition-all duration-200',
                pathname === '/dashboard/settings'
                  ? 'sidebar-active'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)]'
              )}
            >
              <Settings className={cn('w-5 h-5', pathname !== '/dashboard/settings' && 'opacity-60')} />
              <span>Settings</span>
            </Link>
          </div>
        </nav>

        {/* ── User profile (bottom of sidebar) ── */}
        <div className="shrink-0 border-t border-[var(--color-border-base)] p-3" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded hover:bg-[var(--color-bg-overlay)] transition-colors duration-200"
          >
            <div className="w-8 h-8 rounded-full bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] flex items-center justify-center shrink-0">
              <span className="text-xs font-semibold text-[var(--color-gold)]">
                {profile?.initials || '...'}
              </span>
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium text-[var(--color-text-primary)] leading-tight truncate">
                {profile?.fullName || 'Loading...'}
              </p>
              <p className="text-[11px] text-[var(--color-text-muted)] leading-tight truncate">
                {profile?.email || ''}
              </p>
            </div>
            <ChevronDown className={cn(
              'w-4 h-4 text-[var(--color-text-muted)] transition-transform duration-200 shrink-0',
              menuOpen && 'rotate-180'
            )} />
          </button>

          {/* User dropdown menu (opens upward from bottom) */}
          {menuOpen && (
            <div className="absolute bottom-[72px] left-3 right-3 bg-[var(--color-bg-elevated)] rounded shadow-xl z-50 overflow-hidden border border-[var(--color-border-base)]">
              {/* User Info */}
              <div className="px-4 py-3 border-b border-[var(--color-border-base)]">
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {profile?.fullName || 'User'}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] truncate">
                  {profile?.email || ''}
                </p>
              </div>

              {/* Menu Items */}
              <div className="py-1">
                <Link
                  href="/pricing"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors"
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>Pricing</span>
                </Link>
                <a
                  href="/blog"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Blog</span>
                </a>
              </div>

              {/* Logout */}
              <div className="border-t border-[var(--color-border-base)] py-1">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    handleLogout();
                  }}
                  disabled={loggingOut}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-[var(--color-negative)] hover:text-[var(--color-negative)] hover:bg-[var(--color-negative)]/5 transition-colors disabled:opacity-50"
                >
                  {loggingOut ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LogOut className="w-4 h-4" />
                  )}
                  <span>{loggingOut ? 'Signing out...' : 'Sign out'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ═══════════════════════════════════════════════
          MAIN AREA (offset by sidebar width)
          ═══════════════════════════════════════════════ */}
      <div className={cn(
        "ml-64 flex flex-col flex-1 min-w-0",
        isChatPage ? "h-screen overflow-hidden" : "min-h-screen"
      )}>

        {/* ── Glassmorphic Top Bar ── */}
        <header className="shrink-0 glass-nav sticky top-0 z-30">
          <div className="flex items-center justify-between px-6 py-3">
            <h1 className="text-sm font-semibold text-[var(--color-text-primary)] tracking-tight">
              {pageTitle}
            </h1>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="w-8 h-8 rounded-full bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] flex items-center justify-center hover:border-[var(--color-gold)] transition-colors"
              >
                <span className="text-xs font-semibold text-[var(--color-gold)]">
                  {profile?.initials || '...'}
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* ── Page Content ── */}
        <main className={cn(
          "bg-[var(--color-bg-base)] bg-depth flex-1",
          isChatPage && "min-h-0 flex flex-col"
        )}>
          <div
            key={pathname}
            className={cn(
              !reduceMotion && 'page-transition',
              isChatPage && 'flex-1 min-h-0 flex flex-col'
            )}
          >
            {children}
          </div>
        </main>

        {/* Legal Footer — hidden on chat page for full-height layout */}
        {!isChatPage && <LegalFooter variant="minimal" />}
      </div>
    </div>
  );
}
