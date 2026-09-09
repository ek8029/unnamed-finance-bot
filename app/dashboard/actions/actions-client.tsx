'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw, CheckCircle2, ArrowRight, AlertCircle } from 'lucide-react';
import { useFormat } from '@/hooks/use-format';
import { usePreview } from '@/lib/preview-context';
import { tierAtLeast } from '@/lib/tier-shared';

/* ──────────────────────────────────────────────────
   Types
   ────────────────────────────────────────────────── */

export interface ActionItem {
  id: string;
  type: string;
  priority: string;
  title: string;
  description: string;
  recommended_action?: string;
  estimated_impact?: number;
  source: string;
  related_entity_type?: string | null;
  created_at: string;
  snoozed_until?: string | null;
  is_archived?: boolean;
  is_dismissed?: boolean;
  is_useful?: boolean;
  ticker?: string;
  thesisStatus?: 'intact' | 'weakening' | 'broken';
  thesisCite?: { excerpt: string; sourceTitle: string; sourceUrl: string | null; publishedAt: string | null; whatItMeans: string | null };
}

type ChipFilter = 'all' | 'risk' | 'tax' | 'cash';

/* ──────────────────────────────────────────────────
   Item classification
   ────────────────────────────────────────────────── */

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

// Priority label + the left-accent / glyph color used on basic cards.
const priorityMeta: Record<string, { label: string; color: string }> = {
  critical: { label: 'HIGH', color: 'var(--color-negative-text)' },
  high:     { label: 'HIGH', color: 'var(--color-negative-text)' },
  medium:   { label: 'MED',  color: 'var(--color-warning-text)' },
  low:      { label: 'LOW',  color: 'var(--color-text-muted)' },
};

function impactLabel(priority: string): string {
  if (priority === 'critical' || priority === 'high') return 'High';
  if (priority === 'medium') return 'Med';
  return 'Low';
}

// Filter-chip routing. Tax-loss/credit -> Tax, cash/spending -> Cash, everything
// risk-shaped (concentration, portfolio, earnings, market, drift) -> Risk.
const CHIP_TYPES: Record<Exclude<ChipFilter, 'all'>, string[]> = {
  risk: ['concentration', 'portfolio', 'performance', 'earnings', 'market', 'drift', 'rebalance'],
  tax:  ['tax', 'credit', 'filings'],
  cash: ['cash', 'spending', 'subscription'],
};

function matchesChip(action: ActionItem, chip: ChipFilter): boolean {
  if (chip === 'all') return true;
  return CHIP_TYPES[chip].includes(action.type);
}

// Pro-only intelligence: agentic investigations + shared-exposure / thesis-risk items.
// Named for the retired Max tier until Aug 2026; the gate has always been Pro.
// Shared-exposure rows are written with related_entity_type='thesis_risk'; agentic
// investigation rows carry 'investigation'. A title prefix is the fallback signal.
function isProItem(a: ActionItem): boolean {
  const ret = (a.related_entity_type || '').toLowerCase();
  if (ret === 'thesis_risk' || ret === 'investigation') return true;
  return /^(shared risk:|helm investigated)/i.test(a.title);
}

function maxKind(a: ActionItem): 'investigation' | 'shared' {
  const ret = (a.related_entity_type || '').toLowerCase();
  if (ret === 'investigation' || /^helm investigated/i.test(a.title)) return 'investigation';
  return 'shared';
}

const primaryCta: Record<string, string> = {
  tax: 'Review tax opportunities',
  credit: 'Review',
  filings: 'Review',
  cash: 'Review accounts',
  spending: 'Review activity',
  earnings: 'Review',
  market: 'Review',
  concentration: 'Model it',
  portfolio: 'Model it',
  performance: 'Review portfolio',
  drift: 'Model it',
  rebalance: 'Model it',
};

