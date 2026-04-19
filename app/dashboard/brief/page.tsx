'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';
import { ChevronDown, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface NewsItem {
  id: string;
  title: string;
  summary: string | null;
  source: string | null;
  url: string | null;
  publishedAt: string;
  ticker: string | null;
  sentiment: number | null;
  isHolding: boolean;
}

interface BriefData {
  portfolio: { totalValue: number; overnightChange: number; overnightChangePct: number; vsBenchmark: number | null };
  market: { spy: { price: number; changePct: number } | null; qqq: { price: number; changePct: number } | null; vix: { price: number; level: string } | null; treasury: { price: number; changePct: number } | null };
  movers: { ticker: string; name: string; sector: string; changePct: number; dollarImpact: number }[];
  allHoldings: { ticker: string; name: string; sector: string; changePct: number; dollarImpact: number }[];
  sectorHeat: { sector: string; weight: number; changePct: number; tickers: string[] }[];
  earningsThisWeek: { ticker: string; reportDate: string; portfolioWeight: number }[];
  dividendsThisWeek: { ticker: string; exDate: string }[];
  positionNews: NewsItem[];
  generalNews: NewsItem[];
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const SERIF: React.CSSProperties = { fontFamily: '"Source Serif Pro", Georgia, "Times New Roman", serif' };

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
        <div className="border-b-2 border-[var(--color-gold)]/30 animate-pulse">
          <div className="max-w-6xl mx-auto px-6 py-8">
            <div className="h-3 w-48 bg-white/[0.06] rounded mb-3" />
            <div className="h-10 w-96 bg-white/[0.06] rounded" />
          </div>
        </div>
        <div className="bg-[#080808] border-b border-white/[0.06] animate-pulse">
          <div className="max-w-6xl mx-auto px-6 py-5 grid grid-cols-2 sm:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => <div key={i}><div className="h-2 w-16 bg-white/[0.04] rounded mb-2" /><div className="h-5 w-20 bg-white/[0.06] rounded" /></div>)}
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 py-10 animate-pulse space-y-6">
          <div className="h-3 w-32 bg-[var(--color-gold)]/10 rounded" />
          <div className="h-8 w-3/4 bg-white/[0.06] rounded" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-white/[0.04] rounded" />)}
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
  const allMovers = [...topGainers, ...topLosers].sort((a, b) => Math.abs(b.dollarImpact) - Math.abs(a.dollarImpact)).slice(0, 8);
  const portfolioUp = data.portfolio.overnightChangePct >= 0;
  const topSector = data.sectorHeat.length > 0 ? data.sectorHeat.sort((a, b) => b.weight - a.weight)[0] : null;
  const biggestMover = allMovers[0] || null;

  // Generate the lead headline
  const leadHeadline = portfolioUp
    ? `Your portfolio gained ${fmt(Math.abs(data.portfolio.overnightChange))} overnight`
    : `Your portfolio lost ${fmt(Math.abs(data.portfolio.overnightChange))} overnight`;

  // Market summary sentence
  const spyDir = data.market.spy ? (data.market.spy.changePct >= 0 ? 'up' : 'down') : null;
  const qqqDir = data.market.qqq ? (data.market.qqq.changePct >= 0 ? 'up' : 'down') : null;

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
      {/* ═══ Masthead ═══ */}
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
              <div className="text-xs tracking-[0.15em] text-[var(--color-text-muted)] mt-1">{data.allHoldings.length} POSITIONS · {fmt(data.portfolio.totalValue)}</div>
            </div>
          </div>
        </div>
      </header>

      {/* ═══ Market Tape ═══ */}
      <div className="bg-[#080808] border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-8">
          {[
            data.market.spy ? ['S&P 500', `$${data.market.spy.price.toFixed(2)}`, fmtPct(data.market.spy.changePct), data.market.spy.changePct >= 0] : ['S&P 500', '—', '—', true],
            data.market.qqq ? ['NASDAQ', `$${data.market.qqq.price.toFixed(2)}`, fmtPct(data.market.qqq.changePct), data.market.qqq.changePct >= 0] : ['NASDAQ', '—', '—', true],
            data.market.vix ? ['VIX', data.market.vix.price.toFixed(2), data.market.vix.level.replace(/_/g, ' '), data.market.vix.price < 20] : ['VIX', '—', '—', true],
            data.market.treasury ? ['BONDS (TLT)', `$${data.market.treasury.price.toFixed(2)}`, fmtPct(data.market.treasury.changePct), data.market.treasury.changePct >= 0] : ['BONDS', '—', '—', true],
          ].map(([label, value, delta, pos]) => (
            <div key={label as string}>
              <div className="text-[9px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]" style={MONO}>{label as string}</div>
              <div className="text-base font-bold mt-1 tabular-nums">{value as string}</div>
              {delta && <div className={`text-xs font-semibold mt-0.5 ${pos ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`} style={MONO}>{delta as string}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* ═══ Two-column editorial ═══ */}
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[2.2fr_1fr] gap-12">

          {/* ══ MAIN COLUMN ══ */}
          <main className="space-y-10">

            {/* ── Lead story: Portfolio headline ── */}
            <article>
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-gold)] mb-4" style={MONO}>§ YOUR PORTFOLIO</div>
              <h2 className="text-3xl md:text-[2.75rem] font-bold tracking-tight leading-[1.08] mb-4">
                {leadHeadline}.
                {data.portfolio.vsBenchmark !== null && (
                  <span className="text-[var(--color-text-muted)]">
                    {' '}{data.portfolio.vsBenchmark >= 0 ? 'Beating' : 'Trailing'} the S&P by {Math.abs(data.portfolio.vsBenchmark).toFixed(2)}%.
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] mb-6" style={MONO}>
                <span>HELM ANALYST</span>
                <span>·</span>
                <span>{data.allHoldings.length} POSITIONS</span>
                <span>·</span>
                <span>{fmt(data.portfolio.totalValue)} TOTAL</span>
              </div>
              <p className="text-base leading-relaxed text-[var(--color-text-secondary)]" style={SERIF}>
                <span className="text-5xl float-left font-bold leading-[0.85] mr-2 mt-1 text-[var(--color-gold)]" style={{ fontFamily: 'var(--font-sans)' }}>
                  {portfolioUp ? 'Y' : 'A'}
                </span>
                {portfolioUp
                  ? `our portfolio gained ${fmt(Math.abs(data.portfolio.overnightChange))} since yesterday's close, a ${fmtPct(data.portfolio.overnightChangePct)} move that puts your total at ${fmt(data.portfolio.totalValue)}.`
                  : ` ${Math.abs(data.portfolio.overnightChangePct).toFixed(2)}% drawdown took ${fmt(Math.abs(data.portfolio.overnightChange))} off your portfolio since yesterday's close.`}
                {' '}
                {data.market.spy && `The broader market (S&P 500) was ${spyDir} ${fmtPct(data.market.spy.changePct)}`}
                {data.market.qqq && ` while the Nasdaq moved ${qqqDir} ${fmtPct(data.market.qqq.changePct)}.`}
                {biggestMover && ` ${biggestMover.name} (${biggestMover.ticker}) was your biggest mover at ${fmtPct(biggestMover.changePct)}, ${biggestMover.changePct >= 0 ? 'adding' : 'costing'} ${fmt(Math.abs(biggestMover.dollarImpact))} to your portfolio.`}
                {topSector && ` ${topSector.sector} remains your largest sector exposure at ${topSector.weight.toFixed(1)}%.`}
              </p>
            </article>

            {/* ── Position news ── */}
            {data.positionNews.length > 0 && (
              <article>
                <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-gold)] mb-4" style={MONO}>§ NEWS AFFECTING YOUR POSITIONS</div>
                <div className="space-y-5">
                  {data.positionNews.slice(0, 5).map((news, i) => (
                    <div key={news.id} className={i > 0 ? 'pt-5 border-t border-white/[0.06]' : ''}>
                      <div className="flex items-center gap-2 mb-1.5">
                        {news.ticker && (
                          <Link href={`/dashboard/analyze/${news.ticker}`} className="font-mono text-xs font-bold text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] transition-colors px-1.5 py-0.5 bg-[var(--color-gold)]/10 rounded">
                            {news.ticker}
                          </Link>
                        )}
                        <SentimentBadge value={news.sentiment} />
                        <span className="text-[10px] text-[var(--color-text-muted)]" style={MONO}>{news.source} · {timeAgo(news.publishedAt)}</span>
                      </div>
                      <h3 className="text-lg font-bold leading-snug mb-1">
                        {news.url ? (
                          <a href={news.url} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-gold)] transition-colors">
                            {news.title}
                          </a>
                        ) : news.title}
                      </h3>
                      {news.summary && (
                        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed line-clamp-2" style={SERIF}>{news.summary}</p>
                      )}
                    </div>
                  ))}
                </div>
              </article>
            )}

            {/* ── Movers table ── */}
            {allMovers.length > 0 && (
              <article>
                <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-gold)] mb-4" style={MONO}>§ YOUR TOP MOVERS</div>
                <div className="border border-white/[0.06] rounded overflow-hidden">
                  <div className="grid grid-cols-[60px_1fr_80px_100px] gap-3 items-center px-4 py-2 bg-white/[0.02] border-b border-white/[0.06]">
                    <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]" style={MONO}>Ticker</span>
                    <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]" style={MONO}>Name</span>
                    <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)] text-right" style={MONO}>Change</span>
                    <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)] text-right" style={MONO}>Impact</span>
                  </div>
                  {allMovers.map((m) => (
                    <div key={m.ticker} className="grid grid-cols-[60px_1fr_80px_100px] gap-3 items-center px-4 py-3 border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <Link href={`/dashboard/analyze/${m.ticker}`} className="font-mono text-sm font-bold text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] transition-colors">{m.ticker}</Link>
                      <span className="text-sm text-[var(--color-text-muted)] truncate">{m.name}</span>
                      <span className={`text-sm font-mono font-semibold text-right tabular-nums ${m.changePct >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>{fmtPct(m.changePct)}</span>
                      <span className={`text-sm font-mono text-right tabular-nums ${m.dollarImpact >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>{m.dollarImpact >= 0 ? '+' : ''}{fmt(m.dollarImpact)}</span>
                    </div>
                  ))}
                </div>
              </article>
            )}

            {/* ── General market headlines ── */}
            {data.generalNews.length > 0 && (
              <article>
                <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-gold)] mb-4" style={MONO}>§ MARKET HEADLINES</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {data.generalNews.slice(0, 6).map((news) => (
                    <div key={news.id} className="group">
                      <div className="flex items-center gap-2 mb-1">
                        {news.ticker && (
                          <span className="font-mono text-[10px] font-bold text-[var(--color-text-muted)]">{news.ticker}</span>
                        )}
                        <span className="text-[10px] text-[var(--color-text-muted)]" style={MONO}>{news.source} · {timeAgo(news.publishedAt)}</span>
                      </div>
                      <h3 className="text-[15px] font-semibold leading-snug">
                        {news.url ? (
                          <a href={news.url} target="_blank" rel="noopener noreferrer" className="group-hover:text-[var(--color-gold)] transition-colors">
                            {news.title}
                            <ExternalLink className="inline-block w-3 h-3 ml-1 opacity-0 group-hover:opacity-50 transition-opacity" />
                          </a>
                        ) : news.title}
                      </h3>
                    </div>
                  ))}
                </div>
              </article>
            )}

            <div className="w-24 h-px mx-auto bg-gradient-to-r from-transparent via-[var(--color-gold)]/40 to-transparent" />

            {/* ── Earnings + Dividends ── */}
            {(data.earningsThisWeek.length > 0 || data.dividendsThisWeek.length > 0) && (
              <article>
                <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-gold)] mb-4" style={MONO}>§ THIS WEEK</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {data.earningsThisWeek.length > 0 && (
                    <div>
                      <h3 className="text-lg font-bold mb-3">Earnings on Deck</h3>
                      <div className="space-y-2">
                        {data.earningsThisWeek.map(e => (
                          <div key={e.ticker} className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                            <div className="flex items-center gap-3">
                              <Link href={`/dashboard/analyze/${e.ticker}`} className="font-mono font-bold text-[var(--color-gold)]">{e.ticker}</Link>
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
                      <h3 className="text-lg font-bold mb-3">Upcoming Dividends</h3>
                      <div className="space-y-2">
                        {data.dividendsThisWeek.map(d => (
                          <div key={d.ticker} className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                            <Link href={`/dashboard/analyze/${d.ticker}`} className="font-mono font-bold text-[var(--color-gold)]">{d.ticker}</Link>
                            <span className="text-xs text-[var(--color-text-muted)]" style={MONO}>Ex-date: {d.exDate}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </article>
            )}
          </main>

          {/* ══ SIDEBAR ══ */}
          <aside>
            <button
              className="lg:hidden w-full flex items-center justify-between py-3 text-sm text-[var(--color-text-muted)] border-b border-white/[0.06] mb-4"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              Sectors & Holdings
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
                      <div className="text-[10px] text-[var(--color-text-muted)] mt-1 font-mono">{s.tickers.join(', ')}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* All holdings by impact */}
              {data.allHoldings.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-gold)] mb-4 pb-3 border-b border-[var(--color-gold)]/20" style={MONO}>§ All Holdings</div>
                  {data.allHoldings.sort((a, b) => Math.abs(b.dollarImpact) - Math.abs(a.dollarImpact)).slice(0, 15).map(h => (
                    <div key={h.ticker} className="py-2.5 border-b border-white/[0.04] flex justify-between items-baseline">
                      <div>
                        <Link href={`/dashboard/analyze/${h.ticker}`} className="font-mono text-sm font-bold text-[var(--color-gold)] hover:text-[var(--color-gold-hi)]">{h.ticker}</Link>
                        <span className="text-xs text-[var(--color-text-muted)] ml-2">{h.name}</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-xs font-mono font-semibold ${h.changePct >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>{fmtPct(h.changePct)}</span>
                        <span className={`text-[10px] font-mono ${h.dollarImpact >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>{h.dollarImpact >= 0 ? '+' : ''}{fmt(h.dollarImpact)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick snapshot: biggest gainer & loser */}
              {topGainers.length > 0 && topLosers.length > 0 && (
                <div className="bg-white/[0.02] rounded p-4 border border-white/[0.06]">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-3" style={MONO}>Day at a Glance</div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-[10px] text-[var(--color-positive)] uppercase tracking-wider" style={MONO}>Best Performer</div>
                      <div className="flex justify-between items-baseline mt-1">
                        <span className="font-mono text-sm font-bold">{topGainers[0].ticker}</span>
                        <span className="font-mono text-sm font-bold text-[var(--color-positive)]">{fmtPct(topGainers[0].changePct)}</span>
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">{topGainers[0].name}</div>
                    </div>
                    <div className="h-px bg-white/[0.06]" />
                    <div>
                      <div className="text-[10px] text-[var(--color-negative)] uppercase tracking-wider" style={MONO}>Worst Performer</div>
                      <div className="flex justify-between items-baseline mt-1">
                        <span className="font-mono text-sm font-bold">{topLosers[0].ticker}</span>
                        <span className="font-mono text-sm font-bold text-[var(--color-negative)]">{fmtPct(topLosers[0].changePct)}</span>
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">{topLosers[0].name}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* ═══ Footer ═══ */}
      <footer className="border-t border-white/[0.06] py-4 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between text-[10px] text-[var(--color-text-muted)] uppercase tracking-[0.12em]" style={MONO}>
          <span>Sources: Finnhub · Polygon · Market News</span>
          <span>helmterminal.dev</span>
        </div>
      </footer>
    </div>
  );
}

function SentimentBadge({ value }: { value: number | null }) {
  if (value === null) return null;
  if (value > 0.2) return <span className="flex items-center gap-0.5 text-[10px] text-[var(--color-positive)]" style={{ fontFamily: 'var(--font-mono)' }}><TrendingUp className="w-3 h-3" />Bullish</span>;
  if (value < -0.2) return <span className="flex items-center gap-0.5 text-[10px] text-[var(--color-negative)]" style={{ fontFamily: 'var(--font-mono)' }}><TrendingDown className="w-3 h-3" />Bearish</span>;
  return <span className="flex items-center gap-0.5 text-[10px] text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}><Minus className="w-3 h-3" />Neutral</span>;
}
