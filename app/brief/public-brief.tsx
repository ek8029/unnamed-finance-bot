'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';
import { HelmMark } from '@/components/helm-mark';
import { useLivePrices } from '@/hooks/use-live-prices';

interface Quote {
  symbol: string;
  price: number;
  changePct: number;
  change: number;
}

const NAMES: Record<string, string> = {
  SPY: 'S&P 500 ETF', QQQ: 'Nasdaq 100 ETF', NVDA: 'NVIDIA', AAPL: 'Apple',
  MSFT: 'Microsoft', GOOGL: 'Alphabet', META: 'Meta Platforms', AMZN: 'Amazon',
  TSLA: 'Tesla', AMD: 'AMD', AVGO: 'Broadcom', JPM: 'JPMorgan Chase',
};

const SECTORS: Record<string, string> = {
  NVDA: 'Semiconductors', AAPL: 'Consumer Electronics', MSFT: 'Software',
  GOOGL: 'Internet', META: 'Social Media', AMZN: 'E-Commerce',
  TSLA: 'Electric Vehicles', AMD: 'Semiconductors', AVGO: 'Semiconductors',
  JPM: 'Banking',
};

function fmtPrice(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}
function getMarketSession(): string {
  const etStr = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false });
  const [, timePart] = etStr.split(', ');
  const [hStr, mStr] = timePart.split(':');
  const mins = parseInt(hStr) * 60 + parseInt(mStr);
  if (mins < 570) return 'PRE-MARKET';
  if (mins < 960) return 'MARKET OPEN';
  return 'AFTER-HOURS';
}
function dayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
}
function moverReason(symbol: string, changePct: number, spyPct: number): string {
  const abs = Math.abs(changePct);
  const vs = changePct - spyPct;
  const absVs = Math.abs(vs);

  if (abs < 0.3) return 'Flat, trading in a tight range today';
  if (abs > 5) return `${changePct > 0 ? 'Up' : 'Down'} ${abs.toFixed(1)}%, largest move in the group`;
  if (abs > 2 && absVs > 1.5) return `${changePct > 0 ? 'Outpacing' : 'Underperforming'} the S&P by ${absVs.toFixed(1)}pp`;
  if (abs > 2) return `${changePct > 0 ? 'Up' : 'Down'} ${abs.toFixed(1)}%, roughly tracking the index`;
  if (absVs > 1) return `${vs > 0 ? '+' : ''}${vs.toFixed(1)}pp vs S&P, diverging from the tape`;
  return `${changePct > 0 ? 'Modestly green' : 'Modestly red'}, moving with the broader market`;
}

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const SERIF: React.CSSProperties = { fontFamily: '"Source Serif Pro", Georgia, "Times New Roman", serif' };

