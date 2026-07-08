// /dashboard/theses/builder — pre-buy Thesis Builder.
// For a name you are RESEARCHING (you may not own it): draft pillars with AI, see
// the pre-buy risk (sector concentration if added, shared-driver overlap with your
// existing theses, the bear case), edit/confirm/dismiss the pillars, then track it.
// Reuses the existing thesis-write APIs end to end — no new write endpoints.
'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, Lock, Pencil, Sparkles, TrendingDown, X } from 'lucide-react';
import { TierLock } from '@/components/tier-lock';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

interface DraftPillar {
  id: string;
  claim: string;
  confirmed: boolean;
}

interface SectorConcentrationRisk {
  sector: string;
  currentSectorPct: number;
  projectedSectorPct: number;
  assumedPositionPct: number;
  alreadyHeld: boolean;
  note: string;
}
interface SharedDriverRisk {
  driver: string;
  matchedClaim: string;
  otherTickers: string[];
  rationale: string;
}
interface MarketCase {
  stance: 'bull' | 'bear';
  text: string;
  dayChangePct: number | null;
}
interface PrebuyRisk {
  ticker: string;
  sectorConcentration: SectorConcentrationRisk | null;
  sharedDriver: SharedDriverRisk[];
  sharedDriverComputed: boolean;
  marketCase: MarketCase | null;
}

const TICKER_RE = /^[A-Z.\-]{1,10}$/;

// Eyebrow label — gold mono caps, the Sovereign Architect section marker.
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="font-mono text-[11.5px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)]"
      style={MONO}
    >
      {children}
    </div>
  );
}

// Risk sub-section header — muted mono caps inside the risk panel.
function RiskHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]"
      style={MONO}
    >
      {children}
    </div>
  );
}

