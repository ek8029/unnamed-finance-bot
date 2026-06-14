// Cross-thesis synthesis block - surfaces hidden concentration where pillars
// from 2+ tickers depend on the same underlying driver. Self-fetching; renders
// nothing unless the LLM finds genuine cross-ticker connections. Neutral copy
// (describes concentration, never advises). Lives atop /dashboard/theses.
// Collapsed by default showing a preview strip (driver + tickers); expands to
// the full grounded detail. Not the page hero.
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

interface ClusterPillar { ticker: string; claim: string; pillarId: string }
interface Cluster { driver: string; pillars: ClusterPillar[]; rationale: string }

export function CrossThesisSynthesis() {
  const [clusters, setClusters] = useState<Cluster[] | null>(null);
  const [done, setDone] = useState(false);
  const [open, setOpen] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        const res = await fetch('/api/thesis/synthesis');
        if (!mountedRef.current) return;
        if (res.ok) {
          const data = await res.json() as { clusters?: Cluster[] };
          if (!mountedRef.current) return;
          setClusters(Array.isArray(data.clusters) ? data.clusters : []);
        } else {
          setClusters([]);
        }
      } catch {
        if (mountedRef.current) setClusters([]);
      } finally {
        if (mountedRef.current) setDone(true);
      }
    })();
    return () => { mountedRef.current = false; };
  }, []);

  // Loading: brief "computing connections" shimmer.
  if (!done && clusters === null) {
    return (
      <section className="space-y-3">
        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)]" style={MONO}>
          How your theses connect
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-[#131313] p-5 flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-white/[0.08] animate-pulse" />
          <div className="h-3 w-56 rounded bg-white/[0.06] animate-pulse" />
        </div>
      </section>
    );
  }

  // Nothing genuinely connects (or insufficient theses): render nothing.
  if (!clusters || clusters.length === 0) return null;

  const positionCount = new Set(clusters.flatMap((c) => c.pillars.map((p) => p.ticker))).size;

  return (
    <section className="rounded-lg border border-white/[0.07] bg-[#131313] overflow-hidden">
      {/* header: clickable toggle */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)]" style={MONO}>
          How your theses connect
        </span>
        <span className="font-mono text-[11px] tracking-[0.06em] text-[#6A6A6A] hidden sm:inline" style={MONO}>
          {clusters.length} shared driver{clusters.length === 1 ? '' : 's'} link{clusters.length === 1 ? 's' : ''} {positionCount} of your positions
        </span>
        <ChevronDown className={`ml-auto w-4 h-4 text-[#6A6A6A] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* preview strip (collapsed): driver + member tickers per cluster */}
      {!open && (
        <div className="px-5 pb-4 flex flex-wrap gap-2">
          {clusters.map((c, i) => {
            const tickers = [...new Set(c.pillars.map((p) => p.ticker))];
            return (
              <div
                key={`${c.driver}-${i}`}
                className="flex items-center gap-2.5 flex-1 min-w-[200px] rounded border border-white/[0.07] bg-[#0E0E0E] px-3 py-2"
              >
                <span className="font-mono text-[13px] font-bold text-[#E6B94D] shrink-0" style={MONO}>{tickers.length}</span>
                <span className="text-[12px] text-[#9A9A9A] truncate flex-1 min-w-0">{c.driver}</span>
                <span className="flex gap-1.5 shrink-0">
                  {tickers.slice(0, 4).map((t) => (
                    <span key={t} className="font-mono text-[9px] uppercase tracking-[0.08em] text-[#6A6A6A]" style={MONO}>{t}</span>
                  ))}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* full grounded detail (expanded) */}
      {open && (
        <div className="px-5 pb-5 pt-4 border-t border-white/[0.05]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {clusters.map((c, i) => {
              const tickers = [...new Set(c.pillars.map((p) => p.ticker))];
              return (
                <div key={`${c.driver}-${i}`} className="flex overflow-hidden rounded-lg border border-white/[0.07] bg-[#0E0E0E]">
                  {/* gold conviction spine */}
                  <div className="w-[3px] shrink-0" style={{ background: '#E6B94D', opacity: 0.7 }} />
                  <div className="flex-1 min-w-0 p-5 space-y-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="m-0 text-[17px] font-bold leading-[1.25] tracking-[-0.01em] text-[#FAFAFA]">{c.driver}</h3>
                      <span className="shrink-0 font-mono text-[9px] font-semibold uppercase tracking-[0.15em] px-2 py-[3px] rounded border border-[rgba(230,185,77,0.3)] text-[#E6B94D] bg-[rgba(230,185,77,0.06)]" style={MONO}>
                        {tickers.length} positions
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {tickers.map((t) => (
                        <Link
                          key={t}
                          href={`/dashboard/holdings/${t}`}
                          className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] px-2 py-[3px] rounded border border-white/[0.1] text-[#FFD67A] hover:border-[rgba(230,185,77,0.4)] transition-colors"
                          style={MONO}
                        >
                          {t}
                        </Link>
                      ))}
                    </div>
                    <p className="m-0 text-[14.5px] leading-[1.55] text-[#B4B4B4]">{c.rationale}</p>
                    <div className="space-y-2 pt-1 border-t border-white/[0.05]">
                      {c.pillars.map((p) => (
                        <div key={p.pillarId} className="flex items-start gap-2.5">
                          <span className="mt-[2px] font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6A6A6A] shrink-0 w-[44px]" style={MONO}>{p.ticker}</span>
                          <span className="text-[13px] leading-[1.5] text-[#9A9A9A] min-w-0">{p.claim}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
