'use client';

// Value-first onboarding (Variant B). Replaces the tell-then-ask tour with a
// real value moment BEFORE the brokerage ask, then closes the second cliff
// (connected users who never find the thesis layer) by drafting starter theses
// on their own book.
//
//   welcome -> input -> scan -> card -> connect -> synced -> ratify -> done
//
// Everything is REAL: the scan runs the living-thesis engine on the typed
// ticker (GET /api/scan/ticker), the receipt is a verbatim approved catch, and
// the post-connect drafts come from /api/thesis/seed on the user's actual top
// holdings. Nothing on screen is fabricated (Delphia SEC AI-washing guardrail).
//
// Gated behind NEXT_PUBLIC_ONBOARDING_V2 in the dashboard layout; the legacy
// OnboardingFlow stays the default until the scan->link cohort reads positive.

import { useState, useEffect, useCallback } from 'react';
import posthog from 'posthog-js';
import { HelmMark } from '@/components/helm-mark';
import { useDemo } from '@/contexts/demo-context';
import { ArrowRight, PenLine, Check, ExternalLink, ShieldCheck, Lock, Building2, ChevronDown } from 'lucide-react';
import { ManualPortfolioForm } from '@/components/manual-portfolio-form';
import { PlaidLinkButton } from '@/components/plaid/plaid-link-button';
import { AnalysisLoadingTerminal } from '@/components/analysis-loading-terminal';
import { usePreview } from '@/lib/preview-context';
import { tierAtLeast, type Tier } from '@/lib/tier-shared';

const ONBOARDING_KEY = 'helm_onboarding_dismissed';
// Recognizable house names that currently carry live cited evidence (receipt cards).
// Names without a fresh catch still scan fine — they land on the "Watching" card.
const HOUSE_PICKS = ['NVDA', 'TSM', 'AVGO', 'MU', 'META', 'AAPL'];

function track(event: string, props?: Record<string, unknown>) {
  try { posthog.capture(event, props); } catch { /* posthog no-ops if uninitialized */ }
}

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

type Health = 'intact' | 'watch' | 'weakening' | 'broken' | 'unverified';

interface ScanResult {
  house: boolean;
  ticker: string;
  analyzePath?: string;
  company?: string;
  health?: Health;
  healthLabel?: string;
  asOfDate?: string | null;
  pillarCount?: number;
  catchCount?: number;
  pillar?: { claim: string; status: Health; statusLabel: string } | null;
  receipt?: { verbatimCite: string; dateISO: string; sourceLabel: string; sourceUrl: string | null; verdict: 'supports' | 'contradicts' } | null;
  pillars?: Array<{
    claim: string;
    breaksIf: string;
    status: Health;
    statusLabel: string;
    catches: Array<{ verbatimCite: string; dateISO: string; sourceLabel: string; sourceUrl: string | null; verdict: 'supports' | 'contradicts' }>;
  }>;
  error?: boolean;
}

/* health -> verdict chip (tone drives color; label is the on-card word) */
const VERDICT: Record<Health, { label: string; tone: 'green' | 'gold' | 'red' | 'muted' }> = {
  intact: { label: 'SUPPORTED', tone: 'green' },
  watch: { label: 'HOLDING', tone: 'gold' },
  weakening: { label: 'UNDER PRESSURE', tone: 'gold' },
  broken: { label: 'CHALLENGED', tone: 'red' },
  unverified: { label: 'WATCHING', tone: 'muted' },
};

const TONE_COLOR: Record<'green' | 'gold' | 'red' | 'muted', string> = {
  green: 'var(--color-positive)',
  gold: 'var(--color-gold)',
  red: 'var(--color-negative)',
  muted: 'var(--color-text-muted)',
};

/* An honest one-line read of the whole thesis, derived from computed health. */
function balanceLine(res: ScanResult): string {
  const t = res.ticker;
  switch (res.health) {
    case 'intact': return `On balance, ${t}'s core pillar is holding.`;
    case 'watch': return `On balance, ${t} is holding. One pillar is worth watching.`;
    case 'weakening': return `On balance, one of ${t}'s pillars is under pressure.`;
    case 'broken': return `A core pillar of the ${t} thesis just broke.`;
    default: return `Helm is watching the ${t} thesis for the next catch.`;
  }
}

interface RatifyDraft {
  ticker: string;
  name: string;
  thesisId: string;
  topClaim: string;
  moreCount: number;
  draftPillarIds: string[];
  confirmed: boolean;
}

// Same words, rendered in the /analyze loading-terminal style ([tag] step ✓).
const SCAN_TERMINAL_STEPS = [
  { tag: 'read', text: 'recent filings and news' },
  { tag: 'check', text: 'the thesis pillars' },
  { tag: 'weigh', text: 'the evidence' },
  { tag: 'find', text: 'the dated receipt' },
];

// What the agent does once it's watching — the platform/agentic primer.
// Labelled like a capability sheet rather than an icon list: the label doubles as
// the name of the surface it maps to, so the primer teaches the product.
const AGENT_JOBS = [
  { label: 'Monitoring', text: 'Watches every position for what moved, and why' },
  { label: 'Taxes', text: 'Finds tax-loss harvesting across all of your accounts' },
  { label: 'Earnings', text: 'Warns you ahead of earnings that hit your book' },
  { label: 'Thesis', text: 'Tracks the reasons you own each position and flags the moment one breaks' },
];

// Per-tier unlocks — copy mirrors the real gates in lib/tier.ts. The strip
// highlights the previewed tier (usePreview), so the free/pro dev toggle
// demos the differences and prod shows the user's real entitlement.
const TIERS: { key: Tier; name: string; price: string; unlocks: string[] }[] = [
  { key: 'free', name: 'Free', price: '$0', unlocks: ['Every account in one place', '5 AI analyses a day', 'Daily market brief'] },
  { key: 'pro', name: 'Pro', price: '$20/mo', unlocks: ['Thesis tracking', 'Tax-loss harvesting', 'Earnings watch', 'The agent, watching every position'] },
];

