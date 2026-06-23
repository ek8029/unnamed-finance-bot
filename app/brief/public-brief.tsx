'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';
import { HelmMark } from '@/components/helm-mark';
import { useLivePrices } from '@/hooks/use-live-prices';
import { PriceFlash } from '@/components/price-flash';

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
    <div className="min-h-screen bg-[var(--color-bg-inset,#060606)] text-[#FAFAFA]">

      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-[rgba(6,6,6,0.78)] backdrop-blur-[20px] backdrop-saturate-[1.4] border-b border-white/[0.07]">
        <div className="max-w-[1040px] mx-auto px-4 sm:px-6 h-[58px] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-[11px] font-bold tracking-[0.16em] uppercase text-[15px] text-[var(--color-gold)]" style={MONO}>
            <HelmMark size={22} />
            Helm
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hidden sm:block font-mono text-[10px] font-semibold tracking-[0.18em] uppercase text-[#7A7A7A] hover:text-[#FAFAFA] transition-colors" style={MONO}>
              Log in
            </Link>
            <Link href="/signup" className="font-mono text-[10px] font-semibold tracking-[0.18em] uppercase px-5 max-sm:px-4 py-2.5 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] hover:bg-[var(--color-gold-hi,#FFD67A)] transition-all" style={MONO}>
              Sign up free &rarr;
            </Link>
          </div>
        </div>
      </nav>

      {/* Masthead */}
      <header className="border-b border-white/[0.07]" style={{ borderTop: '2px solid rgba(230,185,77,0.30)' }}>
        <div className="max-w-[1040px] mx-auto px-4 sm:px-6 py-8 md:py-10">
          <div className="flex items-center gap-3 flex-wrap mb-5">
            <span className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded border border-white/[0.07]" style={MONO}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#4ADE80', boxShadow: '0 0 7px #4ADE80' }} />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#4ADE80]">{session}</span>
            </span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6A6A6A] tabular-nums" style={MONO}>Issue No. {issueNum}</span>
          </div>
          <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-6">
            <div>
              <div className="font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)] mb-3 tabular-nums" style={MONO}>{dateStr}</div>
              <div className="flex items-center gap-3">
                <HelmMark size={28} />
                <h1 className="type-display text-[40px] sm:text-[52px] md:text-[56px] font-bold tracking-tight leading-[0.95]">The Current</h1>
              </div>
            </div>
            <div className="text-left md:text-right space-y-1.5" style={MONO}>
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7A7A7A] tabular-nums">Prices as of {timeStr}</div>
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7A7A7A] tabular-nums">{stocks.length} mega-cap stocks tracked</div>
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-gold)]">
                Public edition, refreshed every 5 min
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Market Tape */}
      <div className="bg-[var(--color-bg-base,#0A0A0A)] border-b border-white/[0.07]">
        <div className="max-w-[1040px] mx-auto px-4 sm:px-6 py-5">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6A6A6A] mb-4" style={MONO}>Benchmarks</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {[spy, qqq].filter(Boolean).map((q) => (
              <div key={q!.symbol} className="rounded-lg border border-white/[0.07] bg-[var(--color-bg-elevated,#131313)] px-4 py-3.5">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7A7A7A]" style={MONO}>{q!.symbol}</div>
                <div className="type-data-sm text-[20px] font-bold mt-1.5 tabular-nums"><PriceFlash value={q!.price}>${fmtPrice(q!.price)}</PriceFlash></div>
                <div className="font-mono text-[14px] font-semibold mt-1 tabular-nums" style={{ ...MONO, color: q!.changePct >= 0 ? '#4ADE80' : '#F87171' }}>
                  {fmtPct(q!.changePct)}
                </div>
              </div>
            ))}
            {biggestMover && (
              <div className="rounded-lg border border-white/[0.07] bg-[var(--color-bg-elevated,#131313)] px-4 py-3.5">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7A7A7A]" style={MONO}>Top mover</div>
                <div className="type-data-sm text-[20px] font-bold mt-1.5 tabular-nums">{biggestMover.symbol}</div>
                <div className="font-mono text-[14px] font-semibold mt-1 tabular-nums" style={{ ...MONO, color: biggestMover.changePct >= 0 ? '#4ADE80' : '#F87171' }}>
                  {fmtPct(biggestMover.changePct)}
                </div>
              </div>
            )}
            {stocks.length > 0 && (
              <div className="rounded-lg border border-white/[0.07] bg-[var(--color-bg-elevated,#131313)] px-4 py-3.5">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7A7A7A]" style={MONO}>Breadth</div>
                <div className="type-data-sm text-[20px] font-bold mt-1.5 tabular-nums">{gainers.length} <span className="text-[14px]" style={{ color: '#4ADE80' }}>&#9650;</span> {losers.length} <span className="text-[14px]" style={{ color: '#F87171' }}>&#9660;</span></div>
                <div className="font-mono text-[14px] text-[#6A6A6A] mt-1 tabular-nums" style={MONO}>of {stocks.length} tracked</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="max-w-[1040px] mx-auto px-4 sm:px-6 py-10 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[2.2fr_1fr] gap-8 lg:gap-12">

          {/* Main column */}
          <main className="space-y-12">

            {/* Lead story */}
            <article>
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)] mb-4" style={MONO}>
                Market overview
              </div>
              <h2 className="text-[28px] sm:text-[34px] md:text-[40px] font-bold tracking-tight leading-[1.08] mb-5 text-[#FAFAFA]">
                {headline}
              </h2>

              <div className="flex items-center gap-3 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6A6A6A] mb-7 flex-wrap" style={MONO}>
                <span>Helm analyst</span>
                <span>&middot;</span>
                <span className="tabular-nums">{stocks.length} stocks tracked</span>
                <span>&middot;</span>
                <span>5 min read</span>
              </div>

              {spy && qqq && (
                <p className="text-[17px] sm:text-[18px] leading-[1.7] text-[#B8B8B8] m-0 border-l border-white/[0.08] pl-5">
                  {spyUp
                    ? `The S&P 500 is up ${fmtPct(spy.changePct)} at $${fmtPrice(spy.price)}, while the Nasdaq 100 gained ${fmtPct(qqq.changePct)} to $${fmtPrice(qqq.price)}.`
                    : `Markets are under pressure today. The S&P 500 is down ${fmtPct(spy.changePct)} at $${fmtPrice(spy.price)}, and the Nasdaq 100 lost ${fmtPct(qqq.changePct)} to $${fmtPrice(qqq.price)}.`}
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
                <p className="text-[16px] text-[#7A7A7A] m-0">
                  Market data is temporarily unavailable. Check back in a moment.
                </p>
              )}
            </article>

            {/* Movers table */}
            {allMovers.length > 0 && (
              <article>
                <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)] mb-4" style={MONO}>
                  Today&rsquo;s movers
                </h2>
                <div className="rounded-xl border border-white/[0.07] bg-[var(--color-bg-elevated,#131313)] overflow-hidden">
                  <div className="grid grid-cols-[60px_1fr_80px] sm:grid-cols-[90px_1fr_100px] gap-2 sm:gap-3 items-center px-4 sm:px-5 py-3 bg-white/[0.02] border-b border-white/[0.07]">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6A6A6A]" style={MONO}>Ticker</span>
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6A6A6A]" style={MONO}>Name</span>
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6A6A6A] text-right" style={MONO}>Change</span>
                  </div>
                  {allMovers.map((m) => (
                    <Link
                      key={m.symbol}
                      href={`/analyze/${m.symbol}`}
                      className="grid grid-cols-[60px_1fr_80px] sm:grid-cols-[90px_1fr_100px] gap-2 sm:gap-3 items-center px-4 sm:px-5 py-4 border-t border-white/[0.05] hover:bg-white/[0.025] transition-colors"
                    >
                      <span className="font-mono text-[15px] sm:text-[16px] font-bold text-[var(--color-gold)] tabular-nums">
                        {m.symbol}
                      </span>
                      <span className="text-[15px] sm:text-[16px] text-[#B8B8B8] truncate">{NAMES[m.symbol] || m.symbol}</span>
                      <span className="font-mono text-[15px] sm:text-[16px] font-semibold text-right tabular-nums" style={{ color: m.changePct >= 0 ? '#4ADE80' : '#F87171' }}>
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
                <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)] mb-4" style={MONO}>
                  Sector heat
                </h2>
                <div className="rounded-xl border border-white/[0.07] bg-[var(--color-bg-elevated,#131313)] divide-y divide-white/[0.05]">
                  {sectors.map((s) => (
                    <div key={s.name} className="px-4 sm:px-5 py-4">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[16px] font-semibold text-[#FAFAFA]">{s.name}</span>
                        <span className="font-mono text-[16px] font-bold tabular-nums" style={{ color: s.avgChange >= 0 ? '#4ADE80' : '#F87171' }}>
                          {fmtPct(s.avgChange)}
                        </span>
                      </div>
                      <div className="font-mono text-[13px] text-[#6A6A6A] mt-1.5 tabular-nums" style={MONO}>
                        {s.tickers.map((t) => t.symbol).join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            )}

            <div className="w-24 h-px mx-auto bg-gradient-to-r from-transparent via-[var(--color-gold)]/40 to-transparent" />

            {/* CTA */}
            <article className="rounded-xl border border-white/[0.07] bg-[var(--color-bg-elevated,#131313)] p-6 sm:p-8" style={{ borderTop: '2px solid rgba(230,185,77,0.30)' }}>
              <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight mb-3 text-[#FAFAFA]">
                This is the public brief. <span className="text-[#7A7A7A]">Yours is better.</span>
              </h2>
              <p className="text-[15px] sm:text-[16px] text-[#B8B8B8] leading-[1.65] mb-7 max-w-[520px]">
                Connect your brokerage and The Current writes about your positions, your movers, your exposure. Dollar impact on every move. AI digest that reads your portfolio, not just the tape. Tax-loss harvest alerts when your positions dip.
              </p>
              <div className="flex gap-3 flex-wrap">
                <Link href="/signup" className="inline-flex items-center gap-2 font-mono text-[10px] font-semibold tracking-[0.18em] uppercase px-[22px] py-[13px] rounded-md bg-[var(--color-gold)] text-[#0A0A0A] shadow-[0_6px_22px_rgba(230,185,77,0.22)] hover:bg-[var(--color-gold-hi,#FFD67A)] transition-all" style={MONO}>
                  Get your personalized brief &rarr;
                </Link>
                <Link href="/analyze" className="inline-flex items-center gap-2 font-mono text-[10px] font-semibold tracking-[0.18em] uppercase px-[22px] py-[13px] rounded-md border border-white/[0.14] text-[#FAFAFA] hover:border-white/[0.28] transition-all" style={MONO}>
                  Try a free analysis
                </Link>
              </div>
            </article>
          </main>

          {/* Sidebar */}
          <aside className="space-y-8">

            {/* Market movers with reasoning */}
            {allMovers.length > 0 && (
              <div className="rounded-xl border border-white/[0.07] bg-[var(--color-bg-elevated,#131313)] px-5 py-4 sm:py-5">
                <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)] mb-4 pb-3 border-b border-white/[0.07]" style={MONO}>
                  Market movers
                </h2>
                <div className="divide-y divide-white/[0.05]">
                  {allMovers.slice(0, 5).map((m) => (
                    <div key={m.symbol} className="py-3.5 first:pt-0 last:pb-0">
                      <div className="flex justify-between items-baseline">
                        <Link href={`/analyze/${m.symbol}`} className="font-mono text-[16px] font-bold text-[var(--color-gold)] hover:text-[var(--color-gold-hi,#FFD67A)] transition-colors tabular-nums">
                          {m.symbol}
                        </Link>
                        <span className="font-mono text-[16px] font-bold tabular-nums" style={{ color: m.changePct >= 0 ? '#4ADE80' : '#F87171' }}>
                          {fmtPct(m.changePct)}
                        </span>
                      </div>
                      <div className="text-[14px] text-[#9A9A9A] mt-1.5 leading-[1.5]">
                        {moverReason(m.symbol, m.changePct, spy?.changePct ?? 0)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Day at a glance */}
            {gainers.length > 0 && losers.length > 0 && (
              <div className="rounded-xl border border-white/[0.07] bg-[var(--color-bg-elevated,#131313)] px-5 py-4 sm:py-5">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6A6A6A] mb-4" style={MONO}>
                  Day at a glance
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ ...MONO, color: '#4ADE80' }}>Best performer</div>
                    <div className="flex justify-between items-baseline mt-1.5">
                      <span className="font-mono text-[16px] font-bold text-[#FAFAFA] tabular-nums">{gainers[0].symbol}</span>
                      <span className="font-mono text-[16px] font-bold tabular-nums" style={{ color: '#4ADE80' }}>{fmtPct(gainers[0].changePct)}</span>
                    </div>
                    <div className="text-[14px] text-[#9A9A9A] mt-1">{NAMES[gainers[0].symbol] || gainers[0].symbol}</div>
                  </div>
                  <div className="h-px bg-white/[0.06]" />
                  <div>
                    <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ ...MONO, color: '#F87171' }}>Worst performer</div>
                    <div className="flex justify-between items-baseline mt-1.5">
                      <span className="font-mono text-[16px] font-bold text-[#FAFAFA] tabular-nums">{losers[0].symbol}</span>
                      <span className="font-mono text-[16px] font-bold tabular-nums" style={{ color: '#F87171' }}>{fmtPct(losers[0].changePct)}</span>
                    </div>
                    <div className="text-[14px] text-[#9A9A9A] mt-1">{NAMES[losers[0].symbol] || losers[0].symbol}</div>
                  </div>
                </div>
              </div>
            )}

            {/* What you'd get */}
            <div className="rounded-xl border border-[var(--color-gold-border,rgba(230,185,77,0.30))] bg-[var(--color-gold-surface,rgba(230,185,77,0.06))] px-5 py-4 sm:py-5">
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)] mb-4" style={MONO}>
                With a connected account
              </div>
              <ul className="space-y-3 text-[15px] text-[#B8B8B8]">
                {[
                  'Dollar impact on every move',
                  'AI digest written about your holdings',
                  'Sector exposure and concentration risk',
                  'Tax-loss harvest alerts',
                  'Earnings exposure warnings',
                  'Personalized movers table',
                ].map((item) => (
                  <li key={item} className="flex gap-2.5 items-start leading-[1.4]">
                    <span className="text-[var(--color-gold)] mt-0.5 shrink-0" style={MONO}>&#10003;</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/[0.07] py-5 px-4 sm:px-6">
        <div className="max-w-[1040px] mx-auto flex flex-col sm:flex-row justify-between font-mono text-[10px] font-semibold text-[#6A6A6A] uppercase tracking-[0.16em] gap-2" style={MONO}>
          <span>Sources: Finazon &middot; Refreshed every 5 min &middot; Not investment advice</span>
          <Link href="/" className="text-[var(--color-gold)] hover:text-[var(--color-gold-hi,#FFD67A)] transition-colors">helmterminal.dev</Link>
        </div>
      </footer>
    </div>
  );
}
