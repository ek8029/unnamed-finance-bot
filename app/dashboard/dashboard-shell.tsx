'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { isThesisUser } from '@/lib/thesis-access';
import { useTier } from '@/hooks/use-tier';
import { useAccounts } from '@/hooks/use-financial-data';
import { usePreview } from '@/lib/preview-context';
import { CheckoutModal } from '@/components/checkout-modal';
import { CHECKOUT_PARAM, PENDING_CHECKOUT_KEY, isCheckoutIntent, type CheckoutIntent } from '@/lib/checkout-intent';
import { TIER_RANK, type Tier } from '@/lib/tier-shared';
import { V3_COPY } from '@/lib/onboarding/v3-copy';
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
  ChevronRight,
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
  Bell,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { HelmMark } from '@/components/helm-mark';
import { LabImpersonationBanner } from '@/components/lab-impersonation-banner';
import { TrialBanner } from '@/components/trial-banner';
import { ZoomShell } from '@/components/zoom-shell';
import { useSettings } from '@/contexts/settings-context';
import { DemoProvider, useDemo } from '@/contexts/demo-context';
import { LegalFooter } from '@/components/legal-footer';
import { FinancialDisclaimer } from '@/components/financial-disclaimer';
import { ThesesWhatsNewBanner } from '@/components/thesis/theses-whatsnew-banner';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';
import { OnboardingFlowV2 } from '@/components/onboarding/onboarding-flow-v2';
import { OnboardingFlowV3 } from '@/components/onboarding/v3/onboarding-flow-v3';
import { useSurveyDeferral } from '@/components/survey-deferral';

// Value-first onboarding cohort. Flip NEXT_PUBLIC_ONBOARDING_V2=1 to serve the
// scan-before-connect flow; default keeps the legacy tour until scan->link reads positive.
const ONBOARDING_V2 = process.env.NEXT_PUBLIC_ONBOARDING_V2 === '1';
const ONBOARDING_V3 = process.env.NEXT_PUBLIC_ONBOARDING_V3 === '1';
import { GuidedTour } from '@/components/onboarding/guided-tour';
import { DisclaimerModal } from '@/components/legal/disclaimer-modal';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';
import { ConvictionRail } from '@/components/thesis/conviction-rail';
import { ConvictionNavButton } from '@/components/thesis/conviction-nav-button';
import { cachedGet, invalidate } from '@/lib/api-cache';

/* ── Legacy-onboarding fallback for a parked checkout ──
   V2 tells the shell when it is out of the way. The legacy flow does not, so
   without this a checkout intent parked on the way in would never be opened. */

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
          <span className="text-[15px] text-[var(--color-text-primary)] truncate">
            You&apos;re viewing <strong>sample data</strong>.
          </span>
          <Link
            href="/dashboard/accounts"
            className="text-[15px] font-semibold text-[var(--color-gold)] hover:underline shrink-0"
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

/* ──────────────────────────────────────────────────────────
   NAV MODEL — every existing dashboard route, mapped into the
   spec's Sovereign Architect groups. `tier` is the minimum tier
   that unlocks the item (Free items omit it). For nav pills only:
   Factor lens = MAX; Theses / Earnings / Taxes = PRO.
   ────────────────────────────────────────────────────────── */
type NavItem = {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  tier?: Tier; // minimum tier for the gating pill
  pulse?: boolean; // Daily Brief gold pulse dot
  count?: number; // Actions red count pill
  badge?: 'new'; // Theses "New" badge
  // v3: what the item is waiting for, or null when it is ready. Dimmed items still navigate.
  dim?: (s: { hasBrief: boolean; hasConnection: boolean }) => string | null;
};

const TERMINAL_NAV: NavItem[] = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  // Portfolio rendered separately (has disclosure sub-items)
  { name: 'Theses', href: '/dashboard/theses', icon: Anchor, tier: 'pro', badge: 'new', dim: (s) => (s.hasBrief ? null : V3_COPY.sidebar.afterBrief) },
];

const PORTFOLIO_PARENT: NavItem = { name: 'Portfolio', href: '/dashboard/portfolio', icon: TrendingUp };
const PORTFOLIO_CHILDREN: NavItem[] = [
  { name: 'Manual entry', href: '/dashboard/portfolio/add', icon: PenLine },
  { name: 'Research', href: '/dashboard/chat', icon: MessageSquare },
  { name: 'Earnings', href: '/dashboard/earnings', icon: BarChart3, tier: 'pro', dim: (s) => (s.hasBrief ? null : V3_COPY.sidebar.afterBrief) },
  { name: 'Factor lens', href: '/dashboard/portfolio/factors', icon: Layers, tier: 'pro' },
];

