'use client';

/**
 * Hero block — direction 13, "The Read", packaged as a drop-in.
 *
 * Self contained on purpose: all state, markup and styles live here so it can
 * replace the INTRO section of components/homepage/home-content.tsx without any
 * other change to that file.
 *
 * THE OPENING (about 2.8s)
 *   0.00  the wall of filings floods upward, bright
 *   0.28  a centre line names what is being read, six document types in turn
 *   1.42  a gold scan line sweeps down the wall
 *   1.85  the wall decelerates and goes dark
 *   2.10  headline, then sub, form, status in quick succession
 *   2.26  the kept sentence lifts out
 *   2.78  scroll cue: everything below here is discoverable
 *
 * Plays once per session. On the second visit, and under reduced motion, the
 * end state renders immediately: nobody should sit through a title sequence to
 * reach a text input twice.
 *
 * NOTE: SAMPLE document text and a SAMPLE citation, both labelled on screen.
 * The reader names document TYPES rather than counting them, deliberately: a
 * throughput number here would be a claim the page cannot support.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const SEEN_KEY = 'helm-hero-intro-seen';

/** Renders at 10.5px and 5.5% opacity. Texture, not copy. */
const PROSE = [
  'ITEM 2. MANAGEMENT’S DISCUSSION AND ANALYSIS OF FINANCIAL CONDITION',
  'Revenue for the quarter increased across each of the reportable segments, with the largest contribution attributable to the data center platform. The Company continues to experience elevated demand for accelerated computing across hyperscale and enterprise customers, and expects supply constraints to persist through the remainder of the fiscal year.',
  'Cost of revenue increased in absolute dollars and as a percentage of revenue. The increase reflects a shift in product mix toward newly introduced platforms, which carry higher initial manufacturing costs, together with incremental provisions for inventory and supply commitments.',
  'Operating expenses increased primarily as a result of compensation and benefits, including higher headcount and stock based compensation, along with increased engineering development costs and infrastructure spend supporting research initiatives.',
  'LIQUIDITY AND CAPITAL RESOURCES',
  'As of the end of the period, cash, cash equivalents and marketable securities were sufficient to meet anticipated operating requirements for at least the next twelve months. The principal sources of liquidity remain cash generated from operations and existing balances.',
  'The Company is subject to risks associated with concentration of revenue among a limited number of customers. A single customer accounted for a significant portion of total revenue during the period.',
  'ITEM 1A. RISK FACTORS',
  'Our results of operations have varied significantly from period to period and may continue to do so. Demand estimates are inherently uncertain, and purchase commitments made in advance of demand may result in excess inventory or supply obligations that cannot be cancelled.',
  'Global supply chain conditions, including the availability of advanced packaging capacity and high bandwidth memory, may constrain our ability to meet customer demand.',
  'Changes in trade policy, including export licensing requirements applicable to certain products and destinations, have limited and may continue to limit our ability to sell into specific markets.',
  'CRITICAL ACCOUNTING ESTIMATES',
  'Inventory is stated at the lower of cost or net realizable value. The Company records provisions for excess and obsolete inventory based on forecast demand, product life cycle status, and product development plans.',
  'Revenue is recognised when control of the promised goods is transferred to the customer, in an amount that reflects the consideration expected in exchange for those goods, net of allowances for returns and price adjustments.',
  'ITEM 3. QUANTITATIVE AND QUALITATIVE DISCLOSURES ABOUT MARKET RISK',
  'The Company is exposed to interest rate risk on its investment portfolio and to foreign currency risk arising from operations denominated in currencies other than the functional currency.',
  'CONTRACTUAL OBLIGATIONS AND COMMITMENTS',
  'Purchase obligations include agreements to acquire goods and services that are enforceable and legally binding, specifying fixed or minimum quantities, fixed or minimum pricing, and approximate timing of the transaction.',
];

/** What the reader names while it works. Types, never counts. */
const READING = [
  'Form 10-Q',
  'Form 8-K',
  'Form 10-K',
  'Earnings call',
  'Proxy statement',
  'Press release',
];

/** One finding lands on four surfaces. Thesis sits last among equals. */
const FAN = [
  { k: 'Exposure', v: '8.4% of equity, two accounts' },
  { k: 'Taxes', v: 'Harvestable, outside the wash window' },
  { k: 'Earnings', v: 'Reports in six sessions' },
  { k: 'Thesis', v: 'Margin, weakening' },
];