// Where each action's primary CTA takes the user — the surface that acts on it.
const ctaHref: Record<string, string> = {
  tax: '/dashboard/taxes',
  credit: '/dashboard/accounts',
  filings: '/dashboard/theses',
  cash: '/dashboard/accounts',
  spending: '/dashboard/transactions',
  earnings: '/dashboard/earnings',
  market: '/dashboard/brief',
  concentration: '/dashboard/portfolio/factors',
  portfolio: '/dashboard/portfolio/factors',
  performance: '/dashboard/portfolio',
  drift: '/dashboard/portfolio/factors',
  rebalance: '/dashboard/portfolio/factors',
};

/* ──────────────────────────────────────────────────
   Demo data
   ────────────────────────────────────────────────── */

const DEMO_ACTIONS: ActionItem[] = [
  { id: 'da-inv', type: 'concentration', priority: 'high', title: 'Helm investigated yesterday’s 4% drop across your semis', description: 'AMD’s MI300 guide triggered a sector-wide re-rate. Your NVDA and AVGO fell in sympathy, not on company news — the AI-infra thesis is intact, but the move was a shared-driver event.', source: 'ai_generated', related_entity_type: 'investigation', created_at: new Date().toISOString() },
  { id: 'da-risk', type: 'concentration', priority: 'high', title: 'Shared risk: 34% of your book rides a single driver', description: 'NVDA, AVGO, MSFT and two ETFs all depend on hyperscaler spend continuing. A capex pause would hit them together — your diversification is thinner than it looks.', source: 'ai_generated', related_entity_type: 'thesis_risk', created_at: new Date().toISOString() },
  { id: 'da-1', type: 'portfolio', priority: 'high', title: 'Trim NVDA to your 25% target', description: 'NVDA is 31% of the book. Selling ~$96k rebalances to plan and realizes long-term gains taxed at 15%.', estimated_impact: 96000, source: 'rule_based', created_at: new Date().toISOString() },
  { id: 'da-2', type: 'earnings', priority: 'medium', title: 'Hedge earnings week or size down', description: '31% of the book reports Oct 24–27. Options imply ±6.8% average. Consider trimming or a protective collar.', source: 'rule_based', created_at: new Date().toISOString() },
  { id: 'da-3', type: 'tax', priority: 'medium', title: 'Harvest $2,840 in losses', description: 'INTC and PYPL carry harvestable losses, conflict-free. Offsets realized gains and cuts ~$680 in tax.', estimated_impact: 680, source: 'rule_based', created_at: new Date().toISOString() },
  { id: 'da-4', type: 'cash', priority: 'low', title: 'Put $11,240 idle cash to work', description: 'Spread across 3 accounts earning 0.01%. A T-bill ladder yields ~5.1% — about $573/yr.', estimated_impact: 573, source: 'rule_based', created_at: new Date().toISOString() },
];

/* ──────────────────────────────────────────────────
   Component
   ────────────────────────────────────────────────── */

