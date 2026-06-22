'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { isThesisUser } from '@/lib/thesis-access';
import { useTier } from '@/hooks/use-tier';
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
  Menu,
  X,
  Search,
  PenLine,
  Anchor,
  Layers,
  SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { HelmMark } from '@/components/helm-mark';
import { ZoomShell } from '@/components/zoom-shell';
import { useSettings } from '@/contexts/settings-context';
import { DemoProvider, useDemo } from '@/contexts/demo-context';
import { LegalFooter } from '@/components/legal-footer';
import { FinancialDisclaimer } from '@/components/financial-disclaimer';
import { FoundingMemberBanner } from '@/components/founding-member-banner';
import { ThesesWhatsNewBanner } from '@/components/thesis/theses-whatsnew-banner';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';
import { GuidedTour } from '@/components/onboarding/guided-tour';
import { DisclaimerModal } from '@/components/legal/disclaimer-modal';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';
import { ConvictionRail } from '@/components/thesis/conviction-rail';
import { ConvictionNavButton } from '@/components/thesis/conviction-nav-button';

/* ── Connect Banner — shown in demo mode ── */
function ConnectBanner() {
  const { isDemo } = useDemo();
  const [dismissed, setDismissed] = useState(false);

  if (!isDemo || dismissed) return null;

  return (
    <div className="bg-[var(--color-gold-surface)] border-b border-[var(--color-gold-border)]">
      <div className="max-w-[1600px] mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-gold)] shrink-0" />
          <span className="text-[13px] text-[var(--color-text-primary)] truncate">
            You&apos;re viewing <strong>sample data</strong>.
          </span>
          <Link
            href="/dashboard/accounts"
            className="text-[13px] font-semibold text-[var(--color-gold)] hover:underline shrink-0"
          >
            <span className="hidden sm:inline">Connect your account to see your real portfolio →</span>
            <span className="sm:hidden">Connect account →</span>
          </Link>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="grid place-items-center min-w-[44px] min-h-[44px] -m-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors shrink-0"
          aria-label="Dismiss banner"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

const navigation = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  {
    name: 'Portfolio',
    href: '/dashboard/portfolio',
    icon: TrendingUp,
    children: [
      { name: 'Add Holdings', href: '/dashboard/portfolio/add', icon: PenLine },
      { name: 'Research', href: '/dashboard/chat', icon: MessageSquare },
      { name: 'Earnings', href: '/dashboard/earnings', icon: BarChart3 },
      { name: 'Factor Lens', href: '/dashboard/portfolio/factors', icon: Layers },
    ],
  },
  { name: 'Theses', href: '/dashboard/theses', icon: Anchor },
  { name: 'Screener', href: '/dashboard/screener', icon: SlidersHorizontal },
  { name: 'Analyze', href: '/dashboard/analyze', icon: Search },
  { name: 'Daily Brief', href: '/dashboard/brief', icon: BookOpen },
  { name: 'Actions', href: '/dashboard/actions', icon: Zap },
  { name: 'Activity', href: '/dashboard/transactions', icon: ArrowLeftRight },
  { name: 'Taxes', href: '/dashboard/taxes', icon: FileText },
  { name: 'Wrapped', href: '/dashboard/wrapped', icon: Sparkles },
];

const PORTFOLIO_HREFS = ['/dashboard/portfolio', '/dashboard/portfolio/add', '/dashboard/chat', '/dashboard/earnings', '/dashboard/portfolio/factors'];

/* Map pathnames to page titles for the top bar */
const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Overview',
  '/dashboard/portfolio': 'Portfolio',
  '/dashboard/chat': 'Research',
  '/dashboard/earnings': 'Earnings',
  '/dashboard/brief': 'Daily Brief',
  '/dashboard/actions': 'Actions',
  '/dashboard/transactions': 'Activity',
  '/dashboard/taxes': 'Taxes',
  '/dashboard/wrapped': 'Wrapped',
  '/dashboard/accounts': 'Connected Accounts',
  '/dashboard/settings': 'Settings',
  '/dashboard/analyze': 'Analyze',
  '/dashboard/theses': 'Theses',
  '/dashboard/portfolio/factors': 'Factor Lens',
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith('/dashboard/analyze/')) {
    const ticker = pathname.split('/')[3]?.toUpperCase();
    return ticker ? `Analyze ${ticker}` : 'Analyze';
  }
  if (pathname.startsWith('/dashboard/holdings/')) {
    const ticker = pathname.split('/')[3]?.toUpperCase();
    return ticker ? `${ticker} Position` : 'Holdings';
  }
  return 'Dashboard';
}

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
  const reduceMotion = settings.accessibility.reduceMotion;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [railWidth, setRailWidth] = useState(316);
  const [thesesVisited, setThesesVisited] = useState(true);
  const { isPro } = useTier();
  const [mobileRailOpen, setMobileRailOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [topMenuOpen, setTopMenuOpen] = useState(false);
  const [portfolioDropdownOpen, setPortfolioDropdownOpen] = useState(() =>
    PORTFOLIO_HREFS.includes(typeof window !== 'undefined' ? window.location.pathname : '')
  );
  const menuRef = useRef<HTMLDivElement>(null);
  const topMenuRef = useRef<HTMLDivElement>(null);

  // Auto-expand portfolio section when navigating to a child route
  useEffect(() => {
    if (PORTFOLIO_HREFS.includes(pathname)) {
      setPortfolioDropdownOpen(true);
    }
  }, [pathname]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Restore conviction-rail collapsed preference
  useEffect(() => {
    try { setRailCollapsed(localStorage.getItem('helm:conviction-collapsed') === '1'); } catch {}
  }, []);

  // Restore conviction-rail width preference
  useEffect(() => {
    try {
      const w = parseInt(localStorage.getItem('helm:conviction-width') || '', 10);
      if (w >= 280 && w <= 620) setRailWidth(w);
    } catch {}
  }, []);

  // "New" badge on the Theses nav item until the user opens it once.
  useEffect(() => {
    try { setThesesVisited(localStorage.getItem('helm_theses_visited') === '1'); } catch {}
  }, []);
  useEffect(() => {
    if (pathname === '/dashboard/theses') {
      try { localStorage.setItem('helm_theses_visited', '1'); } catch {}
      setThesesVisited(true);
    }
  }, [pathname]);

  // Close user menus on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
      if (topMenuRef.current && !topMenuRef.current.contains(event.target as Node)) {
        setTopMenuOpen(false);
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

  const toggleRail = () => {
    setRailCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem('helm:conviction-collapsed', next ? '1' : '0'); } catch {}
      return next;
    });
  };

  const resizeRail = (w: number) => {
    const clamped = Math.max(280, Math.min(620, Math.round(w)));
    setRailWidth(clamped);
    try { localStorage.setItem('helm:conviction-width', String(clamped)); } catch {}
  };

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
  const isWrappedPage = pathname === '/dashboard/wrapped';
  // Conviction rail: ultrawide-only ambient panel; off on full-screen pages
  // and on the Theses page itself (which is the full conviction surface).
  // Gated: the conviction rail is part of the thesis layer, so only allowlisted
  // accounts see it (and the layout reserves its width). Covers render + padding.
  const thesisEntitled = isPro || isThesisUser(profile?.email);
  const showRail = thesisEntitled && !isChatPage && !isWrappedPage && pathname !== '/dashboard/theses';
  const pageTitle = getPageTitle(pathname);

  return (
    <DemoProvider>
    <>
    <OnboardingFlow />
    <GuidedTour />
    <DisclaimerModal />
    <div
      className={cn(
        "bg-[var(--color-bg-base)] flex max-w-[100vw] overflow-x-hidden",
        isChatPage ? "h-dvh overflow-hidden" : "min-h-dvh"
      )}
      style={{ ['--rail-w' as string]: showRail ? (railCollapsed ? '48px' : `${railWidth}px`) : '0px' } as React.CSSProperties}
    >

      {/* ═══════════════════════════════════════════════
          FIXED SIDEBAR
          ═══════════════════════════════════════════════ */}
      {/* Backdrop overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 min-[1025px]:hidden"
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setSidebarOpen(false); }}
          role="presentation"
        />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 flex flex-col bg-[var(--color-bg-surface)] border-r border-[var(--color-border-base)]",
        "transition-transform duration-300",
        sidebarOpen ? "translate-x-0" : "-translate-x-full min-[1025px]:translate-x-0"
      )}>

        {/* ── Logo ── */}
        <div className="shrink-0 px-5 py-5">
          <Link href="/" className="flex items-center gap-2.5 group">
            <HelmMark size={28} />
            <span className="text-[15px] font-bold tracking-tight uppercase">
              Helm
            </span>
          </Link>
        </div>

        {/* ── Navigation ── */}
        <nav aria-label="Dashboard navigation" className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-4">
          <div className="mb-3 px-3">
            <span className="tracking-widest uppercase text-[10px] font-medium text-[var(--color-text-muted)]">
              Navigation
            </span>
          </div>

          <div className="space-y-0.5">
            {navigation.map((item) => {
              // Screener is thesis-access-only: gate it exactly like the thesis layer
              // (Pro tier or thesis allowlist). Other items render unconditionally.
              if (item.href === '/dashboard/screener' && !thesisEntitled) return null;
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
                        data-tour={item.name.toLowerCase().replace(/\s+/g, '-')}
                        className={cn(
                          'flex-1 flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded transition-colors duration-200',
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
                        className="p-3 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                        aria-label="Toggle portfolio sub-menu"
                        aria-expanded={portfolioDropdownOpen}
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
                                'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded transition-colors duration-200',
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
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              // Regular nav items — /dashboard/analyze uses startsWith so /dashboard/analyze/AAPL highlights too
              const isActive = item.href === '/dashboard/analyze'
                ? pathname.startsWith('/dashboard/analyze')
                : pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  data-tour={item.name === 'Daily Brief' ? 'brief' : item.name === 'Activity' ? 'transactions' : item.name.toLowerCase().replace(/\s+/g, '-')}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded transition-colors duration-200',
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
                  {item.href === '/dashboard/theses' && !thesesVisited && (
                    <span className="ml-auto font-mono text-[9px] font-semibold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded bg-[var(--color-gold)] text-black" style={{ fontFamily: 'var(--font-mono)' }}>New</span>
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
              data-tour="accounts"
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded transition-colors duration-200',
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
                'flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded transition-colors duration-200',
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
            <div className="w-8 h-8 rounded-full bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] flex items-center justify-center shrink-0" aria-hidden="true">
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
        "ml-0 min-[1025px]:ml-64 flex flex-col flex-1 min-w-0 2xl:transition-[padding] 2xl:duration-200 2xl:ease-out",
        isChatPage ? "h-dvh overflow-hidden" : "min-h-dvh",
        showRail && "xl:pr-[var(--rail-w)]"
      )}>

        {/* ── Mobile Top Bar (hidden on wrapped) ── */}
        {!isWrappedPage && <div
          className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between min-[1025px]:hidden"
          style={{
            background: 'rgba(10,10,10,0.78)',
            backdropFilter: 'blur(20px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="grid place-items-center min-w-[44px] min-h-[44px] -m-2.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2.5">
            <HelmMark size={20} />
            <span className="text-[13px] font-bold tracking-tight uppercase">
              Helm
            </span>
          </div>
          {showRail ? (
            <ConvictionNavButton
              onClick={() => setMobileRailOpen(true)}
              label={false}
              className="flex items-center gap-1.5 min-h-[44px] px-2 text-[var(--color-text-muted)] hover:text-[#E6B94D] transition-colors"
            />
          ) : (
            <div className="w-[44px]" />
          )}
        </div>}

        {/* ── Glassmorphic Top Bar (desktop only) ── */}
        <header className="shrink-0 glass-nav sticky top-0 z-30 hidden min-[1025px]:block">
          <div className="flex items-center justify-between px-6 py-3">
            <h1 className="text-sm font-semibold text-[var(--color-text-primary)] tracking-tight">
              {pageTitle}
            </h1>
            <div className="flex items-center gap-3">
              {showRail && (
                <ConvictionNavButton
                  onClick={() => setMobileRailOpen(true)}
                  className="xl:hidden flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.08] text-[#9A9A9A] hover:text-[#E6B94D] transition-colors"
                />
              )}
              <div className="relative" ref={topMenuRef}>
                <button
                  onClick={() => setTopMenuOpen(!topMenuOpen)}
                  className="w-8 h-8 rounded-full bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] flex items-center justify-center hover:border-[var(--color-gold)] transition-colors"
                >
                  <span className="text-xs font-semibold text-[var(--color-gold)]">
                    {profile?.initials || '...'}
                  </span>
                </button>

                {/* Top-right dropdown (opens downward) */}
                {topMenuOpen && (
                  <div className="absolute top-full right-0 mt-2 w-56 max-w-[calc(100vw-16px)] bg-[var(--color-bg-elevated)] rounded-lg shadow-xl z-50 overflow-hidden border border-[var(--color-border-base)]">
                    <div className="px-4 py-3 border-b border-[var(--color-border-base)]">
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        {profile?.fullName || 'User'}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] truncate">
                        {profile?.email || ''}
                      </p>
                    </div>
                    <div className="py-1">
                      <Link
                        href="/pricing"
                        onClick={() => setTopMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors"
                      >
                        <TrendingUp className="w-4 h-4" />
                        <span>Pricing</span>
                      </Link>
                      <a
                        href="/blog"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setTopMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors"
                      >
                        <BookOpen className="w-4 h-4" />
                        <span>Blog</span>
                      </a>
                    </div>
                    <div className="border-t border-[var(--color-border-base)] py-1">
                      <button
                        onClick={() => {
                          setTopMenuOpen(false);
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
            </div>
          </div>
        </header>

        {/* ── Page Content ── */}
        <main id="main-content" className={cn(
          "bg-[var(--color-bg-base)] bg-depth flex-1",
          isChatPage && "min-h-0 flex flex-col"
        )}>
          <ConnectBanner />
          <FoundingMemberBanner />
          {thesisEntitled && pathname !== '/dashboard/theses' && <ThesesWhatsNewBanner />}
          <div
            key={pathname}
            className={cn(
              !reduceMotion && 'page-transition',
              isChatPage && 'flex-1 min-h-0 flex flex-col'
            )}
          >
            <ZoomShell>{children}</ZoomShell>
          </div>
        </main>

        {!isChatPage && <FinancialDisclaimer />}
        {!isChatPage && <LegalFooter variant="minimal" />}

        {/* Spacer for mobile bottom nav — nav grid (~56px) + safe area */}
        {!isWrappedPage && (
          <div className="min-[1025px]:hidden shrink-0" style={{ height: 'calc(var(--mobile-nav-h, 56px) + env(safe-area-inset-bottom, 0px))' }} />
        )}
      </div>

      {/* ── Conviction rail (ultrawide-only, fixed right) ── */}
      {showRail && (
        <ConvictionRail
          collapsed={railCollapsed}
          onToggle={toggleRail}
          width={railWidth}
          onResize={resizeRail}
          mobileOpen={mobileRailOpen}
          onMobileClose={() => setMobileRailOpen(false)}
        />
      )}

      {/* ── Mobile Bottom Tab Bar (hidden on wrapped — full-screen experience) ── */}
      {!isWrappedPage && <MobileBottomNav />}
    </div>
    </>
    </DemoProvider>
  );
}
