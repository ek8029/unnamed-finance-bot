'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';
import { ChevronDown } from 'lucide-react';

interface BriefData {
  portfolio: { totalValue: number; overnightChange: number; overnightChangePct: number; vsBenchmark: number | null };
  market: { spy: { price: number; changePct: number } | null; qqq: { price: number; changePct: number } | null; vix: { price: number; level: string } | null; treasury10y: { yield: number } | null };
  movers: { ticker: string; name: string; sector: string; changePct: number; dollarImpact: number }[];
  allHoldings: { ticker: string; name: string; sector: string; changePct: number; dollarImpact: number }[];
  sectorHeat: { sector: string; weight: number; changePct: number; tickers: string[] }[];
  earningsThisWeek: { ticker: string; reportDate: string; portfolioWeight: number }[];
  dividendsThisWeek: { ticker: string; exDate: string }[];
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

export default function BriefPage() {
  const [data, setData] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetch('/api/dashboard/brief')
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const now = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dateStr = `${dayNames[now.getDay()]} · ${monthNames[now.getMonth()]} ${now.getDate()} · ${now.getFullYear()}`;
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-base)]">
        {/* Newspaper-shaped skeleton */}
        <div className="border-b-2 border-[var(--color-gold)]/30 animate-pulse">
          <div className="max-w-6xl mx-auto px-6 py-8">
            <div className="h-3 w-48 bg-white/[0.06] rounded mb-3" />
            <div className="h-10 w-72 bg-white/[0.06] rounded" />
          </div>
        </div>
        <div className="bg-[#080808] border-b border-white/[0.06] animate-pulse">
          <div className="max-w-6xl mx-auto px-6 py-5 grid grid-cols-2 sm:grid-cols-4 gap-6">
            {[1,2,3,4].map(i => <div key={i}><div className="h-2 w-16 bg-white/[0.04] rounded mb-2" /><div className="h-5 w-20 bg-white/[0.06] rounded" /></div>)}
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 py-10 animate-pulse space-y-6">
          <div className="h-3 w-32 bg-[var(--color-gold)]/10 rounded" />
          <div className="h-8 w-3/4 bg-white/[0.06] rounded" />
          <div className="space-y-2">
            <div className="h-4 w-full bg-white/[0.04] rounded" />
            <div className="h-4 w-5/6 bg-white/[0.04] rounded" />
            <div className="h-4 w-4/6 bg-white/[0.04] rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-base)] flex items-center justify-center">
        <div className="text-sm text-[var(--color-negative)]">Failed to load brief. <Link href="/dashboard" className="text-[var(--color-gold)]">Back to dashboard</Link></div>
      </div>
    );
  }

  const topGainers = [...data.movers].filter(m => m.changePct > 0).sort((a, b) => b.changePct - a.changePct).slice(0, 5);
  const topLosers = [...data.movers].filter(m => m.changePct < 0).sort((a, b) => a.changePct - b.changePct).slice(0, 5);
  const allMovers = [...topGainers, ...topLosers].sort((a, b) => Math.abs(b.dollarImpact) - Math.abs(a.dollarImpact)).slice(0, 6);
  const portfolioUp = data.portfolio.overnightChangePct >= 0;
  const topSector = data.sectorHeat.length > 0 ? data.sectorHeat.sort((a, b) => b.weight - a.weight)[0] : null;

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
      {/* Masthead */}
      <header className="border-b-2 border-[var(--color-gold)]">
        <div className="max-w-6xl mx-auto px-6 py-6 md:py-8">
          <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-[var(--color-gold)] mb-2" style={MONO}>{dateStr}</div>
              <div className="flex items-center gap-3">
                <HelmMark size={28} />
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight">The Helm Brief</h1>
              </div>
            </div>
            <div className="text-right" style={MONO}>
              <div className="text-xs tracking-[0.15em] text-[var(--color-text-muted)]">GENERATED {timeStr}</div>
              <div className="text-xs tracking-[0.15em] text-[var(--color-text-muted)] mt-1">{data.allHoldings.length} POSITIONS TRACKED</div>
            </div>
          </div>
        </div>
      </header>

      {/* Market snapshot */}
      <div className="bg-[#080808] border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-8">
          {[
            data.market.spy ? ['S&P 500', `$${data.market.spy.price.toFixed(2)}`, fmtPct(data.market.spy.changePct), data.market.spy.changePct >= 0] : ['S&P 500', '—', '—', true],
            data.market.qqq ? ['NASDAQ', `$${data.market.qqq.price.toFixed(2)}`, fmtPct(data.market.qqq.changePct), data.market.qqq.changePct >= 0] : ['NASDAQ', '—', '—', true],
            data.market.vix ? ['VIX', data.market.vix.price.toFixed(2), data.market.vix.level, true] : ['VIX', '—', '—', true],
            data.market.treasury10y ? ['10Y YIELD', `${data.market.treasury10y.yield.toFixed(2)}%`, '', true] : ['10Y', '—', '—', true],
          ].map(([label, value, delta, pos]) => (
            <div key={label as string}>
              <div className="text-[9px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]" style={MONO}>{label as string}</div>
              <div className="text-base font-bold mt-1 tabular-nums">{value as string}</div>
              {delta && <div className={`text-xs font-semibold mt-0.5 ${pos ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`} style={MONO}>{delta as string}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Two-column editorial */}
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[2.2fr_1fr] gap-12">
          {/* Main column */}
          <main className="space-y-10">
            {/* Portfolio overview */}
            <article>
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-gold)] mb-4" style={MONO}>§ YOUR PORTFOLIO</div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight leading-[1.08] mb-4">
                {portfolioUp ? 'Portfolio up' : 'Portfolio down'} {fmtPct(data.portfolio.overnightChangePct)} overnight.
                {data.portfolio.vsBenchmark !== null && (
                  <span className="text-[var(--color-text-muted)]">
                    {' '}{data.portfolio.vsBenchmark >= 0 ? 'Beating' : 'Trailing'} the S&P by {Math.abs(data.portfolio.vsBenchmark).toFixed(2)}%.
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] mb-6" style={MONO}>
                <span>HELM ANALYST · GPT-4O-MINI</span>
                <span>·</span>
                <span>{data.allHoldings.length} POSITIONS</span>
                <span>·</span>
                <span>{fmt(data.portfolio.totalValue)} TOTAL</span>
              </div>
              <p className="text-base leading-relaxed text-[var(--color-text-secondary)]" style={{ fontFamily: '"Source Serif Pro", Georgia, serif' }}>
                <span className="text-5xl float-left font-bold leading-[0.85] mr-2 mt-1 text-[var(--color-gold)]" style={{ fontFamily: 'var(--font-sans)' }}>
                  {portfolioUp ? 'Y' : 'A'}
                </span>
                {portfolioUp
                  ? `our portfolio gained ${fmt(Math.abs(data.portfolio.overnightChange))} since yesterday's close, a ${fmtPct(data.portfolio.overnightChangePct)} move.`
                  : ` ${Math.abs(data.portfolio.overnightChangePct).toFixed(2)}% drawdown took ${fmt(Math.abs(data.portfolio.overnightChange))} off your portfolio since yesterday's close.`}
                {' '}
                {allMovers.length > 0 && `${allMovers[0].ticker} was the biggest mover with a ${fmtPct(allMovers[0].changePct)} move, ${allMovers[0].changePct >= 0 ? 'adding' : 'costing'} ${fmt(Math.abs(allMovers[0].dollarImpact))} to your portfolio.`}
                {topSector && ` ${topSector.sector} remains your largest sector at ${topSector.weight.toFixed(1)}% allocation.`}
              </p>
            </article>

            {/* Movers table */}
            {allMovers.length > 0 && (
              <div className="border border-white/[0.06] rounded">
                <div className="px-4 py-2 border-b border-white/[0.06] bg-white/[0.02]">
                  <span className="text-xs uppercase tracking-[0.15em] text-[var(--color-text-muted)]" style={MONO}>YOUR TOP MOVERS</span>
                </div>
                {allMovers.map((m, i) => (
                  <div key={m.ticker} className={`grid grid-cols-[60px_1fr_80px_100px] gap-3 items-center px-4 py-3 ${i > 0 ? 'border-t border-white/[0.04]' : ''}`}>
                    <Link href={`/analyze/${m.ticker}`} className="font-mono text-sm font-bold text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] transition-colors">{m.ticker}</Link>
                    <span className="text-sm text-[var(--color-text-muted)] truncate">{m.name}</span>
                    <span className={`text-sm font-mono font-semibold text-right tabular-nums ${m.changePct >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>{fmtPct(m.changePct)}</span>
                    <span className={`text-sm font-mono text-right tabular-nums ${m.dollarImpact >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>{m.dollarImpact >= 0 ? '+' : ''}{fmt(m.dollarImpact)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Divider */}
            <div className="w-24 h-px mx-auto bg-gradient-to-r from-transparent via-[var(--color-gold)]/40 to-transparent" />

            {/* Earnings + Dividends */}
            {(data.earningsThisWeek.length > 0 || data.dividendsThisWeek.length > 0) && (
              <article>
                <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-gold)] mb-4" style={MONO}>§ THIS WEEK</div>
                {data.earningsThisWeek.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-bold mb-3">Earnings</h3>
                    <div className="space-y-2">
                      {data.earningsThisWeek.map(e => (
                        <div key={e.ticker} className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                          <div className="flex items-center gap-3">
                            <Link href={`/analyze/${e.ticker}`} className="font-mono font-bold text-[var(--color-gold)]">{e.ticker}</Link>
                            <span className="text-xs text-[var(--color-text-muted)]" style={MONO}>{e.reportDate}</span>
                          </div>
                          <span className="text-xs text-[var(--color-warning)]" style={MONO}>{e.portfolioWeight.toFixed(1)}% exposure</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {data.dividendsThisWeek.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold mb-3">Dividends</h3>
                    <div className="space-y-2">
                      {data.dividendsThisWeek.map(d => (
                        <div key={d.ticker} className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                          <Link href={`/analyze/${d.ticker}`} className="font-mono font-bold text-[var(--color-gold)]">{d.ticker}</Link>
                          <span className="text-xs text-[var(--color-text-muted)]" style={MONO}>Ex-date: {d.exDate}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            )}
          </main>

          {/* Sidebar — collapsible on mobile */}
          <aside>
            <button
              className="lg:hidden w-full flex items-center justify-between py-3 text-sm text-[var(--color-text-muted)] border-b border-white/[0.06] mb-4"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              Market Movers & Sectors
              <ChevronDown className={`w-4 h-4 transition-transform ${sidebarOpen ? 'rotate-180' : ''}`} />
            </button>

            <div className={`${sidebarOpen ? 'block' : 'hidden'} lg:block space-y-8`}>
              {/* Sector heat */}
              {data.sectorHeat.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-gold)] mb-4 pb-3 border-b border-[var(--color-gold)]/20" style={MONO}>§ Sector Heat</div>
                  {data.sectorHeat.sort((a, b) => b.weight - a.weight).map(s => (
                    <div key={s.sector} className="py-3 border-b border-white/[0.06]">
                      <div className="flex justify-between items-baseline">
                        <span className="text-sm font-medium">{s.sector}</span>
                        <span className={`text-xs font-mono font-bold ${s.changePct >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>{fmtPct(s.changePct)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                          <div className="h-full bg-[var(--color-gold)] rounded-full" style={{ width: `${s.weight}%` }} />
                        </div>
                        <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{s.weight.toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* All holdings by impact */}
              {data.allHoldings.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-gold)] mb-4 pb-3 border-b border-[var(--color-gold)]/20" style={MONO}>§ All Holdings</div>
                  {data.allHoldings.sort((a, b) => Math.abs(b.dollarImpact) - Math.abs(a.dollarImpact)).slice(0, 10).map(h => (
                    <div key={h.ticker} className="py-2.5 border-b border-white/[0.04] flex justify-between items-baseline">
                      <div>
                        <Link href={`/analyze/${h.ticker}`} className="font-mono text-sm font-bold text-[var(--color-gold)] hover:text-[var(--color-gold-hi)]">{h.ticker}</Link>
                        <span className="text-xs text-[var(--color-text-muted)] ml-2">{h.name}</span>
                      </div>
                      <span className={`text-xs font-mono font-semibold ${h.changePct >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>{fmtPct(h.changePct)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-4 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between text-[10px] text-[var(--color-text-muted)] uppercase tracking-[0.12em]" style={MONO}>
          <span>Model GPT-4o-mini · Sources: Finnhub · Polygon</span>
          <span>helmterminal.dev</span>
        </div>
      </footer>
    </div>
  );
}