const INTELLIGENCE_NAV: NavItem[] = [
  { name: 'Analyze', href: '/dashboard/analyze', icon: Search },
  { name: 'Daily Brief', href: '/dashboard/brief', icon: BookOpen, dim: (s) => (s.hasBrief ? null : V3_COPY.sidebar.briefTomorrow) },
  { name: 'Actions', href: '/dashboard/actions', icon: Zap },
  { name: 'Activity', href: '/dashboard/transactions', icon: ArrowLeftRight },
];

const PLANNING_NAV: NavItem[] = [
  { name: 'Taxes', href: '/dashboard/taxes', icon: FileText, tier: 'pro', dim: (s) => (s.hasConnection ? null : V3_COPY.sidebar.needsCostBasis) },
  { name: 'Wrapped', href: '/dashboard/wrapped', icon: Sparkles },
  // NOTE: "Cash & Income" (spec/round2 Planning group) has no route yet — omitted
  // rather than pointed at a wrong target. Add here as `/dashboard/cash` when built.
];

const ACCOUNT_NAV: NavItem[] = [
  { name: 'Connected accounts', href: '/dashboard/accounts', icon: Wallet },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

const PORTFOLIO_HREFS = PORTFOLIO_CHILDREN.map((c) => c.href).concat(PORTFOLIO_PARENT.href);

/* Command palette navigation rows (each navigates to a real route). */
const PALETTE_NAVIGATE: { name: string; href: string; hint: string; tier?: Tier }[] = [
  { name: 'Overview', href: '/dashboard', hint: 'G O' },
  { name: 'Portfolio & Holdings', href: '/dashboard/portfolio', hint: 'G P' },
  { name: 'Accounts', href: '/dashboard/accounts', hint: 'G A' },
  { name: 'Daily Brief', href: '/dashboard/brief', hint: 'G B' },
  { name: 'Theses', href: '/dashboard/theses', hint: 'G T', tier: 'pro' },
  { name: 'Taxes', href: '/dashboard/taxes', hint: 'G X', tier: 'pro' },
  { name: 'Settings', href: '/dashboard/settings', hint: 'G S' },
];
const PALETTE_ACTIONS: { name: string; href: string; hint: string; glyph: string; tier?: Tier }[] = [
  { name: 'Analyze a ticker…', href: '/dashboard/analyze', hint: '⏎', glyph: '⌕' },
  { name: 'Harvest tax losses', href: '/dashboard/taxes', hint: '', glyph: '✦', tier: 'pro' },
];

interface UserProfile {
  fullName: string;
  email: string;
  initials: string;
}

export default function DashboardShell({
  children,
  previewPath,
}: {
  children: React.ReactNode;
  /** Dev-only design workbench supplies a route without changing auth. */
  previewPath?: string;
}) {
  const currentPath = usePathname();
  const pathname = previewPath ?? currentPath;
  const router = useRouter();
  const { settings } = useSettings();

  // Explicit purchase intent gets checkout first; ordinary signups get onboarding.
  const [resumeCheckout, setResumeCheckout] = useState<CheckoutIntent | null>(null);
  const [checkoutChecked, setCheckoutChecked] = useState(false);
  const [onboardingSettled, setOnboardingSettled] = useState(false);
  const settleOnboarding = useCallback(() => setOnboardingSettled(true), []);
  useSurveyDeferral(!previewPath && (!onboardingSettled || !!resumeCheckout));
  const checkoutRead = useRef(false);
  useEffect(() => {
    if (previewPath || checkoutRead.current) return;
    checkoutRead.current = true;
    const url = new URL(window.location.href);
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(PENDING_CHECKOUT_KEY);
      sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
    } catch { /* Storage can be unavailable in private browsing. */ }
    const fromUrl = url.searchParams.get(CHECKOUT_PARAM);
    const intent = isCheckoutIntent(fromUrl) ? fromUrl : stored;
    if (isCheckoutIntent(fromUrl)) {
      url.searchParams.delete(CHECKOUT_PARAM);
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    }
    if (isCheckoutIntent(intent)) setResumeCheckout(intent);
    setCheckoutChecked(true);
  }, [previewPath]);
  const reduceMotion = settings.accessibility.reduceMotion;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [railWidth, setRailWidth] = useState(316);
  const [thesesVisited, setThesesVisited] = useState(true);
  const { isPro } = useTier();
  const { tier } = usePreview();
  const { accounts, loading: accountsLoading, error: accountsError } = useAccounts();
  const [mobileRailOpen, setMobileRailOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [tickerResults, setTickerResults] = useState<{ ticker: string; name: string }[]>([]);
  const [paletteSel, setPaletteSel] = useState(0);
  // Open on the first paint when the route is already a portfolio child, so the
  // sub-menu never flashes shut and then open. The route must come from
  // usePathname(): the server has no `window`, so a `typeof window` branch here
  // rendered the menu CLOSED on the server and OPEN on the client, and every
  // /dashboard/portfolio load threw a hydration mismatch and rebuilt the entire
  // dashboard tree client-side.
  const [portfolioDropdownOpen, setPortfolioDropdownOpen] = useState(() =>
    PORTFOLIO_HREFS.includes(pathname)
  );
  const menuRef = useRef<HTMLDivElement>(null);

  // Tier gating: an item with `tier` is locked when the user's tier rank is below it.
  const tierRank = TIER_RANK[tier];
  const isLocked = (required?: Tier) => required != null && tierRank < TIER_RANK[required];

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

  // Ctrl+K (or ⌘K) toggles the palette; Esc closes. Plus vim-style "G then
  // <key>" quick-nav chords. Wired on mount, removed on unmount.
  useEffect(() => {
    const GO_MAP: Record<string, string> = {
      o: '/dashboard',
      p: '/dashboard/portfolio',
      a: '/dashboard/accounts',
      b: '/dashboard/brief',
      t: '/dashboard/theses',
      x: '/dashboard/taxes',
      s: '/dashboard/settings',
    };
    let gPending = false;
    let gTimer: ReturnType<typeof setTimeout> | undefined;

    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (e.key === 'Escape') {
        setPaletteOpen(false);
        return;
      }

      // Chords only fire outside text fields and without modifiers, so they
      // never interfere with typing (incl. the palette search).
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

      const k = e.key.toLowerCase();
      if (gPending) {
        gPending = false;
        if (gTimer) clearTimeout(gTimer);
        const href = GO_MAP[k];
        if (href) { e.preventDefault(); router.push(href); }
        return;
      }
      if (k === 'g') {
        gPending = true;
        gTimer = setTimeout(() => { gPending = false; }, 1200);
      }
    }

    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
      if (gTimer) clearTimeout(gTimer);
    };
  }, [router]);

  // Close the palette whenever the route changes (a row was selected).
  useEffect(() => {
    setPaletteOpen(false);
  }, [pathname]);

  // Reset query + selection each time the palette opens.
  useEffect(() => {
    if (paletteOpen) { setPaletteQuery(''); setTickerResults([]); setPaletteSel(0); }
  }, [paletteOpen]);

  // Debounced ticker autocomplete.
  useEffect(() => {
    const q = paletteQuery.trim();
    if (!q) { setTickerResults([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/tickers/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((d) => setTickerResults(d.results || []))
        .catch(() => {});
    }, 120);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [paletteQuery]);

  // v3 sidebar labels. Defaults to "ready" so nothing dims before the fetch
  // resolves, on error, or with the flag off (no fetch at all). The pathname
  // dependency below is what re-reads the fetch and refreshes the label after
  // a connection; this hook's own useAccounts() call fetches once and does not
  // cover that gap on its own.
  const [activation, setActivation] = useState({ hasBrief: true, hasConnection: true });
  useEffect(() => {
    if (!ONBOARDING_V3 || previewPath) return;
    let cancelled = false;
    fetch('/api/onboarding/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setActivation({ hasBrief: !!data.hasBrief, hasConnection: !!data.hasConnection });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [previewPath, pathname]);
  // Plaid only: manual accounts carry no cost basis, so a hand-entered book keeps Taxes dimmed.
  const dimState = { hasBrief: activation.hasBrief, hasConnection: activation.hasConnection || accounts.some((a) => a.source === 'plaid') };

  // Fetch user profile on mount + re-fetch when profile is updated
  useEffect(() => {
    if (previewPath) {
      setProfile({ fullName: 'Sample portfolio', email: '', initials: 'H' });
      return;
    }
    async function fetchProfile() {
      try {
        const res = await cachedGet<{ profile?: { full_name?: string | null; email?: string | null } }>('/api/user/profile');
        if (res.ok && res.data) {
          const data = res.data;
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

    // Re-fetch when settings page updates the profile. Drop the cached copy first
    // or the re-fetch would hand back the pre-save name.
    const handleProfileUpdate = () => { invalidate('/api/user/profile'); fetchProfile(); };
    window.addEventListener('helm:profile-updated', handleProfileUpdate);
    return () => window.removeEventListener('helm:profile-updated', handleProfileUpdate);
  }, [previewPath]);

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
  const thesisEntitled = isPro || isThesisUser(profile?.email);
  const showRail = thesisEntitled && !isChatPage && !isWrappedPage && pathname !== '/dashboard/theses';

  // Active-state helper. Analyze uses startsWith so /dashboard/analyze/AAPL highlights too.
  const isActive = (href: string) =>
    href === '/dashboard/analyze' ? pathname.startsWith('/dashboard/analyze') : pathname === href;

  // Tier badge on the user row (Free muted / Pro gold).
  const planLabel = ({ free: 'Free tier', pro: 'Pro' } as const)[tier];
  const tierBadgeColor = tier === 'pro' ? 'var(--color-gold)' : 'var(--color-text-muted)';

  /* Shared nav-item renderer (top-level rows). */
  function NavRow({ item }: { item: NavItem }) {
    const active = isActive(item.href);
    const locked = isLocked(item.tier);
    const showNewBadge = item.badge === 'new' && item.href === '/dashboard/theses' && thesisEntitled && !thesesVisited;
    const dimLabel = ONBOARDING_V3 ? item.dim?.(dimState) ?? null : null;
    return (
      <Link
        href={item.href}
        data-tour={
          item.name === 'Daily Brief' ? 'brief'
            : item.name === 'Activity' ? 'transactions'
            : item.name === 'Connected accounts' ? 'accounts'
            : item.name.toLowerCase().replace(/\s+/g, '-')
        }
        aria-current={active ? 'page' : undefined}
        className="group/nav flex items-center gap-[11px] py-[9px] pl-[13px] pr-3 text-[15px] tracking-[-0.005em] no-underline"
        style={{
          borderLeft: `2px solid ${active ? 'var(--color-gold)' : 'transparent'}`,
          borderRadius: '0 5px 5px 0',
          background: active ? 'color-mix(in srgb, var(--color-gold) 7%, transparent)' : 'transparent',
          color: active ? 'var(--color-gold)' : 'var(--color-text-secondary)',
          fontWeight: active ? 600 : 500,
        }}
      >
        <item.icon size={16} strokeWidth={1.6} className="shrink-0" />
        <span className="flex-1 truncate">{item.name}</span>
        {dimLabel && <span className="shrink-0 whitespace-nowrap text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{dimLabel}</span>}
        {item.pulse && (
          <span
            className="w-1.5 h-1.5 rounded-full bg-[var(--color-gold)] shrink-0"
            style={{ animation: reduceMotion ? undefined : 'helmPulse 2.4s ease-in-out infinite' }}
            aria-hidden="true"
          />
        )}
        {item.count != null && (
          <span className="shrink-0 rounded-full px-1.5 py-[1px] text-[8px] font-bold tracking-[0.06em] bg-[color-mix(in_srgb,var(--color-negative-text)_12%,transparent)] text-[var(--color-negative-text)]" style={{ fontFamily: 'var(--font-mono)' }}>
            {item.count}
          </span>
        )}
        {locked && (
          <span
            className="shrink-0 rounded-[3px] px-[5px] py-[1px] text-[8px] font-bold tracking-[0.08em]"
            style={{
              fontFamily: 'var(--font-mono)',
              background: 'color-mix(in srgb, var(--color-gold) 10%, transparent)',
              color: 'var(--color-gold)',
            }}
          >
            {'PRO'}
          </span>
        )}
        {showNewBadge && (
          <span className="shrink-0 rounded-[3px] px-[5px] py-[1px] text-[8px] font-bold tracking-[0.08em] bg-[var(--color-gold)] text-black" style={{ fontFamily: 'var(--font-mono)' }}>
            New
          </span>
        )}
      </Link>
    );
  }

  /* Group label (mono 8px tracking 0.22em uppercase). */
  function GroupLabel({ children, proTag }: { children: React.ReactNode; proTag?: boolean }) {
    return (
      <div
        className="flex justify-between px-[13px] pt-[15px] pb-[7px] text-[11px] uppercase first:pt-1"
        style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.16em', color: 'var(--color-text-secondary)' }}
      >
        <span>{children}</span>
        {proTag && <span className="text-[var(--color-gold)]">Pro</span>}
      </div>
    );
  }

  // Build the live result list: page matches + ticker autocomplete + an
  // "Analyze <SYMBOL>" fallback + matching actions. One flat, keyboard-navigable list.
  const _pq = paletteQuery.trim().toLowerCase();
  const _pqNoSpace = _pq.replace(/\s/g, '');
  const _qUpper = paletteQuery.trim().toUpperCase();
  const _hasFallback =
    _qUpper.length >= 1 && _qUpper.length <= 6 && /^[A-Z.]+$/.test(_qUpper) &&
    !tickerResults.some((t) => t.ticker === _qUpper);
  type PItem = { key: string; label: string; sub?: string; href: string; glyph: string; locked?: boolean; hint?: string };
  const paletteItems: PItem[] = [
    ...PALETTE_NAVIGATE
      .filter((r) =>
        !_pq ||
        r.name.toLowerCase().includes(_pq) ||
        r.hint.toLowerCase().replace(/\s/g, '').includes(_pqNoSpace),
      )
      .map((r) => ({ key: `nav-${r.href}`, label: r.name, href: r.href, glyph: '◇', locked: !!(r.tier && isLocked(r.tier)), hint: r.hint })),
    ...tickerResults.map((t) => ({ key: `tk-${t.ticker}`, label: t.ticker, sub: t.name !== t.ticker ? t.name : undefined, href: `/dashboard/analyze/${t.ticker}`, glyph: '⌕' })),
    ...(_hasFallback ? [{ key: 'fb', label: `Analyze "${_qUpper}"`, href: `/dashboard/analyze/${_qUpper}`, glyph: '⌕' }] : []),
    ...PALETTE_ACTIONS
      .filter((r) => r.href !== '/dashboard/analyze' && (!_pq || r.name.toLowerCase().includes(_pq)))
      .map((r) => ({ key: `act-${r.name}`, label: r.name, href: r.href, glyph: r.glyph, locked: !!(r.tier && isLocked(r.tier)) })),
  ];
  const _selIdx = Math.min(paletteSel, Math.max(0, paletteItems.length - 1));
  const go = (href: string) => { setPaletteOpen(false); router.push(href); };

  const palettePanel = paletteOpen && (
    <div
      onClick={() => setPaletteOpen(false)}
      role="presentation"
      className="fixed inset-0 z-[60] flex items-start justify-center"
      style={{
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        paddingTop: '14vh',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
        className="w-[560px] max-w-[94vw] overflow-hidden"
        style={{
          background: '#141414',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '10px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        <div className="flex items-center gap-[11px] px-[18px] py-[15px] border-b border-[var(--color-border-base)]">
          <Search size={16} strokeWidth={1.6} className="text-[var(--color-text-muted)]" />
          <input
            autoFocus
            value={paletteQuery}
            onChange={(e) => { setPaletteQuery(e.target.value); setPaletteSel(0); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setPaletteSel((s) => Math.min(s + 1, paletteItems.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setPaletteSel((s) => Math.max(s - 1, 0)); }
              else if (e.key === 'Enter') { e.preventDefault(); const it = paletteItems[_selIdx]; if (it) go(it.href); }
            }}
            placeholder="Search pages and tickers…"
            className="flex-1 bg-transparent border-none outline-none text-[15px] text-[var(--color-text-primary)]"
            style={{ fontFamily: 'var(--font-sans)' }}
          />
          <span
            className="text-[9px] px-1.5 py-0.5 rounded-[3px] text-[var(--color-text-muted)]"
            style={{ fontFamily: 'var(--font-mono)', background: 'var(--color-surface-tint)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            ESC
          </span>
        </div>
        <div className="p-2 max-h-[50vh] overflow-y-auto custom-scrollbar">
          {paletteItems.length === 0 ? (
            <div className="px-3 py-6 text-center text-[14px] text-[var(--color-text-muted)]">No matches.</div>
          ) : (
            paletteItems.map((it, i) => (
              <button
                key={it.key}
                type="button"
                onMouseEnter={() => setPaletteSel(i)}
                onClick={() => go(it.href)}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-[15px] no-underline transition-colors"
                style={{
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--color-text-secondary)',
                  background: i === _selIdx ? 'var(--color-border-base)' : 'transparent',
                }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', color: it.glyph === '⌕' ? 'var(--color-gold)' : 'var(--color-text-muted)' }}>{it.glyph}</span>
                <span className="text-[var(--color-text-primary)]">{it.label}</span>
                {it.sub && <span className="truncate text-[13px] text-[var(--color-text-muted)]">{it.sub}</span>}
                <span className="flex-1" />
                <span className="text-[10px]" style={{ fontFamily: 'var(--font-mono)', color: it.locked ? 'var(--color-gold)' : 'var(--color-text-secondary)' }}>
                  {it.locked ? 'PRO' : it.hint}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );

  return (
    <DemoProvider>
    <>
    {!previewPath && checkoutChecked && !resumeCheckout && (ONBOARDING_V3 ? <OnboardingFlowV3 onSettled={settleOnboarding} /> : ONBOARDING_V2 ? <OnboardingFlowV2 onSettled={settleOnboarding} /> : <OnboardingFlow onSettled={settleOnboarding} />)}
    {/* Both setup flows settle before a requested trial checkout opens. */}
    {resumeCheckout && (
      <CheckoutModal
        billingPeriod={resumeCheckout}
        zClassName="z-[120]"
        onClose={() => setResumeCheckout(null)}
      />
    )}
    {!previewPath && <GuidedTour />}
    {!previewPath && <DisclaimerModal />}
    <div
      className={cn(
        "bg-[var(--color-bg-base)] flex max-w-[100vw] overflow-x-clip",
        isChatPage ? "h-dvh overflow-hidden" : "min-h-dvh"
      )}
      style={{ ['--rail-w' as string]: showRail ? (railCollapsed ? '48px' : `${railWidth}px`) : '0px' } as React.CSSProperties}
    >

      {/* ═══════════════════════════════════════════════
          SIDEBAR (236px desktop · off-canvas drawer < 1025px)
          ═══════════════════════════════════════════════ */}
      {/* Backdrop overlay for the mobile drawer */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 min-[1025px]:hidden"
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setSidebarOpen(false); }}
          role="presentation"
        />
      )}

      <aside data-helm-sidebar
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col w-[236px]",
          "transition-transform duration-300",
          sidebarOpen ? "translate-x-0" : "-translate-x-full min-[1025px]:translate-x-0"
        )}
      >

        {/* ── Brand row ── */}
        <div
          className="shrink-0 flex items-center gap-[11px] px-[18px] pt-[18px] pb-4"
          style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
        >
          <Link href="/" className="flex items-center gap-[11px]">
            <HelmMark size={26} />
            <div className="flex flex-col gap-0.5">
              <span className="text-[15px] font-bold uppercase leading-none tracking-[0.02em]">Helm</span>
              <span
                className="text-[8px] uppercase leading-none text-[var(--color-text-muted)]"
                style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.28em' }}
              >
                Terminal
              </span>
            </div>
          </Link>
        </div>

        {/* ── Navigation ── */}
        <nav aria-label="Dashboard navigation" className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-px px-2.5 pt-3.5 pb-2">
          <GroupLabel>Terminal</GroupLabel>
          <NavRow item={TERMINAL_NAV[0]} />

          {/* Portfolio with disclosure */}
          <div>
            <div className="flex items-center">
              <Link
                href={PORTFOLIO_PARENT.href}
                data-tour="portfolio"
                aria-current={isActive(PORTFOLIO_PARENT.href) ? 'page' : undefined}
                className="flex-1 flex items-center gap-[11px] py-[9px] pl-[13px] pr-1 text-[15px] tracking-[-0.005em] no-underline"
                style={{
                  borderLeft: `2px solid ${isActive(PORTFOLIO_PARENT.href) ? 'var(--color-gold)' : 'transparent'}`,
                  borderRadius: '0 5px 5px 0',
                  background: isActive(PORTFOLIO_PARENT.href) ? 'color-mix(in srgb, var(--color-gold) 7%, transparent)' : 'transparent',
                  color: isActive(PORTFOLIO_PARENT.href) ? 'var(--color-gold)' : 'var(--color-text-secondary)',
                  fontWeight: isActive(PORTFOLIO_PARENT.href) ? 600 : 500,
                }}
              >
                <PORTFOLIO_PARENT.icon size={16} strokeWidth={1.6} className="shrink-0" />
                <span className="flex-1 truncate">{PORTFOLIO_PARENT.name}</span>
              </Link>
              <button
                onClick={() => setPortfolioDropdownOpen((v) => !v)}
                className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                aria-label="Toggle portfolio sub-menu"
                aria-expanded={portfolioDropdownOpen}
              >
                <ChevronRight className={cn('w-3.5 h-3.5 transition-transform duration-200', portfolioDropdownOpen && 'rotate-90')} />
              </button>
            </div>

            {portfolioDropdownOpen && (
              <div className="flex flex-col gap-px mt-px mb-1">
                {PORTFOLIO_CHILDREN.map((child) => {
                  const childActive = isActive(child.href);
                  const childLocked = isLocked(child.tier);
                  const childDimLabel = ONBOARDING_V3 ? child.dim?.(dimState) ?? null : null;
                  return (
                    <Link
                      key={child.name}
                      href={child.href}
                      className="flex items-center gap-2.5 py-[7px] pr-3 pl-[34px] text-[14px] rounded-[5px] no-underline"
                      style={{
                        color: childActive ? 'var(--color-gold)' : 'var(--color-text-muted)',
                        fontWeight: childActive ? 600 : 500,
                      }}
                    >
                      <span className="w-1 h-1 rounded-full bg-current opacity-50 shrink-0" />
                      <span className="flex-1 truncate">{child.name}</span>
                      {childDimLabel && <span className="shrink-0 whitespace-nowrap text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{childDimLabel}</span>}
                      {childLocked && (
                        <span
                          className="shrink-0 rounded-[3px] px-[5px] py-[1px] text-[8px] font-bold tracking-[0.08em]"
                          style={{
                            fontFamily: 'var(--font-mono)',
                            background: 'color-mix(in srgb, var(--color-gold) 10%, transparent)',
                            color: 'var(--color-gold)',
                          }}
                        >
                          {'PRO'}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <NavRow item={TERMINAL_NAV[1]} />

          <GroupLabel>Intelligence</GroupLabel>
          {INTELLIGENCE_NAV.map((item) => <NavRow key={item.name} item={item} />)}

          <GroupLabel proTag>Planning</GroupLabel>
          {PLANNING_NAV.map((item) => <NavRow key={item.name} item={item} />)}

          <GroupLabel>Account</GroupLabel>
          {ACCOUNT_NAV.map((item) => <NavRow key={item.name} item={item} />)}
        </nav>

        {/* ── Connect prompt while the book is empty ── */}
        {!accountsLoading && !accountsError && accounts.length === 0 && (
          <Link
            href="/dashboard/accounts"
            className="shrink-0 block px-3.5 py-3 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            style={{ borderTop: '1px solid var(--color-border-subtle)' }}
          >
            + Connect an account
          </Link>
        )}

        {/* ── User row ── */}
        <div className="shrink-0 relative" style={{ borderTop: '1px solid var(--color-border-subtle)' }} ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-full flex items-center gap-2.5 px-3.5 py-[13px] hover:bg-[var(--color-bg-overlay)]/40 transition-colors"
          >
            <div
              className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[12px] font-bold text-black shrink-0"
              style={{ background: 'linear-gradient(135deg,var(--color-gold),#1A2E3F)' }}
              aria-hidden="true"
            >
              {profile?.initials || profile?.fullName?.trim()?.[0]?.toUpperCase() || ''}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-[14px] font-semibold truncate text-[var(--color-text-primary)]">
                {profile?.fullName || 'Loading…'}
              </div>
              <div
                className="text-[10px] uppercase truncate"
                style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', color: tierBadgeColor }}
              >
                {planLabel}
              </div>
            </div>
            <Settings className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" strokeWidth={1.6} />
          </button>

          {/* User dropdown menu (opens upward) */}
          {menuOpen && (
            <div className="absolute bottom-[68px] left-3 right-3 bg-[var(--color-bg-elevated)] rounded shadow-xl z-50 overflow-hidden border border-[var(--color-border-base)]">
              <div className="px-4 py-3 border-b border-[var(--color-border-base)]">
                <p className="text-[15px] font-medium text-[var(--color-text-primary)]">{profile?.fullName || 'User'}</p>
                <p className="text-[13px] text-[var(--color-text-muted)] truncate">{profile?.email || ''}</p>
              </div>
              <div className="py-1">
                <Link
                  href="/pricing"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-[15px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors"
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>Pricing</span>
                </Link>
                <a
                  href="/blog"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-[15px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Blog</span>
                </a>
              </div>
              <div className="border-t border-[var(--color-border-base)] py-1">
                <button
                  onClick={() => { setMenuOpen(false); handleLogout(); }}
                  disabled={loggingOut}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-[15px] text-[var(--color-negative)] hover:text-[var(--color-negative)] hover:bg-[var(--color-negative)]/5 transition-colors disabled:opacity-50"
                >
                  {loggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
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
        "ml-0 min-[1025px]:ml-[236px] flex flex-col flex-1 min-w-0 2xl:transition-[padding] 2xl:duration-200 2xl:ease-out",
        isChatPage ? "h-dvh overflow-hidden" : "min-h-dvh",
        showRail && "xl:pr-[var(--rail-w)]"
      )}>

        {/* ── Global Topbar ── */}
        {!isWrappedPage && (
          <header data-helm-topbar
            className="shrink-0 sticky top-0 z-30 flex items-center gap-3.5 px-[22px]"
          >
            {/* Hamburger (drawer toggle) — below 1025px only */}
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
              className="min-[1025px]:hidden w-[34px] h-[34px] flex items-center justify-center rounded-md border border-[var(--color-border-base)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] shrink-0"
            >
              {sidebarOpen ? <X size={16} /> : <Menu size={16} strokeWidth={1.8} />}
            </button>

            {/* Search / command button — opens the palette */}
            <button
              onClick={() => setPaletteOpen(true)}
              className="helm-command-trigger min-w-0 flex-1 max-w-[420px] flex items-center gap-2.5 h-[34px] px-3 rounded-md text-left text-[var(--color-text-muted)] transition-colors hover:border-[color-mix(in_srgb,var(--color-gold)_25%,transparent)]"
              style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-base)' }}
            >
              <Search size={14} strokeWidth={1.6} className="shrink-0" />
              <span className="flex-1 text-[14.5px] truncate">Search pages, tickers…</span>
              <span
                className="hidden md:inline-block text-[9px] px-1.5 py-0.5 rounded-[3px] shrink-0"
                style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', background: 'var(--color-surface-tint)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                CTRL + K
              </span>
            </button>

            <div className="helm-topbar-spacer flex-1" />

            {/* Conviction rail toggle (preserved, ultrawide-only entitled users) */}
            {showRail && (
              <ConvictionNavButton
                onClick={() => setMobileRailOpen(true)}
                className="xl:hidden flex items-center gap-2 h-[34px] px-3 rounded-md border border-[var(--color-border-base)] text-[var(--color-text-muted)] hover:text-[var(--color-gold)] transition-colors"
              />
            )}

            {/* Actions inbox. An unread indicator requires a real unread count. */}
            <Link
              href="/dashboard/actions"
              aria-label="Notifications"
              className="relative w-[34px] h-[34px] flex items-center justify-center rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors shrink-0 no-underline"
              style={{ background: 'transparent', border: '1px solid var(--color-border-base)' }}
            >
              <Bell size={15} strokeWidth={1.6} />
            </Link>

            {/* + ADD ACCOUNT gold CTA. ?add=1 opens the connect modal on the
                accounts page; as a bare link it did nothing once you were there. */}
            <Link
              href="/dashboard/accounts?add=1"
              aria-label="Add account"
              onClick={(e) => {
                if (pathname === '/dashboard/accounts') {
                  e.preventDefault();
                  window.dispatchEvent(new Event('helm:add-account'));
                }
              }}
              className="flex items-center gap-[7px] h-[34px] px-3.5 rounded-md text-[var(--color-bg-base)] uppercase no-underline transition-[filter] hover:brightness-110"
              style={{
                background: 'var(--color-gold)',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.12em',
                boxShadow: '0 4px 16px color-mix(in srgb, var(--color-gold) 20%, transparent)',
              }}
            >
              <Plus size={13} strokeWidth={2.2} />
              <span className="hidden sm:inline">Add account</span>
            </Link>
          </header>
        )}

        {/* ── Page Content ── */}
        <main id="main-content" className={cn(
          "bg-[var(--color-bg-base)] bg-depth flex-1",
          isChatPage && "min-h-0 flex flex-col"
        )}>
          <ConnectBanner />
          {/* Trial lifecycle strip — countdown, last-48h urgency, post-lapse receipt */}
          <TrialBanner />
          {/* Founding and Max tiers both retired. Free / Pro $20. */}
          {thesisEntitled && pathname !== '/dashboard/theses' && <ThesesWhatsNewBanner />}
          <div data-helm-page-content
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

      {/* ── Command palette (⌘K) ── */}
      {palettePanel}

      {/* ── Mobile Bottom Tab Bar (hidden on wrapped — full-screen experience) ── */}
      {!isWrappedPage && <MobileBottomNav />}

      {/* Dev-only: shows while lab impersonation is active, renders nothing in prod */}
      <LabImpersonationBanner />
    </div>
    </>
    </DemoProvider>
  );
}
