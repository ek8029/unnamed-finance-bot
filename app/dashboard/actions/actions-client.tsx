'use client';

import { useState, useCallback, useMemo } from 'react';
import { Loader2, RefreshCw, CheckCircle2, ArrowRight } from 'lucide-react';
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
  risk: ['concentration', 'portfolio', 'earnings', 'market', 'drift', 'rebalance'],
  tax:  ['tax', 'credit', 'filings'],
  cash: ['cash', 'spending', 'subscription'],
};

function matchesChip(action: ActionItem, chip: ChipFilter): boolean {
  if (chip === 'all') return true;
  return CHIP_TYPES[chip].includes(action.type);
}

// Max-only intelligence: agentic investigations + shared-exposure / thesis-risk items.
// Shared-exposure rows are written with related_entity_type='thesis_risk'; agentic
// investigation rows carry 'investigation'. A title prefix is the fallback signal.
function isMaxItem(a: ActionItem): boolean {
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
  tax: 'Harvest',
  credit: 'Review',
  filings: 'Review',
  cash: 'Sweep',
  spending: 'Sweep',
  earnings: 'Review',
  market: 'Review',
  concentration: 'Model it',
  portfolio: 'Model it',
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

export function ActionsClient({ initialActions, isPro }: { initialActions: ActionItem[]; isPro: boolean }) {
  void isPro; // server already stripped recommended_action for non-pro; per-item gating is tier-driven below
  const { formatCurrency } = useFormat();
  const { tier } = usePreview();
  const isMax = tierAtLeast(tier, 'max');

  // Demo mode (sessionStorage flag, set when exploring without a connection).
  const isDemo = typeof window !== 'undefined' && sessionStorage.getItem('helm_demo_mode') === '1';
  const effectiveActions = isDemo && initialActions.length === 0 ? DEMO_ACTIONS : initialActions;

  const [actions, setActions] = useState<ActionItem[]>(
    [...effectiveActions].sort((a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3))
  );
  const [chip, setChip] = useState<ChipFilter>('all');
  const [generating, setGenerating] = useState(false);
  const [actionLoading, setActionLoading] = useState<Set<string>>(new Set());

  // Filtered + ordered: Max-only intelligence cards float to the top, then basics by priority.
  const filtered = useMemo(() => {
    return actions
      .filter(a => matchesChip(a, chip))
      .sort((a, b) => {
        const am = isMaxItem(a) ? 0 : 1;
        const bm = isMaxItem(b) ? 0 : 1;
        if (am !== bm) return am - bm;
        return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
      });
  }, [actions, chip]);

  const openCount = useMemo(() => actions.filter(a => matchesChip(a, 'all')).length, [actions]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      await fetch('/api/insights/generate', { method: 'POST' });
      const res = await fetch('/api/insights');
      if (res.ok) {
        const data = await res.json();
        setActions(
          (data.insights || []).sort(
            (a: ActionItem, b: ActionItem) =>
              (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)
          )
        );
      }
    } finally {
      setGenerating(false);
    }
  }, []);

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

  /* ── All-clear empty state ────────────────────── */
  if (filtered.length === 0) {
    return (
      <div className="px-5 py-6 md:px-7 md:pt-[26px] md:pb-[60px] max-w-[1100px] mx-auto">
        <Header openCount={openCount} chip={chip} setChip={setChip} generating={generating} onGenerate={handleGenerate} />
        <div className="min-h-[420px] flex items-center justify-center px-6 py-10">
          <div className="max-w-[460px] text-center">
            <div className="w-[60px] h-[60px] mx-auto mb-[22px] rounded-[14px] flex items-center justify-center bg-[rgba(74,222,128,0.06)] border border-[rgba(74,222,128,0.2)]">
              <CheckCircle2 className="w-7 h-7" strokeWidth={1.6} style={{ color: 'var(--color-positive)' }} />
            </div>
            <h2 className="text-[24px] font-bold tracking-[-0.025em] text-[var(--color-text-primary)] mb-3">
              You&apos;re all clear
            </h2>
            <p className="text-[15px] leading-[1.65] text-[var(--color-text-muted)]">
              No actions need your attention. Helm keeps watching your book and will rank anything worth doing here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 py-6 md:px-7 md:pt-[26px] md:pb-[60px] max-w-[1100px] mx-auto">
      <Header openCount={openCount} chip={chip} setChip={setChip} generating={generating} onGenerate={handleGenerate} />

      <div className="flex flex-col gap-3">
        {filtered.map(action =>
          isMaxItem(action) ? (
            isMax ? (
              <MaxCard key={action.id} action={action} />
            ) : (
              <MaxTeaser key={action.id} action={action} />
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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6 mb-5">
      <div>
        <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--color-text-muted)] mb-2" style={MONO}>
          Actions · {openCount} open · ranked by impact
        </div>
        <h1 className="text-[26px] sm:text-[30px] font-bold tracking-[-0.025em] text-[var(--color-text-primary)] leading-tight">
          Your next best moves
        </h1>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="flex gap-1.5 font-mono text-[10px] tracking-[0.06em] uppercase" style={MONO} role="tablist" aria-label="Filter actions">
          {CHIPS.map(c => {
            const active = chip === c.key;
            return (
              <button
                key={c.key}
                role="tab"
                aria-selected={active}
                onClick={() => setChip(c.key)}
                className={`px-3 py-[7px] rounded-[5px] motion-safe:transition-colors ${
                  active
                    ? 'bg-[var(--color-gold-surface)] text-[var(--color-gold)] border border-[var(--color-gold-border)]'
                    : 'border border-[var(--color-border-base)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        <button
          onClick={onGenerate}
          disabled={generating}
          aria-label="Analyze now - refresh actions"
          className="flex items-center gap-1.5 px-3 py-[7px] font-mono text-[10px] font-bold tracking-[0.06em] uppercase rounded-[5px] bg-[var(--color-gold)] hover:brightness-[1.06] text-black motion-safe:transition-all disabled:opacity-50"
          style={MONO}
        >
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">Analyze</span>
        </button>
      </div>
    </div>
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
  const meta = priorityMeta[action.priority] || priorityMeta.medium;
  const cta = primaryCta[action.type] || 'Review';
  const impactText =
    action.estimated_impact && action.estimated_impact > 0
      ? `Impact · ${formatCurrency(action.estimated_impact)}`
      : `Impact · ${impactLabel(action.priority)}`;

  return (
    <div
      className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] shadow-[var(--shadow-card)] px-5 py-[18px] flex gap-4 items-start motion-safe:transition-colors hover:border-[rgba(230,185,77,0.2)]"
      style={{ borderLeft: `2px solid ${meta.color}` }}
    >
      <span className="font-mono text-[9px] font-bold tracking-[0.12em] mt-[3px] min-w-[38px]" style={{ ...MONO, color: meta.color }}>
        {meta.label}
      </span>

      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-semibold text-[var(--color-text-primary)] mb-1">{action.title}</div>
        <p className="text-[14.5px] leading-[1.55] text-[var(--color-text-muted)]">{action.description}</p>
      </div>

      <div className="flex flex-col items-end gap-2 shrink-0">
        <span className="font-mono text-[10px] text-[var(--color-text-muted)] whitespace-nowrap" style={MONO}>
          {impactText}
        </span>
        <div className="flex gap-1.5">
          <button
            onClick={onDismiss}
            disabled={loading}
            aria-label="Dismiss this action"
            className="px-[11px] py-1.5 font-mono text-[9px] tracking-[0.08em] uppercase rounded border border-[var(--color-border-base)] bg-[rgba(255,255,255,0.03)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] motion-safe:transition-colors disabled:opacity-50"
            style={MONO}
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Dismiss'}
          </button>
          <a
            href={ctaHref[action.type] || '/dashboard/portfolio'}
            className="inline-flex items-center px-[11px] py-1.5 font-mono text-[9px] font-bold tracking-[0.08em] uppercase rounded border border-[var(--color-gold-border)] bg-[rgba(230,185,77,0.1)] text-[var(--color-gold)] hover:bg-[rgba(230,185,77,0.16)] motion-safe:transition-colors"
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
   Max card (Investigation / Shared exposure) — Max tier
   ────────────────────────────────────────────────── */

function MaxCard({ action }: { action: ActionItem }) {
  const kind = maxKind(action);
  const badge = kind === 'investigation' ? '✦ Investigation' : '✦ Shared exposure';
  const ctaLabel = kind === 'investigation' ? 'View thesis' : 'Factor lens';
  const href = kind === 'investigation' ? '/dashboard/theses' : '/dashboard/portfolio/factors';

  return (
    <div
      className="rounded-lg border border-[rgba(255,214,122,0.22)] bg-[rgba(255,214,122,0.03)] shadow-[var(--shadow-card)] px-5 py-[18px] flex gap-4 items-start flex-wrap sm:flex-nowrap"
      style={{ borderLeft: '2px solid #FFD67A' }}
    >
      <span
        className="font-mono text-[8px] font-bold tracking-[0.1em] uppercase mt-px px-[7px] py-[3px] rounded-[3px] whitespace-nowrap"
        style={{ ...MONO, background: 'rgba(255,214,122,0.12)', color: '#FFD67A' }}
      >
        {badge}
      </span>

      {/* min-width forces a wrap on narrow screens instead of a one-word-per-line column */}
      <div className="flex-1 min-w-[200px]">
        <div className="text-[15px] font-semibold text-[var(--color-text-primary)] mb-1">{action.title}</div>
        <p className="text-[14.5px] leading-[1.55] text-[var(--color-text-muted)]">{action.description}</p>
      </div>

      <div className="flex flex-col items-end gap-2 shrink-0">
        <span className="font-mono text-[10px]" style={{ ...MONO, color: '#FFD67A' }}>Max</span>
        <a
          href={href}
          className="px-[11px] py-1.5 font-mono text-[9px] font-bold tracking-[0.08em] uppercase rounded border whitespace-nowrap motion-safe:transition-colors"
          style={{ ...MONO, color: '#FFD67A', background: 'rgba(255,214,122,0.1)', borderColor: 'rgba(255,214,122,0.28)' }}
        >
          {ctaLabel}
        </a>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────
   Max teaser (below Max) — present but blurred + locked
   ────────────────────────────────────────────────── */

function MaxTeaser({ action }: { action: ActionItem }) {
  const kind = maxKind(action);
  const tease =
    kind === 'investigation'
      ? 'Helm investigated a move across your book'
      : 'A shared-exposure risk spans several holdings';

  return (
    <div
      className="rounded-lg border border-[rgba(255,214,122,0.18)] bg-[rgba(255,214,122,0.025)] px-5 py-4 flex gap-3.5 items-center"
      style={{ borderLeft: '2px solid #FFD67A' }}
    >
      <span
        className="font-mono text-[8px] font-bold tracking-[0.1em] px-[7px] py-[2px] rounded-[3px]"
        style={{ ...MONO, background: 'rgba(255,214,122,0.12)', color: '#FFD67A' }}
      >
        MAX
      </span>

      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-semibold text-[var(--color-text-primary)] mb-[7px]">{tease}</div>
        <div className="flex flex-col gap-1.5 select-none" style={{ filter: 'blur(3px)', opacity: 0.55 }} aria-hidden="true">
          <div className="h-2 w-[90%] rounded-[3px] bg-[rgba(255,255,255,0.08)]" />
          <div className="h-2 w-[72%] rounded-[3px] bg-[rgba(255,255,255,0.06)]" />
        </div>
      </div>

      <a
        href="/dashboard/settings"
        className="flex items-center gap-1 font-mono text-[9px] tracking-[0.08em] uppercase whitespace-nowrap motion-safe:transition-colors hover:brightness-110"
        style={{ ...MONO, color: '#FFD67A' }}
      >
        Unlock with Max
        <ArrowRight className="w-3 h-3" />
      </a>
    </div>
  );
}
