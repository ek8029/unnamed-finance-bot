'use client';

/**
 * /testing/vix16 — the rule of 16, placed.
 *
 * VIX is annualized volatility; nobody experiences a year at a time. Divide by
 * √252 ≈ 16 and it becomes the one number a person can feel: the one-sigma
 * daily move options are pricing. VIX 15.13 → a ±0.95% day, two days in three
 * inside it. This page places that number on the real brief surfaces, at
 * fidelity, with fixture data.
 *
 * The honest part first: the product cannot show this today. Finazon's
 * us_stocks_essential dataset has no indices, so every "VIX" in the app is
 * VIXY the ETF — and /dashboard/brief currently prints the VIXY dollar price
 * under the label "VIX" with VIX-index thresholds applied (page.tsx:413-433).
 * Cboe's delayed-quote JSON (cdn.cboe.com/api/global/delayed_quotes/quotes/
 * _VIX.json — verified live Aug 23, free, no key, 15-min delay) provides the
 * real index and fixes both problems at once.
 *
 * Research: docs/vix-rule-of-16.md. Mobile twin: helm-mobile :8082/?lab=vix.
 */

import { notFound } from 'next/navigation';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

/* ── The arithmetic. One source, everything below derives from it. ───────── */
const VIX = 15.13;                                  // Cboe close, Fri Aug 21 2026
const PRICED = VIX / Math.sqrt(252);                // 0.953 → the ±% day
const pricedDay = `±${PRICED.toFixed(2)}%`;
const pricedWeek = `±${(VIX / Math.sqrt(52)).toFixed(1)}%`;
const SPY_PCT = 0.31;                               // fixture: index day
const BOOK_PCT = 1.42;                              // fixture: a concentrated book

/* ── Small house parts ───────────────────────────────────────────────────── */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[#E6B94D]" style={MONO}>
      {children}
    </div>
  );
}