export function PublicBrief({ quotes: serverQuotes }: { quotes: Quote[] }) {
  // Live overlay: poll the public quotes endpoint every 60s and patch
  // prices onto the server-rendered snapshot (ISR revalidates every 5 min).
  // If the server snapshot is empty (vendor hiccup at render time), build
  // the list client-side from the known brief tickers.
  const symbols = useMemo(
    () => (serverQuotes.length > 0 ? serverQuotes.map((q) => q.symbol) : Object.keys(NAMES)),
    [serverQuotes],
  );
  const { quotes: liveQuotes } = useLivePrices(symbols, 60_000, '/api/market/quotes/public');
  const quotes = useMemo(() => {
    const base: Quote[] = serverQuotes.length > 0
      ? serverQuotes
      : Object.keys(NAMES).map((s) => ({ symbol: s, price: 0, changePct: 0, change: 0 }));
    return base
      .map((q) => {
        const lq = liveQuotes[q.symbol];
        if (!lq) return q;
        return {
          ...q,
          price: lq.price,
          changePct: lq.dayChangePct ?? q.changePct,
          change: lq.prevClose != null ? lq.price - lq.prevClose : q.change,
        };
      })
      .filter((q) => q.price > 0);
  }, [serverQuotes, liveQuotes]);

  const now = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dateStr = `${dayNames[now.getDay()]} · ${monthNames[now.getMonth()]} ${now.getDate()} · ${now.getFullYear()}`;
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
  const session = getMarketSession();
  const issueNum = dayOfYear();

  const spy = quotes.find((q) => q.symbol === 'SPY');
  const qqq = quotes.find((q) => q.symbol === 'QQQ');
  const stocks = quotes.filter((q) => !['SPY', 'QQQ'].includes(q.symbol));
  const gainers = [...stocks].filter((m) => m.changePct > 0).sort((a, b) => b.changePct - a.changePct);
  const losers = [...stocks].filter((m) => m.changePct < 0).sort((a, b) => a.changePct - b.changePct);
  const allMovers = [...stocks].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
  const biggestMover = allMovers[0];
  const spyUp = spy ? spy.changePct >= 0 : true;

  // Group by sector
  const sectorMap = new Map<string, Quote[]>();
  stocks.forEach((q) => {
    const sector = SECTORS[q.symbol] || 'Other';
    const existing = sectorMap.get(sector) || [];
    existing.push(q);
    sectorMap.set(sector, existing);
  });
  const sectors = [...sectorMap.entries()]
    .map(([name, tickers]) => ({
      name,
      tickers,
      avgChange: tickers.reduce((sum, t) => sum + t.changePct, 0) / tickers.length,
    }))
    .sort((a, b) => Math.abs(b.avgChange) - Math.abs(a.avgChange));

  // Generate headline
  let headline = 'Markets steady. Here is what is moving the biggest names today';
  if (spy) {
    const abs = Math.abs(spy.changePct);
    if (abs > 2) {
      headline = spyUp
        ? `A ${abs.toFixed(1)}% surge across the board. What is driving the rally`
        : `Markets deliver a ${abs.toFixed(1)}% blow. Where the damage is`;
    } else if (biggestMover && Math.abs(biggestMover.changePct) > 4) {
      headline = biggestMover.changePct > 0
        ? `${biggestMover.symbol} jumps ${biggestMover.changePct.toFixed(1)}%. The story behind the move`
        : `${biggestMover.symbol} drops ${Math.abs(biggestMover.changePct).toFixed(1)}%. What to watch`;
    } else if (abs > 0.5) {
      headline = spyUp
        ? `Broad gains across major names. ${gainers.length} of ${stocks.length} tracked stocks are green`
        : `Selling pressure on mega-caps. ${losers.length} of ${stocks.length} tracked stocks in the red`;
    }
  }

  const noData = quotes.length === 0;

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">

      {/* ═══ Nav ═══ */}
      <nav className="sticky top-0 z-50 bg-[rgba(10,10,10,0.72)] backdrop-blur-[20px] backdrop-saturate-[1.4] border-b border-[var(--color-border-base)]">
        <div className="max-w-[960px] mx-auto px-4 sm:px-6 h-[56px] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-[11px] font-bold tracking-[0.02em] uppercase text-[15px]">
            <HelmMark size={22} />
            Helm
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hidden sm:block text-[11px] tracking-[0.14em] uppercase text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors" style={MONO}>
              Log in
            </Link>
            <Link href="/signup" className="text-[11px] font-bold tracking-[0.16em] uppercase px-5 max-sm:px-4 py-2.5 rounded-[5px] bg-[var(--color-gold)] text-black hover:bg-[var(--color-gold-hi)] transition-all" style={MONO}>
              Sign up free &rarr;
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══ Masthead ═══ */}
      <header className="border-b-2 border-[var(--color-gold)]">
        <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-6 md:py-8">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div className="flex items-center gap-3 text-[11px] max-sm:text-[10px] uppercase tracking-[0.2em] max-sm:tracking-[0.12em] text-[var(--color-text-muted)]" style={MONO}>
              <span>Issue No. {issueNum}</span>
              <span className="text-[var(--color-border-subtle)]">|</span>
              <span>{session}</span>
            </div>
          </div>
          <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] max-sm:tracking-[0.12em] text-[var(--color-gold)] mb-2" style={MONO}>{dateStr}</div>
              <div className="flex items-center gap-3">
                <HelmMark size={28} />
                <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight">The Current</h1>
              </div>
            </div>
            <div className="text-left md:text-right" style={MONO}>
              <div className="text-[11px] max-sm:text-[10px] tracking-[0.15em] max-sm:tracking-[0.08em] text-[var(--color-text-muted)]">PRICES AS OF {timeStr}</div>
              <div className="text-[11px] max-sm:text-[10px] tracking-[0.15em] max-sm:tracking-[0.08em] text-[var(--color-text-muted)] mt-1">{stocks.length} MEGA-CAP STOCKS TRACKED</div>
              <div className="mt-2 text-[11px] max-sm:text-[10px] tracking-[0.1em] max-sm:tracking-[0.06em] text-[var(--color-gold)]">
                PUBLIC EDITION · REFRESHED EVERY 5 MIN
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ═══ Market Tape ═══ */}
      <div className="bg-[#080808] border-b border-white/[0.06]">
        <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-3" style={MONO}>BENCHMARKS</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6">
            {[spy, qqq].filter(Boolean).map((q) => (
              <div key={q!.symbol}>
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]" style={MONO}>{q!.symbol}</div>
                <div className="text-lg font-bold mt-1 tabular-nums">${fmtPrice(q!.price)}</div>
                <div className={`text-[13px] font-semibold mt-0.5 tabular-nums ${q!.changePct >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`} style={MONO}>
                  {fmtPct(q!.changePct)}
                </div>
              </div>
            ))}
            {biggestMover && (
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]" style={MONO}>TOP MOVER</div>
                <div className="text-lg font-bold mt-1 tabular-nums">{biggestMover.symbol}</div>
                <div className={`text-[13px] font-semibold mt-0.5 tabular-nums ${biggestMover.changePct >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`} style={MONO}>
                  {fmtPct(biggestMover.changePct)}
                </div>
              </div>
            )}
            {stocks.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]" style={MONO}>BREADTH</div>
                <div className="text-lg font-bold mt-1">{gainers.length} <span className="text-[var(--color-positive)] text-sm">&#9650;</span> {losers.length} <span className="text-[var(--color-negative)] text-sm">&#9660;</span></div>
                <div className="text-[13px] text-[var(--color-text-muted)] mt-0.5" style={MONO}>of {stocks.length} tracked</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Two-column layout ═══ */}
      <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[2.2fr_1fr] gap-8 lg:gap-12">

          {/* ══ MAIN COLUMN ══ */}
          <main className="space-y-10">

            {/* Lead story */}
            <article>
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-gold)] mb-4" style={MONO}>
                MARKET OVERVIEW
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-[2.75rem] font-bold tracking-tight leading-[1.08] mb-4">
                {headline}
              </h2>

              <div className="flex items-center gap-3 text-[11px] text-[var(--color-text-muted)] mb-6 flex-wrap" style={MONO}>
                <span>HELM ANALYST</span>
                <span>&middot;</span>
                <span>{stocks.length} STOCKS TRACKED</span>
                <span>&middot;</span>
                <span>5 MIN READ</span>
              </div>

              {spy && qqq && (
                <p className="text-[16px] sm:text-[18px] leading-[1.7] text-[var(--color-text-secondary)]" style={SERIF}>
                  <span className="float-left text-[3rem] sm:text-[4rem] font-bold leading-[0.8] mr-2 sm:mr-3 mt-[0.1em] text-[var(--color-gold)]" style={{ fontFamily: 'var(--font-sans)' }}>
                    {spyUp ? 'T' : 'M'}
                  </span>
                  {spyUp
                    ? `he S&P 500 is up ${fmtPct(spy.changePct)} at $${fmtPrice(spy.price)}, while the Nasdaq 100 gained ${fmtPct(qqq.changePct)} to $${fmtPrice(qqq.price)}.`
                    : `arkets are under pressure today. The S&P 500 is down ${fmtPct(spy.changePct)} at $${fmtPrice(spy.price)}, and the Nasdaq 100 lost ${fmtPct(qqq.changePct)} to $${fmtPrice(qqq.price)}.`}
                  {biggestMover && ` ${NAMES[biggestMover.symbol] || biggestMover.symbol} (${biggestMover.symbol}) is the standout today at ${fmtPct(biggestMover.changePct)}, trading at $${fmtPrice(biggestMover.price)}.`}
                  {gainers.length > 0 && losers.length > 0
                    ? ` Of the ${stocks.length} mega-cap names we track, ${gainers.length} are in the green and ${losers.length} are red.`
                    : ''}
                  {' '}
                  {Math.abs(spy.changePct) < 0.5
                    ? 'A relatively quiet session with no major catalysts driving direction. Range-bound trading suggests the market is waiting for its next signal.'
                    : spy.changePct > 1
                      ? 'Broad participation across sectors signals conviction behind the move. Volume and breadth will tell us whether this holds into the close.'
                      : spy.changePct < -1
                        ? 'Risk-off sentiment is weighing on equities. Watch VIX and bond yields for signs of whether this is a dip or the start of something larger.'
                        : 'The market is making a move but conviction remains moderate. Keep an eye on closing action.'}
                </p>
              )}

              {noData && (
                <p className="text-[16px] text-[var(--color-text-muted)]" style={SERIF}>
                  Market data is temporarily unavailable. Check back in a moment.
                </p>
              )}
            </article>

            {/* Movers table */}
            {allMovers.length > 0 && (
              <article>
                <h2 className="text-xs uppercase tracking-[0.2em] text-[var(--color-gold)] mb-4" style={MONO}>
                  TODAY&rsquo;S MOVERS
                </h2>
                <div className="border border-white/[0.06] rounded overflow-hidden">
                  <div className="grid grid-cols-[60px_1fr_80px] sm:grid-cols-[80px_1fr_90px] gap-2 sm:gap-3 items-center px-3 sm:px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.06]">
                    <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]" style={MONO}>Ticker</span>
                    <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]" style={MONO}>Name</span>
                    <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] text-right" style={MONO}>Change</span>
                  </div>
                  {allMovers.map((m) => (
                    <Link
                      key={m.symbol}
                      href={`/analyze/${m.symbol}`}
                      className="grid grid-cols-[60px_1fr_80px] sm:grid-cols-[80px_1fr_90px] gap-2 sm:gap-3 items-center px-3 sm:px-4 py-3.5 border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                    >
                      <span className="font-mono text-[13px] sm:text-[15px] font-bold text-[var(--color-gold)]">
                        {m.symbol}
                      </span>
                      <span className="text-[13px] sm:text-[15px] text-[var(--color-text-muted)] truncate">{NAMES[m.symbol] || m.symbol}</span>
                      <span className={`text-[13px] sm:text-[15px] font-mono font-semibold text-right tabular-nums ${m.changePct >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>
                        {fmtPct(m.changePct)}
                      </span>
                    </Link>
                  ))}
                </div>
              </article>
            )}

            {/* Sector breakdown */}
            {sectors.length > 0 && (
              <article>
                <h2 className="text-xs uppercase tracking-[0.2em] text-[var(--color-gold)] mb-4" style={MONO}>
                  SECTOR HEAT
                </h2>
                <div className="space-y-3">
                  {sectors.map((s) => (
                    <div key={s.name} className="py-3 border-b border-white/[0.06]">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[15px] font-medium">{s.name}</span>
                        <span className={`text-[15px] font-mono font-bold tabular-nums ${s.avgChange >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>
                          {fmtPct(s.avgChange)}
                        </span>
                      </div>
                      <div className="text-[12px] text-[var(--color-text-muted)] mt-1 font-mono">
                        {s.tickers.map((t) => t.symbol).join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            )}

            <div className="w-24 h-px mx-auto bg-gradient-to-r from-transparent via-[var(--color-gold)]/40 to-transparent" />

            {/* CTA */}
            <article className="border border-[var(--color-border-base)] rounded-lg p-6 sm:p-8 bg-[var(--color-bg-surface)]">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-2">
                This is the public brief. <span className="text-[var(--color-text-muted)]">Yours is better.</span>
              </h2>
              <p className="text-[15px] text-[var(--color-text-secondary)] leading-relaxed mb-6 max-w-[520px]" style={SERIF}>
                Connect your brokerage and The Current writes about your positions, your movers, your exposure. Dollar impact on every move. AI digest that reads your portfolio, not just the tape. Tax-loss harvest alerts when your positions dip.
              </p>
              <div className="flex gap-3 flex-wrap">
                <Link href="/signup" className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.16em] uppercase px-[22px] py-[13px] rounded-[5px] bg-[var(--color-gold)] text-black shadow-[0_6px_22px_rgba(230,185,77,0.22)] hover:bg-[var(--color-gold-hi)] transition-all" style={MONO}>
                  Get your personalized brief &rarr;
                </Link>
                <Link href="/analyze" className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.16em] uppercase px-[22px] py-[13px] rounded-[5px] border border-[var(--color-border-strong)] text-[var(--color-text-primary)] hover:border-[rgba(255,255,255,0.28)] transition-all" style={MONO}>
                  Try a free analysis
                </Link>
              </div>
            </article>
          </main>

          {/* ══ SIDEBAR ══ */}
          <aside className="space-y-8">

            {/* Market movers with reasoning */}
            {allMovers.length > 0 && (
              <div>
                <h2 className="text-[13px] uppercase tracking-[0.2em] text-[var(--color-gold)] mb-4 pb-3 border-b border-[var(--color-gold)]/20" style={MONO}>
                  Market Movers
                </h2>
                {allMovers.slice(0, 5).map((m) => (
                  <div key={m.symbol} className="py-3 border-b border-white/[0.04]">
                    <div className="flex justify-between items-baseline">
                      <Link href={`/analyze/${m.symbol}`} className="font-mono text-[15px] font-bold text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] transition-colors">
                        {m.symbol}
                      </Link>
                      <span className={`text-[15px] font-mono font-bold tabular-nums ${m.changePct >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>
                        {fmtPct(m.changePct)}
                      </span>
                    </div>
                    <div className="text-[13px] text-[var(--color-text-muted)] mt-0.5 leading-snug" style={SERIF}>
                      {moverReason(m.symbol, m.changePct, spy?.changePct ?? 0)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Day at a glance */}
            {gainers.length > 0 && losers.length > 0 && (
              <div className="bg-white/[0.02] rounded p-4 border border-white/[0.06]">
                <div className="text-[12px] uppercase tracking-wider text-[var(--color-text-muted)] mb-3" style={MONO}>
                  Day at a Glance
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-[12px] text-[var(--color-positive)] uppercase tracking-wider" style={MONO}>Best Performer</div>
                    <div className="flex justify-between items-baseline mt-1">
                      <span className="font-mono text-[15px] font-bold">{gainers[0].symbol}</span>
                      <span className="font-mono text-[15px] font-bold text-[var(--color-positive)]">{fmtPct(gainers[0].changePct)}</span>
                    </div>
                    <div className="text-[13px] text-[var(--color-text-muted)]">{NAMES[gainers[0].symbol] || gainers[0].symbol}</div>
                  </div>
                  <div className="h-px bg-white/[0.06]" />
                  <div>
                    <div className="text-[12px] text-[var(--color-negative)] uppercase tracking-wider" style={MONO}>Worst Performer</div>
                    <div className="flex justify-between items-baseline mt-1">
                      <span className="font-mono text-[15px] font-bold">{losers[0].symbol}</span>
                      <span className="font-mono text-[15px] font-bold text-[var(--color-negative)]">{fmtPct(losers[0].changePct)}</span>
                    </div>
                    <div className="text-[13px] text-[var(--color-text-muted)]">{NAMES[losers[0].symbol] || losers[0].symbol}</div>
                  </div>
                </div>
              </div>
            )}

            {/* What you'd get */}
            <div className="border border-[var(--color-gold-border)] rounded-lg p-4 bg-[var(--color-gold-surface)]">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-gold)] mb-3" style={MONO}>
                With a connected account
              </div>
              <ul className="space-y-2.5 text-[13px] text-[var(--color-text-muted)]">
                {[
                  'Dollar impact on every move',
                  'AI digest written about your holdings',
                  'Sector exposure and concentration risk',
                  'Tax-loss harvest alerts',
                  'Earnings exposure warnings',
                  'Personalized movers table',
                ].map((item) => (
                  <li key={item} className="flex gap-2 items-start">
                    <span className="text-[var(--color-gold)] mt-0.5" style={MONO}>&#10003;</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>

      {/* ═══ Footer ═══ */}
      <footer className="border-t border-white/[0.06] py-4 px-4 sm:px-6">
        <div className="max-w-[960px] mx-auto flex flex-col sm:flex-row justify-between text-[11px] text-[var(--color-text-muted)] uppercase tracking-[0.12em] gap-2" style={MONO}>
          <span>Sources: Finazon &middot; Refreshed every 5 min &middot; Not investment advice</span>
          <Link href="/" className="text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] transition-colors">helmterminal.dev</Link>
        </div>
      </footer>
    </div>
  );
}