// Preview mode (?onbv2preview=1 or the /testing/onboarding harness): forces the
// overlay to show on ANY account, including one that already has a brokerage
// connected, and walks the whole flow WITHOUT A SINGLE WRITE.
//
// Everything shown is REAL: the scan hits the live engine, the synced counts come
// from /api/financial-summary, and the ratify rows come from the account's actual
// theses and pillars via GET /api/thesis. Only the mutations are suppressed —
// Confirm flips local state instead of PATCHing, so a reviewer can exercise every
// screen on their own account without touching their data.
//
// Falls back to a clearly-labelled sample only when the account has no theses yet.
const PREVIEW_FALLBACK: RatifyDraft[] = [
  { ticker: 'NVDA', name: 'sample', thesisId: 'sample-nvda', topClaim: 'Hyperscaler AI capex keeps growing and NVIDIA keeps the majority of accelerator spend', moreCount: 2, draftPillarIds: [], confirmed: false },
  { ticker: 'MSFT', name: 'sample', thesisId: 'sample-msft', topClaim: 'Azure reaccelerates as AI workloads move to the cloud', moreCount: 1, draftPillarIds: [], confirmed: false },
  { ticker: 'AAPL', name: 'sample', thesisId: 'sample-aapl', topClaim: 'Services keeps compounding and lifts gross margin', moreCount: 1, draftPillarIds: [], confirmed: false },
];

type Phase = 'welcome' | 'input' | 'scan' | 'card' | 'howItWorks' | 'connect' | 'manual' | 'synced' | 'ratify' | 'done';

/** `harness` is the /testing/onboarding review surface: forces preview (no writes),
 *  skips the no-connection gate, and lets a reviewer jump straight to any screen. */