function BuilderInner() {
  const searchParams = useSearchParams();
  const prefill = (searchParams.get('ticker') ?? '').trim().toUpperCase();

  const [ticker, setTicker] = useState(prefill);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  const [activeTicker, setActiveTicker] = useState<string | null>(null);
  const [pillars, setPillars] = useState<DraftPillar[]>([]);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [busyPillar, setBusyPillar] = useState<string | null>(null);

  const [risk, setRisk] = useState<PrebuyRisk | null>(null);
  const [riskLoading, setRiskLoading] = useState(false);

  const [tracked, setTracked] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);

  const loadRisk = useCallback(async (tk: string) => {
    setRiskLoading(true);
    setRisk(null);
    try {
      const res = await fetch(`/api/prebuy-risk?ticker=${encodeURIComponent(tk)}`);
      if (res.status === 403) { return; }
      if (res.ok) {
        const data = await res.json() as { risk?: PrebuyRisk };
        if (data.risk) setRisk(data.risk);
      }
    } catch {
      // risk panel degrades silently — the draft flow still works
    } finally {
      setRiskLoading(false);
    }
  }, []);

  async function handleDraft(e?: React.FormEvent) {
    e?.preventDefault();
    const tk = ticker.trim().toUpperCase();
    if (!TICKER_RE.test(tk) || drafting) {
      if (!TICKER_RE.test(tk)) setDraftError('Enter a valid US ticker (letters only).');
      return;
    }
    setDrafting(true);
    setDraftError(null);
    setTracked(false);
    setTrackError(null);
    setRisk(null);
    try {
      const res = await fetch('/api/thesis/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: tk }),
      });
      if (res.status === 403 || res.status === 404) { setDraftError('Could not draft a thesis for that ticker.'); return; }
      if (res.status === 429) { setDraftError('Too many drafts right now. Try again in a bit.'); return; }
      if (!res.ok) { setDraftError('Could not draft a thesis for that ticker.'); return; }

      const data = await res.json() as {
        thesis?: { tracked?: boolean };
        pillars?: { id: string; claim: string; confirmed: boolean }[];
      };
      const drafted = (data.pillars ?? []).map((p) => ({ id: p.id, claim: p.claim, confirmed: p.confirmed }));
      setPillars(drafted);
      setEditing(Object.fromEntries(drafted.map((p) => [p.id, p.claim])));
      setActiveTicker(tk);
      setTracked(!!data.thesis?.tracked);
      // Risk panel runs in parallel once we have a candidate.
      void loadRisk(tk);
    } catch {
      setDraftError('Something went wrong. Try again.');
    } finally {
      setDrafting(false);
    }
  }

  async function confirmPillar(id: string) {
    if (busyPillar) return;
    const claim = (editing[id] ?? '').trim();
    if (!claim) return;
    setBusyPillar(id);
    try {
      const res = await fetch(`/api/thesis/pillars/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: true, claim }),
      });
      if (res.ok) {
        const data = await res.json() as { pillar?: { claim: string } };
        setPillars((prev) => prev.map((p) => (p.id === id ? { ...p, confirmed: true, claim: data.pillar?.claim ?? claim } : p)));
      }
    } catch {
      // non-fatal
    } finally {
      setBusyPillar(null);
    }
  }

  async function saveEdit(id: string) {
    if (busyPillar) return;
    const claim = (editing[id] ?? '').trim();
    if (!claim) return;
    setBusyPillar(id);
    try {
      const res = await fetch(`/api/thesis/pillars/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim }),
      });
      if (res.ok) {
        setPillars((prev) => prev.map((p) => (p.id === id ? { ...p, claim } : p)));
      }
    } catch {
      // non-fatal
    } finally {
      setBusyPillar(null);
    }
  }

  async function dismissPillar(id: string) {
    if (busyPillar) return;
    setBusyPillar(id);
    try {
      const res = await fetch(`/api/thesis/pillars/${id}`, { method: 'DELETE' });
      if (res.ok) setPillars((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // non-fatal
    } finally {
      setBusyPillar(null);
    }
  }

  async function trackThesis() {
    if (!activeTicker || tracking) return;
    setTracking(true);
    setTrackError(null);
    try {
      // Create (idempotent) then flip tracked on via the existing ticker PATCH.
      await fetch('/api/thesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: activeTicker }),
      });
      const res = await fetch(`/api/thesis/${activeTicker}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracked: true }),
      });
      if (res.status === 403) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setTrackError(data.error ?? 'Upgrade to track more theses.');
        return;
      }
      if (res.ok) setTracked(true);
      else setTrackError('Could not track this thesis.');
    } catch {
      setTrackError('Something went wrong.');
    } finally {
      setTracking(false);
    }
  }

  // Auto-draft when arriving with ?ticker= prefilled (e.g. from /analyze).
  useEffect(() => {
    if (prefill && TICKER_RE.test(prefill)) {
      void handleDraft();
    }
    // run once on mount for the prefill
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sc = risk?.sectorConcentration;

  return (
    <div className="max-w-[1280px] 2xl:max-w-[1760px] mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-10">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/theses"
          className="inline-flex items-center gap-1.5 font-mono text-[13px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors mb-5"
          style={MONO}
        >
          <ArrowLeft className="w-4 h-4" /> Theses
        </Link>
        <Eyebrow>Thesis Builder</Eyebrow>
        <h1 className="mt-3 type-h1 text-[clamp(32px,3.4vw,42px)] m-0">
          Stress-test a thesis before you buy.
        </h1>
        <p className="mt-3.5 max-w-[640px] m-0 text-[16px] leading-[1.6] text-[var(--color-text-muted)] text-pretty">
          Enter a name you are researching. You do not have to own it. Helm drafts a starting set of pillars for you to edit and make your own, then runs the pre-buy risk check: the concentration it would add, the drivers it shares with what you already hold, and the bear case.
        </p>
      </div>

      {/* Ticker input */}
      <form onSubmit={handleDraft} className="flex flex-col sm:flex-row gap-3 max-w-[560px]">
        <input
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="Ticker (e.g. NVDA)"
          spellCheck={false}
          autoCapitalize="characters"
          maxLength={10}
          className="flex-1 font-mono text-[17px] uppercase tracking-[0.1em] px-4 py-3.5 rounded-md bg-[var(--color-bg-base)] border border-[var(--color-border-strong)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]/60 focus:outline-none focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)]/30 transition-colors"
          style={MONO}
        />
        <button
          type="submit"
          disabled={drafting}
          className="inline-flex items-center justify-center gap-2 font-mono text-[13px] font-semibold uppercase tracking-[0.12em] px-6 py-3.5 rounded-md bg-[var(--color-gold)] text-[var(--color-text-inverse)] hover:bg-[var(--color-gold-hi)] transition-colors disabled:opacity-50"
          style={MONO}
        >
          <Sparkles className="w-4 h-4" />
          {drafting ? 'Drafting…' : 'Draft starting pillars'}
        </button>
      </form>
      {draftError && <p className="font-mono text-[13px] text-[var(--color-negative-text)] -mt-6" style={MONO}>{draftError}</p>}

      {activeTicker && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
          {/* Pillars column */}
          <div className="sovereign-card rounded-xl p-6 sm:p-7 space-y-6">
            <div className="flex items-center justify-between gap-3">
              <Eyebrow>Proposed pillars — {activeTicker}</Eyebrow>
              {tracked && (
                <span className="inline-flex items-center gap-1.5 font-mono text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--color-positive)]" style={MONO}>
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-positive)]" style={{ boxShadow: '0 0 7px var(--color-positive)' }} />
                  Tracked
                </span>
              )}
            </div>

            {pillars.length === 0 ? (
              <p className="font-mono text-[13px] text-[var(--color-text-secondary)]" style={MONO}>
                {drafting ? 'Drafting pillars…' : 'No pillars yet. Draft again or pick another ticker.'}
              </p>
            ) : (
              <div className="space-y-4">
                {pillars.map((p, i) => (
                  <div
                    key={p.id}
                    className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-base)] p-4 sm:p-5"
                    style={p.confirmed ? { borderColor: 'rgba(74,222,128,0.25)' } : undefined}
                  >
                    <div className="flex items-start gap-3.5">
                      {/* Numbered marker */}
                      <span
                        className="shrink-0 mt-0.5 inline-flex items-center justify-center w-7 h-7 rounded-md font-mono text-[13px] font-semibold tabular-nums"
                        style={{
                          ...MONO,
                          color: p.confirmed ? 'var(--color-positive)' : 'var(--color-gold)',
                          background: p.confirmed ? 'rgba(74,222,128,0.08)' : 'var(--color-gold-surface)',
                          border: `1px solid ${p.confirmed ? 'rgba(74,222,128,0.30)' : 'var(--color-gold-border)'}`,
                        }}
                      >
                        {p.confirmed ? '✓' : '●'}
                      </span>
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="relative">
                          <textarea
                            value={editing[p.id] ?? p.claim}
                            onChange={(e) => setEditing((prev) => ({ ...prev, [p.id]: e.target.value }))}
                            rows={2}
                            maxLength={500}
                            disabled={p.confirmed}
                            className="w-full resize-none bg-transparent text-[16px] leading-[1.55] text-[var(--color-text-primary)] focus:outline-none disabled:opacity-90"
                          />
                          {!p.confirmed && (
                            <Pencil className="pointer-events-none absolute top-1 right-0 w-3.5 h-3.5 text-[var(--color-text-secondary)]/50" />
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {p.confirmed ? (
                            <span className="inline-flex items-center gap-1.5 font-mono text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--color-positive)]" style={MONO}>
                              <Check className="w-3.5 h-3.5" /> Confirmed
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={busyPillar === p.id}
                                onClick={() => confirmPillar(p.id)}
                                className="inline-flex items-center gap-1.5 font-mono text-[12px] font-semibold uppercase tracking-[0.12em] px-3.5 py-2 rounded-md bg-[rgba(74,222,128,0.1)] text-[var(--color-positive)] border border-[rgba(74,222,128,0.3)] hover:bg-[rgba(74,222,128,0.16)] transition-colors disabled:opacity-50"
                                style={MONO}
                              >
                                <Check className="w-3.5 h-3.5" /> Confirm
                              </button>
                              {(editing[p.id] ?? p.claim).trim() !== p.claim.trim() && (
                                <button
                                  type="button"
                                  disabled={busyPillar === p.id}
                                  onClick={() => saveEdit(p.id)}
                                  className="font-mono text-[12px] font-semibold uppercase tracking-[0.12em] px-3.5 py-2 rounded-md bg-transparent text-[var(--color-gold)] border border-[var(--color-gold-border)] hover:bg-[var(--color-gold-surface)] transition-colors disabled:opacity-50"
                                  style={MONO}
                                >
                                  Save edit
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={busyPillar === p.id}
                                onClick={() => dismissPillar(p.id)}
                                className="inline-flex items-center gap-1.5 font-mono text-[12px] font-semibold uppercase tracking-[0.12em] px-3.5 py-2 rounded-md bg-transparent text-[var(--color-text-secondary)] border border-[var(--color-border-base)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] transition-colors disabled:opacity-50"
                                style={MONO}
                              >
                                <X className="w-3.5 h-3.5" /> Dismiss
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {pillars.length > 0 && (
              <div className="pt-1 space-y-3">
                <button
                  type="button"
                  disabled={tracking || tracked}
                  onClick={trackThesis}
                  className="w-full font-mono text-[13px] font-semibold uppercase tracking-[0.12em] px-4 py-3.5 rounded-md bg-[var(--color-gold)] text-[var(--color-text-inverse)] hover:bg-[var(--color-gold-hi)] transition-colors disabled:opacity-50"
                  style={MONO}
                >
                  {tracked ? 'Thesis tracked' : tracking ? 'Tracking…' : 'Track this thesis'}
                </button>
                {trackError && <p className="font-mono text-[13px] text-[var(--color-negative-text)]" style={MONO}>{trackError}</p>}
                {tracked && (
                  <Link href="/dashboard/theses" className="block text-center font-mono text-[13px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors" style={MONO}>
                    View in Theses
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Risk column */}
          <div className="sovereign-card rounded-xl p-6 sm:p-7 space-y-6 self-start" style={{ borderTop: '2px solid var(--color-gold-border)' }}>
            <div className="flex items-center gap-2.5">
              <TrendingDown className="w-4 h-4 text-[var(--color-gold)]" />
              <Eyebrow>Pre-buy risk</Eyebrow>
            </div>

            {riskLoading && !risk ? (
              <p className="font-mono text-[13px] text-[var(--color-text-secondary)]" style={MONO}>Computing risk…</p>
            ) : (
              <div className="space-y-7">
                {/* Sector concentration */}
                <div className="space-y-3">
                  <RiskHeading>Sector concentration</RiskHeading>
                  {sc ? (
                    <>
                      <p className="text-[15px] leading-[1.55] text-[var(--color-text-primary)] m-0">{sc.note}</p>
                      {!sc.alreadyHeld && (
                        <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-base)] px-4 py-3">
                          <span className="font-mono text-[13px] uppercase tracking-[0.1em] text-[var(--color-text-muted)]" style={MONO}>{sc.sector}</span>
                          <span className="ml-auto flex items-center gap-3 font-mono tabular-nums" style={MONO}>
                            <span className="text-[20px] font-semibold text-[var(--color-text-secondary)]">{sc.currentSectorPct.toFixed(1)}%</span>
                            <span className="text-[16px] text-[var(--color-text-secondary)]/60">→</span>
                            <span className="text-[22px] font-bold text-[var(--color-gold)]">{sc.projectedSectorPct.toFixed(1)}%</span>
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-[15px] leading-[1.55] text-[var(--color-text-secondary)] m-0">
                      No holdings to compare against yet, so sector concentration cannot be computed.
                    </p>
                  )}
                </div>

                {/* Shared driver */}
                <div className="space-y-3">
                  <RiskHeading>Shared-driver overlap</RiskHeading>
                  {!risk?.sharedDriverComputed ? (
                    <p className="text-[15px] leading-[1.55] text-[var(--color-text-secondary)] m-0">
                      Not enough tracked theses to map shared drivers yet.
                    </p>
                  ) : risk.sharedDriver.length === 0 ? (
                    <p className="text-[15px] leading-[1.55] text-[var(--color-text-muted)] m-0">
                      No overlap found. These pillars do not lean on a driver your existing theses already depend on.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {risk.sharedDriver.map((d) => (
                        <div key={d.driver} className="rounded-lg border border-[var(--color-gold-border)] bg-[var(--color-gold-surface)] p-4 space-y-2">
                          <div className="font-mono text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--color-gold)]" style={MONO}>
                            {d.driver}
                          </div>
                          <p className="text-[15px] leading-[1.55] text-[var(--color-text-primary)] m-0">
                            Also drives {d.otherTickers.join(', ')} in your book. {d.rationale}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Market case — bull on an up day, bear on a down day */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <RiskHeading>
                      {risk?.marketCase?.stance === 'bull' ? 'The bull case' : 'The bear case'}
                    </RiskHeading>
                    {risk?.marketCase?.dayChangePct != null && (
                      <span
                        className="font-mono text-[11px] font-semibold tabular-nums"
                        style={{ color: risk.marketCase.stance === 'bull' ? 'var(--color-positive)' : 'var(--color-negative-text)' }}
                      >
                        {risk.marketCase.dayChangePct >= 0 ? '+' : ''}{risk.marketCase.dayChangePct.toFixed(2)}% today
                      </span>
                    )}
                  </div>
                  {risk?.marketCase ? (
                    <p
                      className="text-[15px] leading-[1.6] text-[var(--color-text-primary)] m-0 border-l-2 pl-4"
                      style={{ borderColor: risk.marketCase.stance === 'bull' ? 'var(--color-positive)' : 'var(--color-negative-text)' }}
                    >
                      {risk.marketCase.text}
                    </p>
                  ) : (
                    <p className="text-[15px] leading-[1.55] text-[var(--color-text-secondary)] m-0">
                      No cached analysis for {activeTicker} yet. Open it on Analyze to generate one.
                    </p>
                  )}
                </div>

                <p className="font-mono text-[11.5px] text-[var(--color-text-secondary)]/70 leading-[1.5] pt-1" style={MONO}>
                  For research, not advice. Helm does not recommend buying or selling.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {!activeTicker && (
        <div className="flex items-center gap-2 font-mono text-[13px] text-[var(--color-text-secondary)]" style={MONO}>
          <Lock className="w-4 h-4" />
          Drafts are private to you and never count until you confirm them.
        </div>
      )}
    </div>
  );
}

export default function BuilderPage() {
  return (
    <Suspense fallback={null}>
      <TierLock
        required="max"
        label="Unlock the Thesis Builder with Max"
        blurb="Stress-test a name before you buy. Draft a starting set of pillars to edit and make your own, see the sector concentration it would add, the drivers it shares with what you already hold, and the bear case. Then track it."
      >
        <BuilderInner />
      </TierLock>
    </Suspense>
  );
}