export function ActionsClient({ initialActions, isPro, initialError = null }: { initialActions: ActionItem[]; isPro: boolean; initialError?: string | null }) {
  void isPro; // server already stripped recommended_action for non-pro; per-item gating is tier-driven below
  const router = useRouter();
  const { formatCurrency } = useFormat();
  const { tier } = usePreview();
  // Distinct from the `isPro` prop above: that one is the server's view at
  // render time, this follows the preview tier so dev impersonation works.
  const entitled = tierAtLeast(tier, 'pro');

  // Demo mode (sessionStorage flag, set when exploring without a connection).
  const isDemo = typeof window !== 'undefined' && sessionStorage.getItem('helm_demo_mode') === '1';
  const effectiveActions = isDemo && initialActions.length === 0 ? DEMO_ACTIONS : initialActions;

  const [actions, setActions] = useState<ActionItem[]>(
    [...effectiveActions].sort((a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3))
  );
  const [chip, setChip] = useState<ChipFilter>('all');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [actionLoading, setActionLoading] = useState<Set<string>>(new Set());

  // A router refresh supplies new server props without remounting this component.
  useEffect(() => {
    if (initialError) {
      setError(initialError);
      return;
    }
    setActions([...(isDemo && initialActions.length === 0 ? DEMO_ACTIONS : initialActions)]
      .sort((a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)));
    setError(null);
  }, [initialActions, initialError, isDemo]);

  // Filtered + ordered: Pro-only intelligence cards float to the top, then basics by priority.
  const filtered = useMemo(() => {
    return actions
      .filter(a => matchesChip(a, chip))
      .sort((a, b) => {
        const am = isProItem(a) ? 0 : 1;
        const bm = isProItem(b) ? 0 : 1;
        if (am !== bm) return am - bm;
        return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
      });
  }, [actions, chip]);

  const openCount = useMemo(() => actions.filter(a => matchesChip(a, 'all')).length, [actions]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const generated = await fetch('/api/insights/generate', { method: 'POST' });
      if (!generated.ok) {
        throw new Error(generated.status === 429
          ? 'Analysis was refreshed recently. Please wait a few minutes before trying again.'
          : 'Could not refresh analysis. Please try again.');
      }
      const res = await fetch('/api/insights', { cache: 'no-store' });
      if (!res.ok) throw new Error('Could not load your saved actions. Please try again.');
      const data = await res.json();
      if (!Array.isArray(data.insights)) throw new Error('Could not load your saved actions. Please try again.');
      setActions(data.insights.sort(
        (a: ActionItem, b: ActionItem) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)
      ));
      // Invalidate prefetched page data so navigating back sees the saved results.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh analysis. Please try again.');
    } finally {
      setGenerating(false);
    }
  }, [router]);

  const handleAction = useCallback(async (id: string, action: string) => {
    setActionLoading(prev => new Set(prev).add(id));
    try {
      const res = await fetch('/api/insights', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      if (res.ok && ['dismiss', 'archive', 'useful', 'not_useful'].includes(action)) {
        setActions(prev => prev.filter(a => a.id !== id));
      }
    } finally {
      setActionLoading(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  if (error && actions.length === 0) {
    return (
      <div className="helm-detail-page helm-actions">
        <Header openCount={0} chip={chip} setChip={setChip} generating={generating} onGenerate={handleGenerate} />
        <div className="helm-detail-empty" role="alert">
          <div className="max-w-[460px] text-center">
            <AlertCircle className="w-7 h-7 mx-auto mb-5 text-[var(--color-warning-text)]" />
            <h2 className="text-[24px] font-bold text-[var(--color-text-primary)] mb-3">Your actions are unavailable.</h2>
            <p className="text-[15px] text-[var(--color-text-muted)]">{error}</p>
            <div className="helm-detail-empty-actions">
              <button type="button" onClick={() => router.refresh()} className="helm-button helm-button-outline">Retry loading actions</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const errorNotice = error ? <p role="alert" className="mb-5 rounded-lg border border-[var(--color-warning-text)]/30 p-4 text-sm text-[var(--color-warning-text)]">{error}</p> : null;

  /* ── All-clear empty state ────────────────────── */
  if (filtered.length === 0) {
    return (
      <div className="helm-detail-page helm-actions">
        <Header openCount={openCount} chip={chip} setChip={setChip} generating={generating} onGenerate={handleGenerate} />
        {errorNotice}
        <div className="helm-detail-empty">
          <div className="max-w-[460px] text-center">
            <div className="w-[60px] h-[60px] mx-auto mb-[22px] rounded-[14px] flex items-center justify-center bg-[color-mix(in_srgb,var(--color-positive)_6%,transparent)] border border-[var(--color-positive-border)]">
              <CheckCircle2 className="w-7 h-7" strokeWidth={1.6} style={{ color: 'var(--color-positive)' }} />
            </div>
            <h2 className="text-[24px] font-bold tracking-[-0.025em] text-[var(--color-text-primary)] mb-3">
              {chip === 'all' ? 'Nothing waiting for your review.' : `No ${chip} items right now.`}
            </h2>
            <p className="text-[15px] leading-[1.65] text-[var(--color-text-muted)]">
              {chip === 'all'
                ? 'Your portfolio review queue is empty. Add holdings to build your coverage, or refresh the analysis to check your current book.'
                : 'There are no items in this category. Check the full queue for other portfolio changes worth reviewing.'}
            </p>
            <div className="helm-detail-empty-actions">
              {chip === 'all'
                ? <a href="/dashboard/portfolio" className="helm-button helm-button-outline">Review portfolio <ArrowRight size={15} /></a>
                : <button type="button" onClick={() => setChip('all')} className="helm-button helm-button-outline">View all actions <ArrowRight size={15} /></button>}
              <a href="/dashboard/theses" className="helm-text-link">Review your theses <ArrowRight size={15} /></a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="helm-detail-page helm-actions">
      <Header openCount={openCount} chip={chip} setChip={setChip} generating={generating} onGenerate={handleGenerate} />
      {errorNotice}

      <div className="helm-action-queue" aria-label="Portfolio review queue">
        {filtered.map(action =>
          isProItem(action) ? (
            entitled ? (
              <ProCard key={action.id} action={action} />
            ) : (
              <ProTeaser key={action.id} action={action} />
            )
          ) : (
            <BasicCard
              key={action.id}
              action={action}
              loading={actionLoading.has(action.id)}
              onDismiss={() => handleAction(action.id, 'dismiss')}
              formatCurrency={formatCurrency}
            />
          )
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────
   Header (eyebrow + title + filter chips + Analyze)
   ────────────────────────────────────────────────── */

const CHIPS: { key: ChipFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'risk', label: 'Risk' },
  { key: 'tax', label: 'Tax' },
  { key: 'cash', label: 'Cash' },
];

function Header({
  openCount,
  chip,
  setChip,
  generating,
  onGenerate,
}: {
  openCount: number;
  chip: ChipFilter;
  setChip: (c: ChipFilter) => void;
  generating: boolean;
  onGenerate: () => void;
}) {
  return (
    <header className="helm-actions-header">
      <div className="helm-detail-heading">
        <div>
        <p className="helm-kicker">Portfolio intelligence / Actions</p>
        <h1 className="text-[26px] sm:text-[30px] font-bold tracking-[-0.025em] text-[var(--color-text-primary)] leading-tight">
          Worth your attention.
        </h1>
        <p>A focused queue of portfolio risks, tax opportunities, and cash decisions.</p>
        </div>
        <button
          onClick={onGenerate}
          disabled={generating}
          aria-label="Analyze now - refresh actions"
          className="helm-button helm-button-outline helm-button-small"
        >
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {generating ? 'Analyzing portfolio…' : 'Refresh analysis'}
        </button>
      </div>

      <div className="helm-actions-toolbar">
        <div className="helm-detail-tabs" role="group" aria-label="Filter actions">
          {CHIPS.map(c => {
            const active = chip === c.key;
            return (
              <button
                key={c.key}
                type="button"
                aria-pressed={active}
                onClick={() => setChip(c.key)}
                className="motion-safe:transition-colors"
              >
                {c.label}{c.key === 'all' && <span>{openCount}</span>}
              </button>
            );
          })}
        </div>
        <span>Investigations first, then priority</span>
      </div>
    </header>
  );
}

/* ──────────────────────────────────────────────────
   Basic action card (Risk / Tax / Cash) — always visible
   ────────────────────────────────────────────────── */

function BasicCard({
  action,
  loading,
  onDismiss,
  formatCurrency,
}: {
  action: ActionItem;
  loading: boolean;
  onDismiss: () => void;
  formatCurrency: (n: number) => string;
}) {
  const isStanding = action.source === 'standing';
  const meta = priorityMeta[action.priority] || priorityMeta.medium;
  const cta = isStanding ? 'Open Accounts' : (primaryCta[action.type] || 'Review');
  const href = isStanding ? '/dashboard/accounts' : (ctaHref[action.type] || '/dashboard/portfolio');
  const impactText =
    action.estimated_impact && action.estimated_impact > 0
      ? `Impact · ${formatCurrency(action.estimated_impact)}`
      : `Impact · ${impactLabel(action.priority)}`;

  return (
    <div
      className="helm-action-card"
      style={{ borderLeft: `2px solid ${meta.color}` }}
    >
      <span className="helm-action-priority" style={{ color: meta.color }}>
        {impactLabel(action.priority)} priority
      </span>

      <div className="flex-1 min-w-0">
        <h2 className="helm-action-title">{action.title}</h2>
        <p className="text-[14.5px] leading-[1.55] text-[var(--color-text-muted)]">{action.description}</p>
      </div>

      <div className="helm-action-controls">
        <span className="font-mono text-[10px] text-[var(--color-text-muted)] whitespace-nowrap" style={MONO}>
          {impactText}
        </span>
        <div className="flex gap-1.5">
          {!isStanding && (
            <button
              onClick={onDismiss}
              disabled={loading}
              aria-label="Dismiss this action"
              className="px-[11px] py-1.5 font-mono text-[9px] tracking-[0.08em] uppercase rounded border border-[var(--color-border-base)] bg-[var(--color-surface-tint-faint)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] motion-safe:transition-colors disabled:opacity-50"
              style={MONO}
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Dismiss'}
            </button>
          )}
          <a
            href={href}
            className="inline-flex items-center px-[11px] py-1.5 font-mono text-[9px] font-bold tracking-[0.08em] uppercase rounded border border-[var(--color-gold-border)] bg-[color-mix(in_srgb,var(--color-gold)_10%,transparent)] text-[var(--color-gold)] hover:bg-[color-mix(in_srgb,var(--color-gold)_16%,transparent)] motion-safe:transition-colors"
            style={MONO}
          >
            {cta}
          </a>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────
   Pro card (Investigation / Shared exposure)
   ────────────────────────────────────────────────── */

function ProCard({ action }: { action: ActionItem }) {
  const kind = maxKind(action);
  const badge = kind === 'investigation' ? 'Investigation' : 'Shared exposure';
  const ctaLabel = kind === 'investigation' ? 'View thesis' : 'Factor lens';
  const href = kind === 'investigation' ? '/dashboard/theses' : '/dashboard/portfolio/factors';

  return (
    <div
      className="helm-action-card helm-action-card-pro"
    >
      <span
        className="helm-action-priority text-[var(--color-gold)]"
      >
        {badge}
      </span>

      {/* min-width forces a wrap on narrow screens instead of a one-word-per-line column */}
      <div className="flex-1 min-w-[200px]">
        <h2 className="helm-action-title">{action.title}</h2>
        <p className="text-[14.5px] leading-[1.55] text-[var(--color-text-muted)]">{action.description}</p>
      </div>

      <div className="helm-action-controls">
        <span className="font-mono text-[10px]" style={{ ...MONO, color: 'var(--color-gold-hi)' }}>Pro</span>
        <a
          href={href}
          className="px-[11px] py-1.5 font-mono text-[9px] font-bold tracking-[0.08em] uppercase rounded border whitespace-nowrap motion-safe:transition-colors"
          style={{ ...MONO, color: 'var(--color-gold-hi)', background: 'rgba(255,214,122,0.1)', borderColor: 'rgba(255,214,122,0.28)' }}
        >
          {ctaLabel}
        </a>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────
   Pro teaser (free tier) — present but blurred + locked
   ────────────────────────────────────────────────── */

function ProTeaser({ action }: { action: ActionItem }) {
  const kind = maxKind(action);
  const tease =
    kind === 'investigation'
      ? 'Helm investigated a move across your book'
      : 'A shared-exposure risk spans several holdings';

  return (
    <div
      className="helm-action-card helm-action-card-pro helm-action-teaser"
    >
      <span
        className="helm-action-priority text-[var(--color-gold)]"
      >
        Pro intelligence
      </span>

      <div className="flex-1 min-w-0">
        <h2 className="helm-action-title">{tease}</h2>
        <p>See the underlying evidence and the holdings affected with Pro.</p>
      </div>

      <a
        href="/pricing"
        className="helm-text-link text-[var(--color-gold)]"
      >
        Explore Pro
        <ArrowRight className="w-3 h-3" />
      </a>
    </div>
  );
}