function Section({ n, title, children, note }: {
  n: string; title: string; children: React.ReactNode; note: string;
}) {
  return (
    <section className="mt-16 border-t border-[var(--color-border-base)] pt-8">
      <div className="mb-6 flex items-baseline gap-3">
        <span className="text-[11px] text-[#E6B94D]" style={MONO}>{n}</span>
        <h2 className="text-[15px] font-semibold text-[#FAFAFA]">{title}</h2>
      </div>
      {children}
      <p className="mt-5 text-[11px] leading-[1.8] text-[#8A8A8A]" style={MONO}>{note}</p>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */

export default function Vix16Lab() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <div className="min-h-dvh bg-[#060606] px-6 py-16 text-[#FAFAFA]">
      <div className="mx-auto max-w-3xl">
        <Eyebrow>Design lab · 2026-08-23</Eyebrow>
        <h1 className="mt-3 text-[26px] font-bold tracking-[-0.02em]">VIX ÷ 16 — the priced day</h1>
        <p className="mt-4 max-w-xl text-[14px] leading-[1.7] text-[#B4B4B4]">
          The options market publishes, every day, what a normal day should look like. Helm&rsquo;s
          whole design language is numbers on scales — and this is the one scale the market
          itself draws. Four placements below, ranked by ship order. Fixture data throughout;
          the arithmetic is real (VIX {VIX} ÷ √252 = {pricedDay.replace('±', '')} one-sigma day).
        </p>

        {/* ── 01 ─────────────────────────────────────────────────────────── */}
        <Section
          n="01"
          title="The market strip cell — a level becomes a reading"
          note={`touches app/dashboard/brief/page.tsx:433 + the brief route market block · needs lib/vix.ts (one cached fetch to Cboe delayed JSON) · also FIXES the live bug where the VIXY dollar price is printed as a VIX level`}
        >
          <div className="grid grid-cols-2 overflow-hidden rounded-md border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] sm:grid-cols-4">
            {[
              { label: 'S&P 500 (SPY)', value: '$641.28', delta: '+0.31%', tone: 'text-[var(--color-positive)]' },
              { label: 'Nasdaq (QQQ)', value: '$572.40', delta: '+0.44%', tone: 'text-[var(--color-positive)]' },
              { label: 'VIX', value: VIX.toFixed(2), delta: `${pricedDay} priced day`, tone: 'text-[#B4B4B4]' },
              { label: 'Bonds (TLT)', value: '$88.72', delta: '−0.21%', tone: 'text-[var(--color-negative-text)]' },
            ].map((c, i) => (
              <div key={c.label} className="px-[20px] py-[16px]" style={{ borderRight: i < 3 ? '1px solid var(--color-border-subtle)' : undefined }}>
                <div className="mb-2 text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-muted)]" style={MONO}>{c.label}</div>
                <div className="text-[18px] font-bold tabular-nums" style={MONO}>{c.value}</div>
                <div className={`mt-1 text-[11px] ${c.tone}`} style={MONO}>{c.delta}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 max-w-xl text-[13px] leading-[1.7] text-[#8A8A8A]">
            Today the cell says <span className="text-[#B4B4B4]">&ldquo;VIX 68.02 · extreme fear&rdquo;</span> —
            a VIXY price under a VIX label, classified by thresholds for the wrong instrument.
            After: the real index, and the delta line spends its space on what the level
            <em> means</em> instead of a fear word. One point of VIX per 1% of daily move at the
            baseline of 16; a reader can check it on a napkin.
          </p>
        </Section>

        {/* ── 02 ─────────────────────────────────────────────────────────── */}
        <Section
          n="02"
          title="The sentence — in the hero, and handed to the digest"
          note={`touches generalMarketBrief (page.tsx:405) + lib/generate-digest.ts:82 (the LLM currently receives "VIX proxy (VIXY): $68.02" — hand it the computed sentence instead, so 4o-mini narrates arithmetic it cannot get wrong)`}
        >
          {/* Free tier: general market brief, at fidelity */}
          <div
            className="rounded-lg px-[26px] py-6"
            style={{ border: '1px solid rgba(230,185,77,0.18)', background: 'rgba(230,185,77,0.025)', boxShadow: '0 2px 12px rgba(0,0,0,0.5)' }}
          >
            <div className="mb-2.5 text-[10px] uppercase tracking-[0.16em] text-[var(--color-gold)]" style={MONO}>Market brief</div>
            <p className="m-0 text-[16.5px] leading-[1.62] text-[var(--color-text-primary)] text-pretty">
              The S&amp;P 500 (SPY) is up 0.31% and the Nasdaq (QQQ) is up 0.44% this morning. The
              VIX sits at 15.1 — options are pricing a {pricedDay} day for the index, and two days
              in three should close inside it. Long-dated Treasuries (TLT) are down 0.21%, with
              yields ticking higher.
            </p>
          </div>

          {/* Pro: the digest ties the band to the user's book */}
          <div className="mt-3 rounded-lg px-[26px] py-6" style={{ border: '1px solid rgba(230,185,77,0.18)', background: 'rgba(230,185,77,0.025)' }}>
            <div className="mb-2.5 text-[10px] uppercase tracking-[0.16em] text-[var(--color-gold)]" style={MONO}>Your brief · Pro</div>
            <p className="m-0 text-[16.5px] leading-[1.62] text-[var(--color-text-primary)] text-pretty">
              Your book gained $2,148 overnight, a +1.42% move against the {pricedDay} day options
              priced for the index — that spread is your concentration showing, not the market.
              SPY itself finished +0.31%, well inside its band.
            </p>
          </div>
        </Section>

        {/* ── 03 ─────────────────────────────────────────────────────────── */}
        <Section
          n="03"
          title="The band — what was priced and what happened, one scale"
          note={`new module, candidate slot: above the market strip or in the "Driving your day" rail · band = VIX ÷ 16 · "your usual day" needs lib/market-sync.ts:425 to PERSIST dailyVol instead of discarding it (computed today, thrown away) · mobile twin reuses Bearing (instrument.tsx:184)`}
        >
          <div className="max-w-xl">
            {/* the scale: ±2%, shaded priced band, two needles */}
            <div className="relative h-[44px]">
              {/* priced band */}
              <div
                className="absolute top-[6px] h-[32px]"
                style={{
                  left: `${((2 - PRICED) / 4) * 100}%`,
                  width: `${(PRICED / 2) * 100}%`,
                  background: 'rgba(230,185,77,0.10)',
                  borderLeft: '1px solid rgba(230,185,77,0.35)',
                  borderRight: '1px solid rgba(230,185,77,0.35)',
                }}
              />
              {/* track + zero */}
              <div className="absolute top-[22px] h-px w-full bg-[var(--color-border-base)]" />
              <div className="absolute left-1/2 top-[12px] h-[20px] w-px bg-white/20" />
              {/* SPY needle: inside the band, quiet */}
              <div className="absolute top-[14px] h-[16px] w-[2px] bg-[#8A8A8A]" style={{ left: `${((SPY_PCT + 2) / 4) * 100}%` }} />
              {/* the book: outside the band — gold marks what needs you */}
              <div className="absolute top-[4px] h-[36px] w-[2px] bg-[#E6B94D]" style={{ left: `${((BOOK_PCT + 2) / 4) * 100}%` }} />
            </div>
            <div className="flex text-[10px] text-[#7C7C7C]" style={MONO}>
              <span className="flex-1">&minus;2%</span>
              <span className="flex-1 text-center">0</span>
              <span className="flex-1 text-right">+2%</span>
            </div>
            <div className="mt-3 text-[11px] leading-[1.8] text-[#8A8A8A]" style={MONO}>
              shaded &nbsp;{pricedDay} priced (VIX ÷ 16) &nbsp;·&nbsp; short needle &nbsp;SPY +0.31%
              &nbsp;·&nbsp; <span className="text-[#E6B94D]">gold needle</span> &nbsp;your book +1.42%, outside the priced day
            </div>

            {/* the ledger under it */}
            <div className="mt-6 border-t border-[var(--color-border-base)]">
              {[
                { l: 'Priced day', v: pricedDay, n: 'one sigma — 2 of 3 days close inside' },
                { l: 'Priced week', v: pricedWeek, n: 'same arithmetic, ÷ √52' },
                { l: 'Your usual day', v: '±1.21%', n: '20-day realized on your own book' },
                { l: 'Today', v: '+1.42%', n: 'outside both', gold: true },
              ].map((r) => (
                <div key={r.l} className="flex items-baseline border-b border-[var(--color-border-base)] py-[9px]">
                  <span className="w-[130px] text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-muted)]" style={MONO}>{r.l}</span>
                  <span className={`text-[13px] font-semibold tabular-nums ${r.gold ? 'text-[#E6B94D]' : 'text-[#FAFAFA]'}`} style={MONO}>{r.v}</span>
                  <span className="ml-auto text-[11px] text-[#7C7C7C]" style={MONO}>{r.n}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ── 04 ─────────────────────────────────────────────────────────── */}
        <Section
          n="04"
          title="Public /brief — a Day-at-a-glance row anyone can cite"
          note={`touches app/brief/public-brief.tsx:387 (Day at a glance) · no auth, revalidates 5 min · the GEO angle: "what move did options price today" answered in plain arithmetic is exactly the kind of line AI engines quote with attribution`}
        >
          <div className="max-w-sm border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] p-5">
            <div className="mb-3 text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]" style={MONO}>Day at a glance</div>
            {[
              { l: 'S&P 500', v: '+0.31%' },
              { l: 'Priced move', v: pricedDay, sub: 'VIX 15.13 ÷ 16' },
              { l: 'Verdict', v: 'inside the band', sub: 'a normal day, as priced' },
            ].map((r) => (
              <div key={r.l} className="flex items-baseline justify-between border-b border-[var(--color-border-base)] py-2 last:border-0">
                <span className="text-[11px] text-[#8A8A8A]" style={MONO}>{r.l}</span>
                <span className="text-right">
                  <span className="text-[13px] tabular-nums text-[#FAFAFA]" style={MONO}>{r.v}</span>
                  {r.sub && <span className="block text-[10px] text-[#7C7C7C]" style={MONO}>{r.sub}</span>}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── caveats, so the copy never oversells ───────────────────────── */}
        <div className="mt-16 border-t border-[var(--color-border-base)] pt-8 text-[12px] leading-[1.9] text-[#8A8A8A]">
          <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-[#7C7C7C]" style={MONO}>What the copy must never say</div>
          <p className="m-0 max-w-xl">
            The band is one standard deviation, not a limit — one day in three closes outside it,
            and a day outside the band is the band working, not failing. VIX is what hedging
            costs, not a forecast, and historically it runs a touch above what the tape delivers.
            The band belongs to the index; a concentrated book runs hotter, which is precisely
            the comparison worth drawing.
          </p>
        </div>
      </div>
    </div>
  );
}