/** The four surfaces named without values, for the real-data path. */
const SURFACES = ['Exposure', 'Taxes', 'Earnings', 'Thesis'];

export type HeroCatch = {
  ticker: string;
  verdict: string;
  pillarClaim?: string | null;
  verbatimCite: string;
  sourceLabel: string;
  dateLabel: string;
};

export default function HeroBlock({
  onAnalyze,
  latestCatch,
}: {
  onAnalyze?: (ticker: string) => void;
  /** A real approved catch. When present the hero quotes it instead of the
   *  sample, and drops the per-surface values, which are user specific and
   *  cannot be true for an anonymous visitor. */
  latestCatch?: HeroCatch | null;
}) {
  const router = useRouter();
  const [ticker, setTicker] = useState('');
  const [reading, setReading] = useState<string | null>(null);
  const [still, setStill] = useState(false);
  // starts true so the sequence is already running at first paint. Defaulting
  // it off meant the finished state rendered, then an effect flipped it on a
  // frame later, so the intro never actually played.
  const [intro, setIntro] = useState(true);
  const runId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Strict Mode runs effects twice in dev: the first pass writes the seen flag
  // and the second reads it straight back, which killed the intro every time.
  const checked = useRef(false);

  useEffect(() => {
    // reduced motion is handled entirely in CSS, so this only decides whether
    // the visitor has already sat through the sequence this session
    setStill(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (!checked.current) {
      checked.current = true;
      // ?intro=1 replays it, ?intro=0 skips it. Without an override you would
      // have to clear sessionStorage every time you wanted to see it again.
      const forced = new URLSearchParams(window.location.search).get('intro');
      if (forced === '1') return;
      if (forced === '0') { setIntro(false); return; }
      let seen = false;
      try { seen = sessionStorage.getItem(SEEN_KEY) === '1'; } catch { /* private mode */ }
      if (seen) setIntro(false);
      else { try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* private mode */ } }
    }
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = ticker.trim().toUpperCase();
    if (!clean) return;
    onAnalyze?.(clean);
    if (still) { router.push(`/analyze/${clean}`); return; }
    setReading(clean);
    runId.current += 1;
    timer.current = setTimeout(() => router.push(`/analyze/${clean}`), 1700);
  }

  return (
    <section className={intro ? 'h13m-hero' : 'h13m-hero h13m-instant'}>
      <style>{CSS}</style>

      <div aria-hidden className="h13m-wall">
        <div key={runId.current} className={reading ? 'h13m-stream h13m-stream-run' : 'h13m-stream'}>
          {[0, 1, 2].map((pass) => (
            <div key={pass} className="h13m-cols">
              {[0, 1, 2, 3].map((col) => {
                const shift = (col * 7 + pass * 3) % PROSE.length;
                const lines = [...PROSE.slice(shift), ...PROSE.slice(0, shift)];
                return (
                  <div key={col} className="h13m-col">
                    {lines.map((p, i) => (
                      <p key={i} className={p === p.toUpperCase() ? 'h13m-p h13m-p-head' : 'h13m-p'}>{p}</p>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="h13m-scan" />
        <div className="h13m-vignette" />
      </div>

      {/* names what it is reading while it reads. Types, never a count. */}
      <div aria-hidden className="h13m-reader">
        <span className="h13m-reader-label">Reading</span>
        <span className="h13m-reader-stack">
          {READING.map((r, i) => (
            <span key={r} className="h13m-reader-item" style={{ animationDelay: `${0.28 + i * 0.3}s` }}>{r}</span>
          ))}
        </span>
      </div>

      <div className="h13m-inner">
        <div className="h13m-ask">
          <span className="h13m-eyebrow h13m-rise" style={{ animationDelay: '2.1s' }}>
            Push, not pull &middot; free &middot; no account
          </span>

          <h1 className="h13m-head h13m-rise" style={{ animationDelay: '2.17s' }}>
            Agentic coverage of your <span className="h13m-hot">whole portfolio</span>.
          </h1>

          <p className="h13m-sub h13m-rise" style={{ animationDelay: '2.28s' }}>
            Every 10-Q, 8-K, and earnings call, read end to end. The agent keeps what changed and
            drops the rest. Start with one ticker, or link your brokerages and it reads every
            position you hold.
          </p>

          <form onSubmit={submit} className="h13m-form h13m-rise" style={{ animationDelay: '2.37s' }}>
            <label className="h13m-field">
              <span className="h13m-field-label">Ticker</span>
              <input
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="NVDA"
                aria-label="Stock ticker symbol"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                maxLength={6}
                disabled={!!reading}
              />
            </label>
            <button type="submit" className="h13m-go" disabled={!!reading}>
              {reading ? 'Reading' : 'Read it'} &rarr;
            </button>
          </form>

          <p className="h13m-status h13m-rise" style={{ animationDelay: '2.45s' }} aria-live="polite">
            {reading ? (
              <>
                <span className="h13m-dot h13m-dot-live" />
                <span>Reading {reading}. Every filing, front to back</span>
              </>
            ) : (
              <>
                <span className="h13m-dot" />
                <span>Any US ticker. No signup. <Link href="/brief">Read today&rsquo;s brief</Link>.</span>
              </>
            )}
          </p>
        </div>

        <figure className={reading ? 'h13m-kept h13m-kept-out' : 'h13m-kept'}>
          <div className="h13m-kept-rail" />
          <div className="h13m-kept-tag">
            <span>What it kept</span>
            {latestCatch
              ? <span className="h13m-sample h13m-live">{latestCatch.verdict}</span>
              : <span className="h13m-sample">Sample</span>}
          </div>

          {latestCatch?.pillarClaim ? (
            // A contradiction only reads as one if you can see what it
            // contradicts, so the pillar it was tested against leads.
            <p className="h13m-claim">
              <span className="h13m-claim-label">Tested</span>
              {latestCatch.pillarClaim}
            </p>
          ) : null}

          <blockquote>
            &ldquo;{latestCatch
              ? latestCatch.verbatimCite
              : 'Gross margin decreased primarily due to the ramp of new data center products with higher initial manufacturing costs.'}&rdquo;
          </blockquote>

          <figcaption>
            {latestCatch
              ? `${latestCatch.ticker} · ${latestCatch.sourceLabel} · ${latestCatch.dateLabel}`
              : 'NVDA · Form 10-Q · p.14 · filed 27 Aug 2025'}
          </figcaption>

          {latestCatch ? (
            // Real catch: name the surfaces it lands on, but no values. Exposure
            // and tax numbers belong to a book this visitor has not linked yet.
            <p className="h13m-surfaces">
              <span>Filed to</span>
              {SURFACES.map((s) => <span key={s} className="h13m-surface">{s}</span>)}
            </p>
          ) : (
            <dl className="h13m-fan">
              {FAN.map((f) => (
                <div key={f.k}>
                  <dt>{f.k}</dt>
                  <dd>{f.v}</dd>
                </div>
              ))}
            </dl>
          )}
        </figure>
      </div>

      <div className="h13m-foot">
        <span>Agentic portfolio intelligence &middot; sample document text</span>
        <span className="h13m-cue" aria-hidden>
          Keep going
          <span className="h13m-cue-rail"><span className="h13m-cue-run" /></span>
        </span>
        <span>Read only. Helm can never trade or move money.</span>
      </div>
    </section>
  );
}

const CSS = `
@keyframes h13mFlood { 0% { transform:translate3d(0,0,0) } 100% { transform:translate3d(0,-38%,0) } }
@keyframes h13mDim { from { opacity:.32; filter:blur(.4px) } to { opacity:.055; filter:blur(0) } }
@keyframes h13mRerun { 0% { opacity:.055 } 12% { opacity:.32 } 100% { opacity:.32 } }
@keyframes h13mScan { 0% { transform:translateY(-12vh); opacity:0 } 18% { opacity:1 } 100% { transform:translateY(104vh); opacity:0 } }
@keyframes h13mReaderIn { 0% { opacity:0; transform:translateY(6px) } 14%,72% { opacity:1; transform:none } 100% { opacity:0; transform:translateY(-6px) } }
@keyframes h13mReaderOut { to { opacity:0 } }
@keyframes h13mRise { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:none } }
@keyframes h13mLift { from { opacity:0; transform:translateY(26px) scale(.985) } to { opacity:1; transform:none } }
@keyframes h13mRail { from { transform:scaleY(0) } to { transform:scaleY(1) } }
@keyframes h13mDot { 0%,100% { opacity:.35 } 50% { opacity:1 } }
@keyframes h13mCue { 0% { transform:translateY(-100%) } 100% { transform:translateY(340%) } }

.h13m-hero {
  position:relative; overflow:hidden; min-height:100vh;
  display:flex; flex-direction:column; justify-content:center;
  padding:132px clamp(20px,5vw,72px) 0;
  background:var(--color-bg-base);
}

/* absolute, not fixed: the wall belongs to this section only */
.h13m-wall { position:absolute; inset:0; z-index:0; pointer-events:none; overflow:hidden }
.h13m-stream {
  opacity:.32;
  animation:
    h13mFlood 2.05s cubic-bezier(.17,.9,.3,1) both,
    h13mDim .68s cubic-bezier(.22,1,.36,1) 1.85s both;
}
.h13m-stream-run {
  animation:
    h13mFlood 1.4s cubic-bezier(.3,.6,.5,1) both,
    h13mRerun .4s ease-out both;
}
.h13m-cols {
  display:grid; grid-template-columns:repeat(4,minmax(0,1fr));
  border-top:1px solid rgba(255,255,255,.05);
}
.h13m-col { padding:0 26px; border-right:1px solid rgba(255,255,255,.05) }
.h13m-p {
  margin:0 0 13px; font-family:var(--font-mono); font-size:10.5px; line-height:1.62;
  color:var(--color-text-primary); text-align:justify; hyphens:auto;
}
.h13m-p-head { letter-spacing:.14em; color:var(--color-text-primary); margin-top:22px }

/* the read head passing down the page, once */
.h13m-scan {
  position:absolute; left:0; right:0; height:14vh; pointer-events:none;
  background:linear-gradient(180deg,
    transparent, rgba(230,185,77,.05) 62%, rgba(230,185,77,.16) 92%, rgba(255,214,122,.75) 100%);
  box-shadow:0 0 34px rgba(230,185,77,.22);
  animation:h13mScan .95s cubic-bezier(.4,0,.5,1) 1.42s both;
}

.h13m-vignette {
  position:absolute; inset:0;
  background:linear-gradient(180deg,
    rgba(6,6,6,.94) 0%, rgba(6,6,6,.80) 16%, rgba(6,6,6,.80) 84%, rgba(6,6,6,.96) 100%);
}

.h13m-reader {
  position:absolute; z-index:1; left:50%; top:46%; transform:translate(-50%,-50%);
  display:flex; align-items:baseline; gap:12px; pointer-events:none;
  font-family:var(--font-mono); font-size:12px; letter-spacing:.26em; text-transform:uppercase;
  animation:h13mReaderOut .32s ease-out 2.1s both;
}
.h13m-reader-label { color:var(--color-text-secondary) }
/* the names stack in one grid cell rather than being absolutely positioned.
   Absolute children sit outside the flex baseline, which left the gold text
   riding lower than the grey label next to it. */
.h13m-reader-stack { display:inline-grid; grid-template-areas:'name' }
.h13m-reader-item {
  grid-area:name; white-space:nowrap; opacity:0; color:var(--color-gold);
  animation:h13mReaderIn .3s linear both;
}

.h13m-inner {
  position:relative; z-index:1; flex:1; display:grid;
  grid-template-columns:minmax(0,1.16fr) minmax(0,.84fr);
  align-items:center; gap:clamp(32px,5vw,80px); padding-bottom:clamp(24px,4vh,52px);
}

.h13m-rise { opacity:0; animation:h13mRise .62s cubic-bezier(.22,1,.36,1) both }
.h13m-eyebrow {
  display:inline-block; font-family:var(--font-mono); font-size:10px; letter-spacing:.26em;
  text-transform:uppercase; color:var(--color-gold);
}
.h13m-head {
  margin:20px 0 0; font-size:clamp(2.05rem,3.85vw,3.45rem); font-weight:800;
  letter-spacing:-.048em; line-height:1;
}
.h13m-hot { color:var(--color-gold) }
.h13m-sub {
  margin:20px 0 0; max-width:46ch; font-size:clamp(.93rem,1.06vw,1.03rem); line-height:1.58;
  color:var(--color-text-muted);
}

.h13m-form { display:flex; gap:10px; margin-top:28px; flex-wrap:wrap; align-items:stretch }
.h13m-field {
  position:relative; display:flex; flex-direction:column; justify-content:center;
  min-width:230px; padding:9px 18px 10px; border-radius:6px;
  border:1px solid var(--color-border-strong); background:rgba(6,6,6,.72);
  backdrop-filter:blur(4px); transition:border-color .2s, background .2s;
}
.h13m-field:focus-within { border-color:var(--color-gold); background:rgba(230,185,77,.06) }
.h13m-field-label {
  font-family:var(--font-mono); font-size:8.5px; letter-spacing:.24em; text-transform:uppercase;
  color:var(--color-text-secondary);
}
.h13m-field input {
  /* min-height carries the input itself to a 44px target. The label around it
     was already 66px, but the element a screen reader and a thumb both land on
     was 32px. */
  margin-top:3px; min-height:32px; background:none; border:0; outline:none;
  color:var(--color-text-primary); font-family:var(--font-mono); font-size:21px;
  font-weight:700; letter-spacing:.14em; text-transform:uppercase; width:100%;
  padding:6px 0; margin-bottom:-6px;
}
.h13m-field input::placeholder { color:rgba(250,250,250,.2) }
.h13m-field input:disabled { color:var(--color-gold) }
.h13m-go {
  font-family:var(--font-mono); font-size:11.5px; font-weight:700; letter-spacing:.16em;
  text-transform:uppercase; background:var(--color-gold); color:var(--color-text-inverse); padding:0 26px;
  border:0; border-radius:6px; cursor:pointer; min-height:66px;
  transition:background .2s, transform .2s;
}
.h13m-go:hover:not(:disabled) { background:var(--color-gold-hi); transform:translateY(-1px) }
.h13m-go:disabled { cursor:default; background:var(--color-gold-hi) }

.h13m-status {
  display:flex; align-items:center; gap:9px; margin:16px 0 0;
  font-family:var(--font-mono); font-size:10px; letter-spacing:.12em; text-transform:uppercase;
  color:var(--color-text-secondary);
}
/* inline-block with vertical padding: the link measured 13px tall, which is a
   miserable thing to hit on a phone */
.h13m-status a {
  display:inline-block; padding:8px 0; margin:-8px 0;
  color:var(--color-text-muted); text-decoration:underline; text-underline-offset:3px;
}
.h13m-status a:hover { color:var(--color-text-primary) }
.h13m-dot { width:6px; height:6px; border-radius:99px; background:var(--color-text-secondary); flex:none }
.h13m-dot-live {
  background:var(--color-gold); box-shadow:0 0 9px var(--color-gold);
  animation:h13mDot 1.2s ease-in-out infinite;
}

.h13m-kept {
  position:relative; margin:0; padding:6px 0 0 28px;
  animation:h13mLift .78s cubic-bezier(.22,1,.36,1) 2.26s both; opacity:0;
  transition:opacity .3s, transform .3s;
}
.h13m-kept-out { opacity:0 !important; transform:translateY(10px); pointer-events:none }
.h13m-kept-rail {
  position:absolute; left:0; top:6px; bottom:0; width:2px; background:var(--color-gold);
  transform-origin:top; animation:h13mRail .62s cubic-bezier(.22,1,.36,1) 2.4s both;
}
.h13m-kept-tag {
  display:flex; align-items:center; gap:12px; font-family:var(--font-mono); font-size:9.5px;
  letter-spacing:.24em; text-transform:uppercase; color:var(--color-gold); font-weight:700;
}
.h13m-sample {
  color:var(--color-text-secondary); font-weight:400;
  border:1px solid var(--color-border-strong); padding:2px 6px;
}
.h13m-kept blockquote {
  margin:16px 0 0; font-size:clamp(1.08rem,1.6vw,1.55rem); font-weight:500;
  letter-spacing:-.015em; line-height:1.42; color:var(--color-text-primary);
  text-shadow:0 2px 30px rgba(0,0,0,.9);
  /* real citations vary in length and some filings run long. Cap the block so
     one verbose extract cannot push the hero past the fold. */
  display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:6; overflow:hidden;
}
.h13m-kept figcaption {
  margin-top:18px; padding-top:14px; border-top:1px solid var(--color-border-base);
  font-family:var(--font-mono); font-size:10px; letter-spacing:.12em; text-transform:uppercase;
  color:var(--color-text-secondary);
}
/* all four surfaces set identically: colouring the thesis line would put it
   back out front, which is the wrong emphasis */
.h13m-fan {
  display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px 22px;
  margin:16px 0 0; padding-top:15px; border-top:1px solid var(--color-border-base);
}
.h13m-fan dt {
  font-family:var(--font-mono); font-size:9px; letter-spacing:.24em; text-transform:uppercase;
  color:var(--color-gold); margin-bottom:5px;
}
.h13m-fan dd { margin:0; font-size:12.5px; line-height:1.35; color:var(--color-text-muted) }

/* real-catch variant: the verdict rides in the tag, and the surfaces are named
   without values because those numbers belong to a book nobody has linked yet */
.h13m-live { color:var(--color-gold); border-color:var(--color-gold-border) }
.h13m-claim {
  margin:14px 0 0; font-size:13px; line-height:1.45; color:var(--color-text-muted);
}
.h13m-claim-label {
  display:inline-block; margin-right:9px; font-family:var(--font-mono); font-size:9px;
  letter-spacing:.24em; text-transform:uppercase; color:var(--color-text-secondary);
}
.h13m-surfaces {
  display:flex; flex-wrap:wrap; align-items:center; gap:8px 10px; margin:16px 0 0;
  padding-top:15px; border-top:1px solid var(--color-border-base);
  font-family:var(--font-mono); font-size:9px; letter-spacing:.24em; text-transform:uppercase;
  color:var(--color-text-secondary);
}
.h13m-surface {
  color:var(--color-gold); border:1px solid var(--color-gold-border);
  border-radius:3px; padding:3px 7px;
}

.h13m-foot {
  position:relative; z-index:1; display:flex; justify-content:space-between; align-items:center;
  gap:16px; padding:14px 0; border-top:1px solid var(--color-border-base);
  font-family:var(--font-mono); font-size:9.5px; letter-spacing:.18em; text-transform:uppercase;
  color:var(--color-text-secondary);
}
.h13m-cue {
  display:inline-flex; align-items:center; gap:10px; opacity:0;
  animation:h13mRise .6s cubic-bezier(.22,1,.36,1) 2.78s both;
}
.h13m-cue-rail {
  position:relative; display:inline-block; width:1px; height:16px; overflow:hidden;
  background:linear-gradient(180deg, var(--color-border-strong), transparent);
}
.h13m-cue-run {
  position:absolute; top:0; left:0; width:1px; height:50%;
  background:var(--color-gold); animation:h13mCue 1.9s cubic-bezier(.22,1,.36,1) infinite;
}

/* second visit in the same session, or reduced motion: no title sequence */
.h13m-instant .h13m-stream,
.h13m-instant .h13m-scan,
.h13m-instant .h13m-reader,
.h13m-instant .h13m-rise,
.h13m-instant .h13m-kept,
.h13m-instant .h13m-kept-rail,
.h13m-instant .h13m-cue { animation:none !important }
.h13m-instant .h13m-stream {
  opacity:.055 !important; transform:translate3d(0,-24%,0) !important; filter:none !important;
}
.h13m-instant .h13m-scan, .h13m-instant .h13m-reader { display:none }
.h13m-instant .h13m-rise,
.h13m-instant .h13m-kept,
.h13m-instant .h13m-cue { opacity:1 !important; transform:none !important }
.h13m-instant .h13m-kept-rail { transform:scaleY(1) !important }
.h13m-instant .h13m-cue-run { animation:h13mCue 1.9s cubic-bezier(.22,1,.36,1) infinite }

@media (max-width:1024px) {
  .h13m-hero { padding-top:104px }
  .h13m-inner { grid-template-columns:1fr; align-items:start; gap:32px; padding-top:8px }
  .h13m-head { font-size:clamp(2rem,8.2vw,2.9rem) }
  .h13m-cols { grid-template-columns:repeat(2,minmax(0,1fr)) }
  .h13m-col { padding:0 14px }
  .h13m-reader { font-size:10px; letter-spacing:.2em }
  .h13m-field { flex:1; min-width:0 }
  .h13m-go { min-height:60px; padding:0 20px }
  .h13m-kept blockquote { font-size:1.15rem }
  .h13m-fan { grid-template-columns:1fr; gap:11px }
  .h13m-fan div { display:flex; justify-content:space-between; align-items:baseline; gap:14px }
  .h13m-fan dt { margin-bottom:0 }
  .h13m-fan dd { text-align:right; font-size:11.5px }
  .h13m-foot span:first-child { display:none }
  .h13m-cue { display:none }
}

@media (prefers-reduced-motion: reduce) {
  .h13m-stream, .h13m-stream-run {
    animation:none !important; opacity:.055 !important;
    transform:translate3d(0,-24%,0) !important; filter:none !important;
  }
  .h13m-scan, .h13m-reader, .h13m-cue-run { display:none }
  .h13m-rise, .h13m-kept, .h13m-kept-rail, .h13m-dot-live, .h13m-cue {
    animation:none !important; opacity:1 !important; transform:none !important;
  }
}
`;