export function OnboardingFlowV2({ harness, jumpTo }: { harness?: boolean; jumpTo?: Phase } = {}) {
  const { enableDemo } = useDemo();
  const { tier } = usePreview(); // dev: driven by the free/pro/max toggle; prod: real entitlement
  const [show, setShow] = useState(false);
  const [phase, setPhase] = useState<Phase>(jumpTo ?? 'welcome');
  // Plaid exchange failures were silent — the modal closed and nothing happened.
  const [linkError, setLinkError] = useState<string | null>(null);
  const [hasPlaid, setHasPlaid] = useState<boolean | null>(harness ? false : null);
  const [preview, setPreview] = useState(!!harness);

  const [ticker, setTicker] = useState('');
  const [scan, setScan] = useState<ScanResult | null>(null);

  const [syncCounts, setSyncCounts] = useState<{ accounts: number; holdings: number } | null>(null);
  const [drafts, setDrafts] = useState<RatifyDraft[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  // Harness drives phase from the toolbar.
  useEffect(() => { if (jumpTo) setPhase(jumpTo); }, [jumpTo]);

  // Jumping straight to a screen skips whatever produced its data, so the screen
  // would render empty. Backfill the prerequisite instead of showing a blank.
  useEffect(() => {
    if (!harness) return;
    if (phase === 'card' && !scan) { setTicker((t) => t || 'NVDA'); setPhase('scan'); }
    // Landing on 'scan' with no ticker would fetch ?symbol= and 400.
    if (phase === 'scan' && !ticker) setTicker('NVDA');
  }, [harness, phase, scan, ticker]);

  useEffect(() => {
    if (harness) { setShow(true); return; }
    // Preview override: show on any account, write nothing.
    if (new URLSearchParams(window.location.search).get('onbv2preview') === '1') {
      setPreview(true);
      setHasPlaid(false);
      setShow(true);
      return;
    }
    const dismissed = localStorage.getItem(ONBOARDING_KEY) === '1' || sessionStorage.getItem(ONBOARDING_KEY) === '1';
    if (dismissed) return;
    fetch('/api/financial-summary')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.hasPlaidConnection) {
          localStorage.setItem(ONBOARDING_KEY, '1');
        } else {
          setHasPlaid(false);
          setShow(true);
          track('onb_v2_shown');
        }
      })
      .catch(() => {});
  }, []);

  // welcome auto-advance
  useEffect(() => {
    if (!show || phase !== 'welcome') return;
    const t = setTimeout(() => setPhase('input'), 1600);
    return () => clearTimeout(t);
  }, [show, phase]);

  // scan: run the real engine while the /analyze-style terminal plays (~2.4s floor)
  useEffect(() => {
    if (phase !== 'scan') return;
    // No ticker yet (harness jumped straight here): wait for it rather than
    // firing ?symbol= and taking a 400. Re-runs when ticker lands.
    if (!ticker) return;
    let cancelled = false;
    const t0 = Date.now();
    setScan(null);

    fetch(`/api/scan/ticker?symbol=${encodeURIComponent(ticker)}`)
      .then((r) => r.json())
      .then((res: ScanResult) => {
        if (cancelled) return;
        setScan(res);
        track('onb_scan_completed', { ticker, house: !!res.house, health: res.health ?? null });
        const wait = Math.max(0, 2400 - (Date.now() - t0));
        setTimeout(() => { if (!cancelled) { setPhase('card'); track('onb_card_viewed', { ticker, house: !!res.house }); } }, wait);
      })
      .catch(() => {
        if (cancelled) return;
        setScan({ house: false, ticker, error: true });
        setTimeout(() => { if (!cancelled) setPhase('card'); }, 700);
      });

    return () => { cancelled = true; };
  }, [phase, ticker]);

  const startScan = useCallback((raw: string) => {
    const t = raw.trim().toUpperCase();
    if (!/^[A-Z.\-]{1,10}$/.test(t)) return;
    setTicker(t);
    setShowAll(false);
    track('onb_ticker_entered', { ticker: t });
    setPhase('scan');
  }, []);

  function dismiss(reload: boolean) {
    if (!preview) {
      localStorage.setItem(ONBOARDING_KEY, '1');
      sessionStorage.setItem(ONBOARDING_KEY, '1');
    }
    if (reload && !preview) { window.location.href = '/dashboard'; return; }
    setShow(false);
  }

  function handleDemo() {
    track('onb_demo_chosen');
    setPhase('done');
    setTimeout(() => { if (!preview) { enableDemo(); sessionStorage.setItem(ONBOARDING_KEY, '1'); } setShow(false); }, 1100);
  }

  function handleConnected() {
    track('onb_link_completed');
    setPhase('synced');
  }

  // synced: pull real counts + top holdings, draft starter theses on the top 3.
  useEffect(() => {
    // Also runs when the harness jumps straight to 'ratify' with no drafts loaded.
    const needsData = phase === 'synced' || (harness && phase === 'ratify' && !drafts);
    if (!needsData) return;
    let cancelled = false;

    // Preview: real reads, zero writes. Show the reviewer's own accounts/holdings
    // and their own drafted theses rather than invented rows.
    if (preview) {
      (async () => {
        try {
          const [sum, th] = await Promise.all([
            fetch('/api/financial-summary').then((r) => (r.ok ? r.json() : null)).catch(() => null),
            fetch('/api/thesis').then((r) => (r.ok ? r.json() : null)).catch(() => null),
          ]);
          if (cancelled) return;

          setSyncCounts({
            accounts: Array.isArray(sum?.accounts) ? sum.accounts.length : 0,
            holdings: Array.isArray(sum?.holdings) ? sum.holdings.length : 0,
          });

          const theses: Array<{ id: string; ticker: string; pillars?: Array<{ id: string; claim: string; confirmed: boolean; origin: string; lifecycle: string }> }> =
            Array.isArray(th?.theses) ? th.theses : [];
          const real: RatifyDraft[] = theses
            .map((t) => {
              const live = (t.pillars ?? []).filter((p) => p.lifecycle !== 'dismissed');
              const drafts = live.filter((p) => p.origin === 'ai_draft' && !p.confirmed);
              const top = drafts[0] ?? live[0];
              if (!top) return null;
              return {
                ticker: t.ticker,
                name: t.ticker,
                thesisId: t.id,
                topClaim: top.claim,
                moreCount: Math.max(0, live.length - 1),
                draftPillarIds: [],                       // never PATCHed in preview
                confirmed: drafts.length === 0,           // reflect real confirmed state
              } as RatifyDraft;
            })
            .filter(Boolean)
            .slice(0, 3) as RatifyDraft[];

          setDrafts(real.length > 0 ? real : PREVIEW_FALLBACK.map((d) => ({ ...d })));
          setTimeout(() => { if (!cancelled) setPhase((cur) => (cur === 'ratify' ? cur : 'ratify')); }, 900);
        } catch {
          if (!cancelled) { setDrafts(PREVIEW_FALLBACK.map((d) => ({ ...d }))); setPhase('ratify'); }
        }
      })();
      return () => { cancelled = true; };
    }

    (async () => {
      try {
        const sum = await fetch('/api/financial-summary').then((r) => (r.ok ? r.json() : null));
        if (cancelled || !sum) { setPhase('done'); return; }
        const accounts: unknown[] = Array.isArray(sum.accounts) ? sum.accounts : [];
        const holdings: Array<{ ticker: string; total_value: number; securities?: { security_name?: string } }> =
          Array.isArray(sum.holdings) ? sum.holdings : [];
        setSyncCounts({ accounts: accounts.length, holdings: holdings.length });

        // aggregate lots -> position value, pick the top 3 names
        const byTicker = new Map<string, { value: number; name: string }>();
        for (const h of holdings) {
          const prev = byTicker.get(h.ticker);
          byTicker.set(h.ticker, {
            value: (prev?.value ?? 0) + Number(h.total_value ?? 0),
            name: prev?.name ?? h.securities?.security_name ?? h.ticker,
          });
        }
        const top = [...byTicker.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, 3);
        if (top.length === 0) { setPhase('done'); return; }

        // draft a starter thesis per top holding (real gpt-4o drafts, left unconfirmed)
        const built: RatifyDraft[] = [];
        for (const [tk, meta] of top) {
          try {
            const res = await fetch('/api/thesis/seed', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ticker: tk }),
            });
            if (res.status === 404) { setPhase('done'); return; } // no thesis access -> skip cliff-2 honestly
            if (!res.ok) continue;
            const data = await res.json();
            const pillars: Array<{ id: string; claim: string; origin: string; confirmed: boolean; lifecycle: string }> =
              Array.isArray(data.pillars) ? data.pillars : [];
            const draftPillars = pillars.filter((p) => p.origin === 'ai_draft' && !p.confirmed && p.lifecycle !== 'dismissed');
            const confirmedAlready = pillars.some((p) => p.confirmed && p.lifecycle !== 'dismissed');
            if (draftPillars.length === 0 && !confirmedAlready) continue;
            built.push({
              ticker: tk,
              name: meta.name,
              thesisId: String(data.thesis?.id ?? tk),
              topClaim: draftPillars[0]?.claim ?? pillars.find((p) => p.confirmed)?.claim ?? '',
              moreCount: Math.max(0, draftPillars.length - 1),
              draftPillarIds: draftPillars.map((p) => p.id),
              confirmed: draftPillars.length === 0 && confirmedAlready,
            });
          } catch { /* skip this ticker */ }
        }
        if (cancelled) return;
        if (built.length === 0) { setPhase('done'); return; }
        setDrafts(built);
        setTimeout(() => { if (!cancelled) setPhase('ratify'); }, 900);
      } catch {
        if (!cancelled) setPhase('done');
      }
    })();

    return () => { cancelled = true; };
  }, [phase, preview, harness, drafts]);

  async function confirmDraft(d: RatifyDraft) {
    if (busy || d.confirmed) return;
    if (preview) {
      track('onb_thesis_confirmed', { ticker: d.ticker, preview: true });
      setDrafts((prev) => prev?.map((x) => (x.ticker === d.ticker ? { ...x, confirmed: true } : x)) ?? null);
      return;
    }
    setBusy(d.ticker);
    try {
      for (const id of d.draftPillarIds) {
        await fetch(`/api/thesis/pillars/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmed: true }),
        });
      }
      // Tracking is what the cron actually scans, and free tier caps it at one.
      // A silent 403 would leave the user believing all three are being watched.
      const tr = await fetch(`/api/thesis/${d.ticker}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracked: true }),
      });
      if (tr.status === 403) {
        setNote(`${d.ticker} is confirmed. Watching every position is part of Pro, so only your first thesis is being monitored for now.`);
      }
      track('onb_thesis_confirmed', { ticker: d.ticker, tracked: tr.ok });
      setDrafts((prev) => prev?.map((x) => (x.ticker === d.ticker ? { ...x, confirmed: true } : x)) ?? null);
    } catch {
      setNote(`Could not confirm ${d.ticker}. You can try again from the Theses page.`);
    } finally {
      setBusy(null);
    }
  }

  async function confirmAll() {
    const pending = drafts?.filter((d) => !d.confirmed) ?? [];
    for (const d of pending) await confirmDraft(d);
    dismiss(true);
  }

  if (!show || hasPlaid !== false) return null;

  const chip = scan?.house && scan.health ? VERDICT[scan.health] : null;

  const renderPillar = (p: NonNullable<ScanResult['pillars']>[number], i: number) => {
    const pc = VERDICT[p.status];
    return (
      <div key={i} className="border-l-2 border-[var(--color-border-strong)] pl-3.5">
        <div className="flex items-baseline gap-2">
          <p className="text-[16px] leading-[1.45] text-[var(--color-text-secondary)] m-0 flex-1 min-w-0">{p.claim}</p>
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] shrink-0" style={{ ...MONO, color: TONE_COLOR[pc.tone] }}>{pc.label}</span>
        </div>
        {p.breaksIf && (
          <p className="mt-1.5 text-[13.5px] leading-[1.5] text-[var(--color-text-muted)] m-0">
            <span className="text-[var(--color-gold)] uppercase tracking-[0.08em] text-[11px]" style={MONO}>Breaks if </span>{p.breaksIf}
          </p>
        )}
        {p.catches.map((c, j) => (
          <div key={j} className="mt-2.5 pl-3 border-l-2" style={{ borderColor: c.verdict === 'contradicts' ? 'var(--color-negative)' : 'var(--color-positive)' }}>
            <p className="text-[15px] leading-[1.55] text-[var(--color-text-secondary)] m-0">&ldquo;{c.verbatimCite}&rdquo;</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[11.5px] text-[var(--color-text-muted)]" style={MONO}>{c.sourceLabel} · {c.dateISO}</span>
              {c.sourceUrl && (
                <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11.5px] text-[var(--color-gold)] hover:brightness-110" style={MONO}>source <ExternalLink className="w-3 h-3" /></a>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <style jsx global>{`
        @keyframes onb-fade-up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes onb-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes onb-progress { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes onb-check { from { stroke-dashoffset: 30; } to { stroke-dashoffset: 0; } }
        @keyframes onb-scanline { 0% { transform: translateY(-100%); } 100% { transform: translateY(400%); } }
        @media (prefers-reduced-motion: reduce) {
          @keyframes onb-fade-up { from, to { opacity: 1; transform: none; } }
          @keyframes onb-fade-in { from, to { opacity: 1; } }
          @keyframes onb-progress { from, to { transform: scaleX(1); } }
          @keyframes onb-scanline { from, to { transform: translateY(150%); } }
        }
      `}</style>

      <div className="fixed inset-0 z-[100] bg-[#050505] overflow-y-auto overscroll-contain">
        <div className="min-h-[100dvh] flex flex-col">
          <div className="pointer-events-none fixed inset-0 opacity-[0.03]" style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(230,185,77,0.4) 0.5px, transparent 0)',
            backgroundSize: '32px 32px',
          }} />
          <div className="pointer-events-none fixed top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--color-gold)]/20 to-transparent" />
          {preview && (
            <div className="fixed top-0 inset-x-0 z-[110] bg-[var(--color-gold)] text-black text-center text-[10.5px] font-semibold uppercase tracking-[0.16em] py-1.5" style={MONO}>
              Preview · nothing is saved to your account
            </div>
          )}

          {/* ═══ WELCOME ═══ */}
          {phase === 'welcome' && (
            <div className="flex-1 grid place-items-center px-6" style={{ animation: 'onb-fade-up 0.7s ease-out' }}>
              <div className="relative text-center space-y-9 max-w-2xl">
                <div className="flex justify-center"><HelmMark size={76} /></div>
                <div>
                  <h1 className="text-[clamp(34px,7vw,60px)] tracking-tight text-[var(--color-text-primary)] leading-[1.05]"
                    style={{ fontFamily: 'var(--font-display-serif)' }}>
                    Point Helm at something you own.
                  </h1>
                  <p className="text-[14px] sm:text-[15px] text-[var(--color-text-muted)] mt-4 uppercase tracking-[0.18em]" style={MONO}>
                    No brokerage connection needed
                  </p>
                </div>
                <div className="max-w-[260px] mx-auto">
                  <div className="h-[3px] bg-[var(--color-border-base)] rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--color-gold)] rounded-full"
                      style={{ transformOrigin: 'left', animation: 'onb-progress 1.4s ease-in-out forwards' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ INPUT ═══ */}
          {phase === 'input' && (
            <div className="flex-1 flex flex-col justify-center px-5 sm:px-8 py-10" style={{ animation: 'onb-fade-up 0.5s ease-out' }}>
              <div className="max-w-xl mx-auto w-full">
                <h2 className="text-[clamp(26px,5vw,40px)] font-bold tracking-tight text-[var(--color-text-primary)] leading-[1.1]">
                  What are you watching?
                </h2>
                <p className="text-[15px] sm:text-[16px] text-[var(--color-text-muted)] mt-3 leading-relaxed">
                  Type a ticker you hold or follow. Helm reads the filings so you don&apos;t have to.
                </p>

                <form
                  className="mt-7"
                  onSubmit={(e) => { e.preventDefault(); startScan(ticker || 'NVDA'); }}
                >
                  <div className="flex items-center gap-2 rounded-md border border-[var(--color-border-strong)] bg-[#0B0B0B] px-4 h-[58px] focus-within:border-[var(--color-gold-border)] transition-colors">
                    <span className="text-[var(--color-gold)] text-[18px]" style={MONO}>›</span>
                    <input
                      autoFocus
                      value={ticker}
                      onChange={(e) => setTicker(e.target.value.toUpperCase().replace(/[^A-Z.\-]/g, '').slice(0, 10))}
                      placeholder="NVDA"
                      inputMode="text"
                      autoCapitalize="characters"
                      className="flex-1 bg-transparent outline-none text-[20px] tracking-[0.12em] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/40"
                      style={MONO}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3">
                    {HOUSE_PICKS.map((t) => (
                      <button
                        key={t} type="button" onClick={() => setTicker(t)}
                        className={`px-3 h-[34px] rounded-full border text-[12px] tracking-[0.1em] transition-colors ${
                          ticker === t
                            ? 'border-[var(--color-gold-border)] bg-[var(--color-gold-surface)] text-[var(--color-gold)]'
                            : 'border-[var(--color-border-base)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                        }`}
                        style={MONO}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={!/^[A-Z.\-]{1,10}$/.test((ticker || 'NVDA'))}
                    className="mt-6 w-full flex items-center justify-center gap-2 h-[52px] bg-[var(--color-gold)] text-black text-[15px] font-semibold rounded-md hover:brightness-110 transition-all disabled:opacity-40"
                  >
                    Scan {ticker || 'NVDA'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <p className="text-center text-[12px] text-[var(--color-text-muted)] mt-3 uppercase tracking-[0.14em]" style={MONO}>
                    No brokerage connection. Nothing to link.
                  </p>
                </form>
              </div>
            </div>
          )}

          {/* ═══ SCAN — /analyze-style loading terminal ═══ */}
          {phase === 'scan' && (
            <div className="flex-1 grid place-items-center px-6" style={{ animation: 'onb-fade-in 0.4s ease-out' }}>
              <div className="w-full max-w-lg flex flex-col items-center">
                <HelmMark size={56} />
                <div className="mt-7 w-full flex justify-center">
                  <AnalysisLoadingTerminal command={`helm scan ${ticker}`} steps={SCAN_TERMINAL_STEPS} />
                </div>
              </div>
            </div>
          )}

          {/* ═══ CARD — the aha ═══ */}
          {phase === 'card' && scan && (
            <>
              <div className="flex-1 overflow-y-auto flex flex-col px-5 sm:px-8 pt-[max(40px,env(safe-area-inset-top))] pb-6" style={{ animation: 'onb-fade-up 0.5s ease-out' }}>
                <div className="max-w-xl mx-auto w-full my-auto py-4">
                  {scan.house && scan.pillar ? (
                    <>
                      <div className="flex items-center gap-2.5 mb-4">
                        <span className="w-2 h-2 rounded-full" style={{ background: chip ? TONE_COLOR[chip.tone] : 'var(--color-text-muted)' }} />
                        <span className="text-[12px] font-semibold uppercase tracking-[0.18em]" style={{ ...MONO, color: chip ? TONE_COLOR[chip.tone] : 'var(--color-text-muted)' }}>
                          {chip?.label ?? scan.healthLabel} · {scan.ticker}
                        </span>
                      </div>

                      <h2 className="text-[clamp(24px,4.5vw,34px)] leading-[1.15] text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-display-serif)' }}>
                        {balanceLine(scan)}
                      </h2>

                      {scan.receipt ? (
                        <>
                          <div className="mt-6 rounded-md border border-[var(--color-border-base)] bg-[#0B0B0B] p-4">
                            <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)] mb-2" style={MONO}>
                              The reason you&apos;d own it
                            </div>
                            <p className="text-[15.5px] leading-[1.5] text-[var(--color-text-secondary)] m-0">{scan.pillar.claim}</p>
                          </div>
                          {(() => {
                            const challenges = scan.receipt!.verdict === 'contradicts';
                            const tone = challenges ? 'var(--color-negative)' : 'var(--color-positive)';
                            return (
                          <div className="mt-3 rounded-md border-l-2 p-4" style={{ borderColor: tone, background: challenges ? 'rgba(239,68,68,0.05)' : 'rgba(74,222,128,0.05)' }}>
                            <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] mb-2.5" style={{ ...MONO, color: tone }}>
                              {challenges ? 'Evidence against this pillar' : 'Evidence supporting this pillar'}
                            </div>
                            <p className="text-[17px] sm:text-[18px] leading-[1.55] font-medium text-[var(--color-text-primary)] m-0">
                              &ldquo;{scan.receipt!.verbatimCite}&rdquo;
                            </p>
                            <p className="mt-2.5 text-[13.5px] leading-[1.5] text-[var(--color-text-muted)] m-0">
                              {challenges
                                ? `Helm read this as cutting against the pillar above, which is why ${scan.ticker} is not showing as fully supported.`
                                : 'Helm read this as backing the pillar above.'}
                            </p>
                            <div className="flex items-center gap-2 mt-3">
                              <span className="text-[11.5px] text-[var(--color-text-muted)]" style={MONO}>{scan.receipt!.sourceLabel} · {scan.receipt!.dateISO}</span>
                              {scan.receipt!.sourceUrl && (
                                <a href={scan.receipt!.sourceUrl!} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11.5px] text-[var(--color-gold)] hover:brightness-110" style={MONO}>
                                  source <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </div>
                            );
                          })()}
                          {(scan.pillars?.length ?? 0) > 1 && !showAll && (
                            <button onClick={() => setShowAll(true)}
                              className="mt-3 flex items-center gap-1.5 text-[12.5px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors min-h-[36px]" style={MONO}>
                              See all {scan.pillars!.length} pillars and evidence <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {showAll && scan.pillars && (
                            <div className="mt-3 rounded-md border border-[var(--color-border-base)] bg-[#0B0B0B] p-4">
                              <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)] mb-3.5" style={MONO}>
                                All {scan.pillars.length} pillars Helm watches on {scan.ticker}
                              </div>
                              <div className="space-y-4">{scan.pillars.map(renderPillar)}</div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="mt-6 rounded-md border border-[var(--color-border-base)] bg-[#0B0B0B] p-4">
                          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)] mb-3.5" style={MONO}>
                            What Helm is watching on {scan.ticker}
                          </div>
                          <div className="space-y-4">
                            {(scan.pillars ?? [{ claim: scan.pillar.claim, breaksIf: '', status: scan.pillar.status, statusLabel: scan.pillar.statusLabel, catches: [] }]).map(renderPillar)}
                          </div>
                          <p className="mt-4 text-[12.5px] text-[var(--color-text-muted)] leading-relaxed">
                            No filing or news has moved these yet. Helm checks every trading day and shows you the receipt the moment one does.
                          </p>
                        </div>
                      )}

                      <p className="mt-6 text-[13.5px] text-[var(--color-text-muted)] leading-relaxed" style={MONO}>
                        Helm just did this on one ticker. Connect once and it watches every position you hold.
                      </p>
                    </>
                  ) : (
                    /* off-house / error — honest, never a fake thesis */
                    <>
                      <div className="flex items-center gap-2.5 mb-4">
                        <span className="w-2 h-2 rounded-full bg-[var(--color-text-muted)]" />
                        <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]" style={MONO}>
                          {scan.ticker}
                        </span>
                      </div>
                      <h2 className="text-[clamp(22px,4.5vw,32px)] leading-[1.15] text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-display-serif)' }}>
                        {scan.error ? 'Could not reach the scanner.' : `Helm isn't tracking a living thesis on ${scan.ticker} yet.`}
                      </h2>
                      <p className="mt-4 text-[15px] leading-[1.6] text-[var(--color-text-secondary)]">
                        {scan.error
                          ? 'You can still connect your book and Helm will start watching your positions.'
                          : `Read Helm's full analysis of ${scan.ticker} on Analyze, or connect your brokerage and Helm will build a watched thesis on the names you actually hold.`}
                      </p>
                      {!scan.error && scan.analyzePath && (
                        <a href={scan.analyzePath} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 mt-4 text-[14px] text-[var(--color-gold)] hover:brightness-110" style={MONO}>
                          Read the {scan.ticker} analysis <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="shrink-0 sticky bottom-0 bg-[#050505]/92 backdrop-blur-md border-t border-[var(--color-border-base)] px-5 sm:px-8 py-4" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
                <div className="flex items-center justify-between max-w-xl mx-auto gap-4">
                  <button onClick={() => setPhase('input')} className="text-[14px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors min-h-[44px]" style={MONO}>
                    Scan another
                  </button>
                  <button onClick={() => setPhase('howItWorks')}
                    className="flex items-center gap-2 px-6 min-h-[48px] bg-[var(--color-gold)] text-black text-[15px] font-semibold rounded-md hover:brightness-110 transition-all">
                    Watch my whole book <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ═══ HOW IT WORKS — platform / agent / thesis primer + tier strip ═══ */}
          {phase === 'howItWorks' && (
            <>
              <div className="flex-1 overflow-y-auto flex flex-col px-5 sm:px-8 pt-[max(48px,env(safe-area-inset-top))] pb-6" style={{ animation: 'onb-fade-up 0.5s ease-out' }}>
                <div className="max-w-xl mx-auto w-full my-auto py-4">
                  <h2 className="text-[clamp(24px,5vw,34px)] font-bold tracking-tight text-[var(--color-text-primary)] leading-[1.1]">
                    How Helm works
                  </h2>
                  <p className="text-[15px] text-[var(--color-text-muted)] mt-3 leading-relaxed">
                    Connect your accounts and Helm runs an agent on every position you hold. It does the watching so you don&apos;t have to.
                  </p>

                  <div className="mt-6 border-b border-[var(--color-border-subtle)]">
                    {AGENT_JOBS.map(({ label, text }) => (
                      <div key={label} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 py-2.5 border-t border-[var(--color-border-subtle)]">
                        <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--color-gold)] sm:w-[92px] shrink-0" style={MONO}>
                          {label}
                        </span>
                        <span className="text-[15px] text-[var(--color-text-secondary)] leading-snug">{text}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-[13.5px] text-[var(--color-text-muted)] leading-relaxed" style={MONO}>
                    ...and writes it into a short daily brief.
                  </p>

                  {/* Tier strip — highlights the previewed tier (free/pro/max toggle demos it) */}
                  <div className="mt-8">
                    <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)] mb-3" style={MONO}>
                      What each plan unlocks
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {TIERS.map((t) => {
                        const current = t.key === tier;
                        return (
                          <div key={t.key}
                            className={`rounded-md border p-3.5 ${current ? 'border-[var(--color-gold-border)] bg-[var(--color-gold-surface)]' : 'border-[var(--color-border-base)] bg-[#0B0B0B]'}`}>
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-[13.5px] font-semibold text-[var(--color-text-primary)]">{t.name}</span>
                              <span className="text-[11px] text-[var(--color-text-muted)]" style={MONO}>{t.price}</span>
                            </div>
                            {current && (
                              <span className="inline-block mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--color-gold)]" style={MONO}>
                                Your plan
                              </span>
                            )}
                            <ul className="mt-2.5 space-y-1.5">
                              {t.unlocks.map((u) => (
                                <li key={u} className="flex items-start gap-1.5 text-[12px] text-[var(--color-text-secondary)] leading-snug">
                                  <Check className="w-3 h-3 text-[var(--color-gold)] mt-[3px] shrink-0" />
                                  <span>{u}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                    {!tierAtLeast(tier, 'pro') && (
                      <p className="mt-3 text-[12.5px] text-[var(--color-text-muted)] leading-relaxed">
                        You&apos;re on Free. Connect your book now at no cost, and the thesis layer, taxes, and earnings unlock with Pro.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="shrink-0 sticky bottom-0 bg-[#050505]/92 backdrop-blur-md border-t border-[var(--color-border-base)] px-5 sm:px-8 py-4" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
                <div className="flex items-center justify-between max-w-xl mx-auto gap-4">
                  <button onClick={() => setPhase('card')} className="text-[14px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors min-h-[44px]" style={MONO}>
                    Back
                  </button>
                  <button onClick={() => setPhase('connect')}
                    className="flex items-center gap-2 px-6 min-h-[48px] bg-[var(--color-gold)] text-black text-[15px] font-semibold rounded-md hover:brightness-110 transition-all">
                    Connect your brokerage <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ═══ CONNECT — reframed ask ═══ */}
          {phase === 'connect' && (
            <>
              <div className="flex-1 overflow-y-auto flex flex-col px-5 sm:px-8 pt-[max(48px,env(safe-area-inset-top))] pb-6" style={{ animation: 'onb-fade-up 0.5s ease-out' }}>
                <div className="max-w-md mx-auto w-full my-auto py-4">
                  <div className="flex justify-center mb-6"><HelmMark size={64} /></div>
                  <h2 className="text-[clamp(24px,5vw,36px)] font-bold tracking-tight text-[var(--color-text-primary)] text-center">
                    Watch your whole book.
                  </h2>
                  <p className="text-[15px] text-[var(--color-text-muted)] mt-3 leading-relaxed text-center">
                    Connect once and Helm runs this across every position, automatically.
                  </p>

                  <div className="mt-7 space-y-3">
                    {[
                      { Icon: Lock, text: 'Read-only. Helm can never trade or move your money.' },
                      { Icon: ShieldCheck, text: 'Bank-level connection via Plaid. Disconnect anytime.' },
                      { Icon: Building2, text: 'Works with 12,000+ institutions.' },
                    ].map(({ Icon, text }) => (
                      <div key={text} className="flex items-start gap-3">
                        <Icon className="w-[18px] h-[18px] text-[var(--color-text-muted)] mt-0.5 shrink-0" />
                        <span className="text-[14px] text-[var(--color-text-secondary)] leading-snug">{text}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8">
                    {preview ? (
                      <button onClick={() => setPhase('synced')}
                        className="w-full flex items-center justify-center gap-2 h-[52px] rounded-md bg-[var(--color-gold)] text-black text-[15px] font-semibold hover:brightness-110 transition-all">
                        Connect a brokerage
                      </button>
                    ) : (
                      /* onClickCapture fires our step event before Plaid opens (button has no onClick prop) */
                      <div onClickCapture={() => track('onb_link_started')}>
                        <PlaidLinkButton
                          onSuccess={handleConnected}
                          onError={(msg) => setLinkError(msg || 'Connection failed — please try again.')}
                          className="w-full flex items-center justify-center gap-2 h-[52px] rounded-md bg-[var(--color-gold)] text-black text-[15px] font-semibold hover:brightness-110 transition-all cursor-pointer"
                        >
                          Connect a brokerage
                        </PlaidLinkButton>
                        {linkError && (
                          <p className="mt-2.5 text-[13px] text-[var(--color-negative-text)] text-center m-0">
                            {linkError}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-3 mt-5">
                      <span className="h-px flex-1 bg-[var(--color-border-base)]" />
                      <span className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]" style={MONO}>Or</span>
                      <span className="h-px flex-1 bg-[var(--color-border-base)]" />
                    </div>

                    {/* Two equal-weight alternatives under the one primary path. Stacks on narrow screens. */}
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button onClick={() => setPhase('manual')}
                        className="flex items-center justify-center gap-2 h-[48px] rounded-md border border-[var(--color-border-base)] hover:border-[var(--color-border-strong)] text-[14px] text-[var(--color-text-secondary)] transition-colors">
                        <PenLine className="w-4 h-4" /> Add holdings manually
                      </button>
                      <button onClick={handleDemo}
                        className="flex items-center justify-center h-[48px] rounded-md border border-[var(--color-border-base)] hover:border-[var(--color-border-strong)] text-[14px] text-[var(--color-text-secondary)] transition-colors">
                        Explore a demo first
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="shrink-0 sticky bottom-0 bg-[#050505]/92 backdrop-blur-md border-t border-[var(--color-border-base)] px-5 sm:px-8 py-4 text-center" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
                <button onClick={() => setPhase('howItWorks')} className="text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors min-h-[44px]" style={MONO}>
                  Back
                </button>
              </div>
            </>
          )}

          {/* ═══ MANUAL ═══ */}
          {phase === 'manual' && (
            <>
              <div className="flex-1 overflow-y-auto flex flex-col px-5 sm:px-8 pt-[max(48px,env(safe-area-inset-top))] pb-6" style={{ animation: 'onb-fade-up 0.5s ease-out' }}>
                <div className="max-w-lg mx-auto w-full my-auto py-4">
                  <div className="text-center mb-6">
                    <h2 className="text-[24px] sm:text-[28px] font-bold tracking-tight text-[var(--color-text-primary)]">Add your holdings</h2>
                    <p className="text-[15px] text-[var(--color-text-muted)] mt-2">Enter your positions. Helm drafts a starting thesis on your largest ones.</p>
                  </div>
                  <ManualPortfolioForm compact readOnly={preview} onComplete={() => { track('onb_link_completed', { via: 'manual' }); setPhase('synced'); }} />
                </div>
              </div>
              <div className="shrink-0 sticky bottom-0 bg-[#050505]/92 backdrop-blur-md border-t border-[var(--color-border-base)] px-5 sm:px-8 py-4 text-center" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
                <button onClick={() => setPhase('connect')} className="text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors min-h-[44px]" style={MONO}>← Back</button>
              </div>
            </>
          )}

          {/* ═══ SYNCED — brief, drafting ═══ */}
          {phase === 'synced' && (
            <div className="flex-1 grid place-items-center px-6" style={{ animation: 'onb-fade-in 0.4s ease-out' }}>
              <div className="text-center max-w-sm">
                <svg className="w-14 h-14 text-[var(--color-positive)] mx-auto mb-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"
                    style={{ strokeDasharray: 30, strokeDashoffset: 30, animation: 'onb-check 0.4s ease-out 0.1s forwards' }} />
                </svg>
                {syncCounts && (
                  <p className="text-[16px] text-[var(--color-text-primary)]" style={MONO}>
                    {syncCounts.accounts} {syncCounts.accounts === 1 ? 'account' : 'accounts'} · {syncCounts.holdings} holdings synced
                  </p>
                )}
                <p className="mt-3 text-[14px] text-[var(--color-text-muted)]" style={MONO}>
                  Drafting a starting thesis for your largest positions…
                </p>
              </div>
            </div>
          )}

          {/* ═══ RATIFY — cliff-2 payoff ═══ */}
          {phase === 'ratify' && drafts && (
            <>
              <div className="flex-1 overflow-y-auto flex flex-col px-5 sm:px-8 pt-[max(48px,env(safe-area-inset-top))] pb-6" style={{ animation: 'onb-fade-up 0.5s ease-out' }}>
                <div className="max-w-xl mx-auto w-full my-auto py-4">
                  <h2 className="text-[clamp(22px,4vw,30px)] font-bold tracking-tight text-[var(--color-text-primary)] leading-[1.15]">
                    Helm drafted a starting thesis for your {drafts.length === 1 ? 'largest position' : `${drafts.length} largest positions`}.
                  </h2>
                  <p className="text-[15px] text-[var(--color-text-muted)] mt-3 leading-relaxed">
                    Confirm the ones that match how you actually think. Helm starts watching them the moment you do.
                  </p>

                  <div className="mt-6 rounded-lg overflow-hidden border border-[var(--color-border-base)] bg-[#0B0B0B] divide-y divide-white/[0.05]">
                    {drafts.map((d) => (
                      <div key={d.ticker} className="flex items-center gap-4 px-4 sm:px-5 py-4">
                        <span className="text-[14px] font-semibold tracking-[0.08em] text-[var(--color-text-primary)] w-[56px] shrink-0" style={MONO}>{d.ticker}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] leading-[1.4] text-[var(--color-text-secondary)] m-0 line-clamp-2">{d.topClaim || d.name}</p>
                          <p className="mt-1 text-[10.5px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] m-0" style={MONO}>
                            {d.confirmed ? 'Watching' : d.moreCount > 0 ? `Draft · +${d.moreCount} more` : 'Draft'}
                          </p>
                        </div>
                        {d.confirmed ? (
                          <span className="flex items-center gap-1.5 text-[12px] text-[var(--color-positive)] shrink-0" style={MONO}>
                            <Check className="w-4 h-4" /> Watching
                          </span>
                        ) : (
                          <button onClick={() => confirmDraft(d)} disabled={busy === d.ticker}
                            className="text-[13px] font-semibold px-4 min-h-[44px] rounded bg-[var(--color-gold)] text-black hover:brightness-110 transition disabled:opacity-50 shrink-0" style={MONO}>
                            {busy === d.ticker ? 'Saving…' : 'Confirm'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {note && (
                    <p className="mt-4 rounded-md border border-[var(--color-gold-border)] bg-[var(--color-gold-surface)] px-3.5 py-2.5 text-[13px] leading-relaxed text-[var(--color-text-secondary)] m-0">
                      {note}
                    </p>
                  )}
                  <p className="mt-4 text-[12.5px] text-[var(--color-text-muted)] leading-relaxed" style={MONO}>
                    You can add, edit, or delete any of these anytime. They are yours.
                  </p>
                </div>
              </div>

              <div className="shrink-0 sticky bottom-0 bg-[#050505]/92 backdrop-blur-md border-t border-[var(--color-border-base)] px-5 sm:px-8 py-4" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
                <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
                  <button onClick={() => dismiss(true)} className="text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors min-h-[44px]" style={MONO}>Skip for now</button>
                  <button onClick={confirmAll} disabled={busy !== null}
                    className="flex items-center gap-2 px-6 min-h-[48px] bg-[var(--color-gold)] text-black text-[15px] font-semibold rounded-md hover:brightness-110 transition-all disabled:opacity-50">
                    Confirm all and enter the terminal <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ═══ DONE ═══ */}
          {phase === 'done' && (
            <div className="flex-1 grid place-items-center" style={{ animation: 'onb-fade-up 0.4s ease-out' }}>
              <div className="relative text-center">
                <svg className="w-16 h-16 text-[var(--color-positive)] mx-auto mb-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"
                    style={{ strokeDasharray: 30, strokeDashoffset: 30, animation: 'onb-check 0.4s ease-out 0.1s forwards' }} />
                </svg>
                <h1 className="text-[36px] font-bold text-[var(--color-text-primary)]">You&apos;re in</h1>
                {/* Several non-demo paths land here with no timer — without a
                    button this was a dead-end overlay until a manual reload. */}
                <button
                  type="button"
                  onClick={() => dismiss(true)}
                  className="mt-7 px-8 py-3 rounded-md bg-[var(--color-gold)] text-black text-[15px] font-semibold hover:brightness-110 transition-all"
                >
                  Open the terminal &rarr;
                </button>
              </div>
            </div>
          )}

          <div className="shrink-0 py-4 text-center">
            <span className="text-[9px] tracking-[0.15em] text-[var(--color-text-muted)]/15 uppercase" style={MONO}>helmterminal.dev</span>
          </div>
        </div>
      </div>
    </>
  );
}
