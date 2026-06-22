// /dashboard/theses/builder — pre-buy Thesis Builder.
// For a name you are RESEARCHING (you may not own it): draft pillars with AI, see
// the pre-buy risk (sector concentration if added, shared-driver overlap with your
// existing theses, the bear case), edit/confirm/dismiss the pillars, then track it.
// Reuses the existing thesis-write APIs end to end — no new write endpoints.
'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Lock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ProBlur } from '@/components/pro-blur';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const SERIF: React.CSSProperties = { fontFamily: "'Instrument Serif', Georgia, serif" };

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
interface PrebuyRisk {
  ticker: string;
  sectorConcentration: SectorConcentrationRisk | null;
  sharedDriver: SharedDriverRisk[];
  sharedDriverComputed: boolean;
  bearCase: string | null;
}

const TICKER_RE = /^[A-Z.\-]{1,10}$/;

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)] mb-2.5" style={MONO}>
      {children}
    </div>
  );
}

function BuilderInner() {
  const searchParams = useSearchParams();
  const prefill = (searchParams.get('ticker') ?? '').trim().toUpperCase();

  const [ticker, setTicker] = useState(prefill);
  const [locked, setLocked] = useState(false);
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
      if (res.status === 403) { setLocked(true); return; }
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
      if (res.status === 403 || res.status === 404) { setLocked(true); return; }
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

  if (locked) {
    return (
      <div className="max-w-[1280px] 2xl:max-w-[1760px] mx-auto px-4 sm:px-6 py-8">
        <ProBlur
          label="Unlock the Thesis Builder with Pro"
          description="Stress-test a name before you buy. Draft a starting set of pillars to edit and make your own, see the sector concentration it would add, the drivers it shares with what you already hold, and the bear case. Then track it."
          minHeight="380px"
        >
          <div className="space-y-6">
            <div>
              <Label>Thesis Builder</Label>
              <h1 className="text-[32px] font-bold leading-[1.12] tracking-[-0.03em] text-[#FAFAFA] m-0">Stress-test a thesis before you buy.</h1>
            </div>
            <div className="rounded-lg border border-white/[0.07] bg-[#0E0E0E] p-5 space-y-3">
              {['Demand for its core product keeps compounding.', 'It is taking share in a growing market.', 'Margins expand as the mix shifts.'].map((c) => (
                <div key={c} className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6A6A6A]" />
                  <span className="text-[15px] text-[#9A9A9A]">{c}</span>
                </div>
              ))}
            </div>
          </div>
        </ProBlur>
      </div>
    );
  }

  const sc = risk?.sectorConcentration;

  return (
    <div className="max-w-[1280px] 2xl:max-w-[1760px] mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/theses"
          className="inline-flex items-center gap-1.5 font-mono text-[12px] text-[#6A6A6A] hover:text-[#9A9A9A] transition-colors mb-4"
          style={MONO}
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Theses
        </Link>
        <Label>Thesis Builder</Label>
        <h1 className="text-[clamp(27px,3vw,34px)] font-bold leading-[1.14] tracking-[-0.03em] text-[#FAFAFA] m-0">
          Stress-test a thesis before you buy.
        </h1>
        <p className="mt-3.5 text-[16.5px] leading-[1.5] text-[#9A9A9A] max-w-[620px] m-0" style={{ ...SERIF, fontStyle: 'italic' }}>
          Enter a name you are researching. You do not have to own it. Helm drafts a starting set of pillars for you to edit and make your own, then runs the pre-buy risk check: the concentration it would add, the drivers it shares with what you already hold, and the bear case.
        </p>
      </div>

      {/* Ticker input */}
      <form onSubmit={handleDraft} className="flex flex-col sm:flex-row gap-3 max-w-[520px]">
        <input
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="Ticker (e.g. NVDA)"
          spellCheck={false}
          autoCapitalize="characters"
          maxLength={10}
          className="flex-1 font-mono text-[15px] uppercase tracking-[0.08em] px-4 py-3 rounded bg-[#131313] border border-white/[0.09] text-[#FAFAFA] placeholder:text-[#4A4A4A] focus:outline-none focus:border-[rgba(230,185,77,0.5)] transition-colors"
          style={MONO}
        />
        <button
          type="submit"
          disabled={drafting}
          className="font-mono text-[12px] font-semibold uppercase tracking-[0.12em] px-5 py-3 rounded bg-[#E6B94D] text-[#060606] hover:bg-[#F0C868] transition-colors disabled:opacity-50"
          style={MONO}
        >
          {drafting ? 'Drafting…' : 'Draft starting pillars'}
        </button>
      </form>
      {draftError && <p className="font-mono text-[12px] text-[#F87171] -mt-4" style={MONO}>{draftError}</p>}

      {activeTicker && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
          {/* Pillars column */}
          <Card variant="default" className="p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between">
              <Label>Proposed pillars — {activeTicker}</Label>
              {tracked && (
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#4ADE80]" style={MONO}>Tracked</span>
              )}
            </div>

            {pillars.length === 0 ? (
              <p className="font-mono text-[13px] text-[#6A6A6A]" style={MONO}>
                {drafting ? 'Drafting pillars…' : 'No pillars yet. Draft again or pick another ticker.'}
              </p>
            ) : (
              <div className="space-y-4">
                {pillars.map((p) => (
                  <div key={p.id} className="rounded-lg border border-white/[0.07] bg-[#131313] p-4 space-y-3">
                    <textarea
                      value={editing[p.id] ?? p.claim}
                      onChange={(e) => setEditing((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      rows={2}
                      maxLength={500}
                      disabled={p.confirmed}
                      className="w-full resize-none bg-transparent text-[15px] leading-[1.5] text-[#EAEAEA] focus:outline-none disabled:opacity-80"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      {p.confirmed ? (
                        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#4ADE80]" style={MONO}>Confirmed</span>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={busyPillar === p.id}
                            onClick={() => confirmPillar(p.id)}
                            className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 rounded bg-[rgba(74,222,128,0.1)] text-[#4ADE80] border border-[rgba(74,222,128,0.3)] hover:bg-[rgba(74,222,128,0.16)] transition-colors disabled:opacity-50"
                            style={MONO}
                          >
                            Confirm
                          </button>
                          {(editing[p.id] ?? p.claim).trim() !== p.claim.trim() && (
                            <button
                              type="button"
                              disabled={busyPillar === p.id}
                              onClick={() => saveEdit(p.id)}
                              className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 rounded bg-transparent text-[#E6B94D] border border-[rgba(230,185,77,0.35)] hover:bg-[rgba(230,185,77,0.08)] transition-colors disabled:opacity-50"
                              style={MONO}
                            >
                              Save edit
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busyPillar === p.id}
                            onClick={() => dismissPillar(p.id)}
                            className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 rounded bg-transparent text-[#6A6A6A] border border-white/[0.09] hover:text-[#9A9A9A] transition-colors disabled:opacity-50"
                            style={MONO}
                          >
                            Dismiss
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {pillars.length > 0 && (
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  disabled={tracking || tracked}
                  onClick={trackThesis}
                  className="w-full font-mono text-[12px] font-semibold uppercase tracking-[0.12em] px-4 py-3 rounded bg-[#E6B94D] text-[#060606] hover:bg-[#F0C868] transition-colors disabled:opacity-50"
                  style={MONO}
                >
                  {tracked ? 'Thesis tracked' : tracking ? 'Tracking…' : 'Track this thesis'}
                </button>
                {trackError && <p className="font-mono text-[12px] text-[#F87171]" style={MONO}>{trackError}</p>}
                {tracked && (
                  <Link href="/dashboard/theses" className="block text-center font-mono text-[12px] text-[#6A6A6A] hover:text-[#9A9A9A] transition-colors" style={MONO}>
                    View in Theses
                  </Link>
                )}
              </div>
            )}
          </Card>

          {/* Risk column */}
          <Card variant="default" className="p-5 sm:p-6 space-y-5 self-start">
            <Label>Pre-buy risk</Label>

            {riskLoading && !risk ? (
              <p className="font-mono text-[13px] text-[#6A6A6A]" style={MONO}>Computing risk…</p>
            ) : (
              <div className="space-y-6">
                {/* Sector concentration */}
                <div className="space-y-2">
                  <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#9A9A9A]" style={MONO}>Sector concentration</div>
                  {sc ? (
                    <>
                      <p className="text-[14px] leading-[1.5] text-[#EAEAEA]">{sc.note}</p>
                      {!sc.alreadyHeld && (
                        <div className="flex items-center gap-3 font-mono text-[12.5px] tabular-nums" style={MONO}>
                          <span className="text-[#9A9A9A]">{sc.sector}</span>
                          <span className="text-[#6A6A6A]">{sc.currentSectorPct.toFixed(1)}%</span>
                          <span className="text-[#4A4A4A]">→</span>
                          <span className="text-[#E6B94D]">{sc.projectedSectorPct.toFixed(1)}%</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-[14px] leading-[1.5] text-[#6A6A6A]">
                      No holdings to compare against yet, so sector concentration cannot be computed.
                    </p>
                  )}
                </div>

                {/* Shared driver */}
                <div className="space-y-2">
                  <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#9A9A9A]" style={MONO}>Shared-driver overlap</div>
                  {!risk?.sharedDriverComputed ? (
                    <p className="text-[14px] leading-[1.5] text-[#6A6A6A]">
                      Not enough tracked theses to map shared drivers yet.
                    </p>
                  ) : risk.sharedDriver.length === 0 ? (
                    <p className="text-[14px] leading-[1.5] text-[#9A9A9A]">
                      No overlap found. These pillars do not lean on a driver your existing theses already depend on.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {risk.sharedDriver.map((d) => (
                        <div key={d.driver} className="rounded border border-[rgba(230,185,77,0.25)] bg-[rgba(230,185,77,0.05)] p-3 space-y-1.5">
                          <div className="font-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-[#E6B94D]" style={MONO}>
                            {d.driver}
                          </div>
                          <p className="text-[13px] leading-[1.5] text-[#EAEAEA]">
                            Also drives {d.otherTickers.join(', ')} in your book. {d.rationale}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bear case */}
                <div className="space-y-2">
                  <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#9A9A9A]" style={MONO}>The bear case</div>
                  {risk?.bearCase ? (
                    <p className="text-[14px] leading-[1.5] text-[#EAEAEA]">{risk.bearCase}</p>
                  ) : (
                    <p className="text-[14px] leading-[1.5] text-[#6A6A6A]">
                      No cached analysis for {activeTicker} yet. Open it on Analyze to generate one.
                    </p>
                  )}
                </div>

                <p className="font-mono text-[10.5px] text-[#4A4A4A] leading-[1.5] pt-1" style={MONO}>
                  For research, not advice. Helm does not recommend buying or selling.
                </p>
              </div>
            )}
          </Card>
        </div>
      )}

      {!activeTicker && (
        <div className="flex items-center gap-2 font-mono text-[12px] text-[#4A4A4A]" style={MONO}>
          <Lock className="w-3.5 h-3.5" />
          Drafts are private to you and never count until you confirm them.
        </div>
      )}
    </div>
  );
}

export default function BuilderPage() {
  return (
    <Suspense fallback={null}>
      <BuilderInner />
    </Suspense>
  );
}
