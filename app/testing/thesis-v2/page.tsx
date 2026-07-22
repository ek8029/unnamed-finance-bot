// /testing/thesis-v2 — Thesis Intelligence v2 rendered on the SCORING pipeline.
//
// Dev only (404s in production). Reads `pillar_evidence` (2,208 rows) instead of
// `content_events` (43 rows all time), which is the §0 blocker in the spec: the
// public pages are plumbed to the daily social-content pipeline, so NVDA shows
// one catch while the scoring pipeline holds 115.
//
// Nothing here writes and nothing is wired into a public page. It exists to
// answer one question before any house-scoping migration is run: at real
// density, does mechanism clustering keep volume from turning into noise?
//
// HONESTY RULE: every quote, date, source, verdict and materiality below is a
// real DB row. Fields the schema does not have yet (mechanism, evidence class,
// headline) are DERIVED BY A LABELLED HEURISTIC and marked PROTOTYPE on screen.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getScoringThesisData, type ScoredCatch, type ScoredPillar } from '@/lib/content/scoring-thesis';
import { SOURCE_CLASS_LABEL, type LadderStatus, type Mechanism } from '@/lib/content/mechanism-cluster';

export const metadata = { title: 'Thesis v2', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const MONO = { fontFamily: 'var(--font-mono)' } as const;

// Tickers with enough scored evidence to judge density and clustering.
const PICKS = ['JPM', 'AMZN', 'AMD', 'AAPL', 'META', 'AVGO', 'PLTR', 'MSFT', 'NVDA', 'MU', 'TSLA', 'GOOGL'];

const LADDER_TONE: Record<LadderStatus, string> = { broken: '#F87171', weakening: '#E6B94D', watch: '#8A8A8A' };
const LADDER_LABEL: Record<LadderStatus, string> = {
  broken: 'can break the pillar',
  weakening: 'can weaken the pillar',
  watch: 'watch only',
};

/* §3 weight — what a catch DOES to the pillar, from the judge's own materiality
   crossed with whether the change has actually landed in reported numbers. */
type Weight = 'context' | 'contributing' | 'decisive';
const WEIGHT_MEANING: Record<Weight, string> = {
  decisive: 'material and already in the reported numbers, so it can move the pillar alone',
  contributing: 'material, but needs a second independent source to move anything',
  context: 'shown for completeness, deliberately moves nothing',
};
function weight(c: ScoredCatch): Weight {
  if (c.materiality === 'context') return 'context';
  return c.evidenceClass === 'realized' ? 'decisive' : 'contributing';
}

const VERDICT_TONE: Record<string, string> = { supports: '#4ADE80', contradicts: '#F87171', neutral: '#8A8A8A' };
const VERDICT_LABEL: Record<string, string> = {
  supports: 'Supports',
  contradicts: 'Against',
  neutral: 'Company news',
};

/* ── small presentational pieces ───────────────────────────────────────── */

function Chip({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span
      className="text-[9.5px] font-semibold uppercase tracking-[0.14em] px-1.5 py-0.5 rounded whitespace-nowrap"
      style={{ ...MONO, color: tone, background: `${tone}14` }}
    >
      {children}
    </span>
  );
}

function SectionLabel({ children, prototype }: { children: React.ReactNode; prototype?: boolean }) {
  return (
    <div className="flex items-baseline gap-2 flex-wrap">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#6A6A6A]" style={MONO}>
        {children}
      </span>
      {prototype && (
        <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#E6B94D]" style={MONO}>
          Prototype
        </span>
      )}
    </div>
  );
}

/** §7 breakdown: the receipt under every finding. This is where we beat a summary. */
function CatchRow({ c }: { c: ScoredCatch }) {
  const tone = VERDICT_TONE[c.verdict] ?? '#8A8A8A';
  const w = weight(c);
  return (
    <details className="group border-t border-white/[0.05] first:border-t-0">
      <summary className="list-none cursor-pointer px-3.5 sm:px-4 py-3.5 hover:bg-white/[0.02] min-h-[44px]">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <Chip tone={tone}>{VERDICT_LABEL[c.verdict] ?? c.verdict}</Chip>
          <span className="text-[9.5px] uppercase tracking-[0.12em] text-[#8A8A8A]" style={MONO}>
            {w} · {c.evidenceClass}
          </span>
          {c.copies > 1 && (
            <span className="text-[9.5px] uppercase tracking-[0.12em] text-[#5F5F5F]" style={MONO}>
              {c.copies} user copies folded
            </span>
          )}
          <span className="ml-auto text-[10.5px] text-[#5F5F5F] whitespace-nowrap" style={MONO}>
            {SOURCE_CLASS_LABEL[c.sourceClass]} · {c.dateISO}
          </span>
        </div>
        <p className="text-[14.5px] leading-[1.4] font-semibold text-[#FAFAFA] m-0">{c.title}</p>
        <span className="mt-1 inline-block text-[11px] text-[#6A6A6A] group-open:hidden" style={MONO}>
          show the receipt ▾
        </span>
      </summary>

      <div className="px-3.5 sm:px-4 pb-4 -mt-1">
        <p className="text-[14px] leading-[1.55] text-[#9A9A9A] m-0 border-l-2 pl-3" style={{ borderColor: `${tone}55` }}>
          &ldquo;{c.excerpt}&rdquo;
        </p>
        <dl className="mt-3 space-y-2 m-0">
          <div>
            <dt className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[#6A6A6A]" style={MONO}>Why it attaches</dt>
            <dd className="mt-0.5 ml-0 text-[13.5px] leading-[1.5] text-[#B8B8B8]">{c.why}</dd>
          </div>
          <div>
            <dt className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[#6A6A6A]" style={MONO}>What it means</dt>
            <dd className="mt-0.5 ml-0 text-[13.5px] leading-[1.5] text-[#B8B8B8]">{c.whatItMeans}</dd>
          </div>
          {c.consider && (
            <div>
              <dt className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[#6A6A6A]" style={MONO}>Consider</dt>
              <dd className="mt-0.5 ml-0 text-[13.5px] leading-[1.5] text-[#B8B8B8]">{c.consider}</dd>
            </div>
          )}
        </dl>
        {c.url && (
          <a href={c.url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center min-h-[44px] text-[11px] text-[#E6B94D] hover:brightness-110" style={MONO}>
            source ↗
          </a>
        )}
      </div>
    </details>
  );
}

/**
 * One mechanism, collapsed to a single line until asked. The line has to carry
 * enough to decide whether to open it: what the story is, how far it can push
 * the pillar, and how independently it is corroborated.
 *
 * Mechanisms that can move the pillar open by default. Everything else stays
 * shut, which is the difference between a monitor and a firehose.
 */
function MechanismBlock({
  m,
  pillarSize,
  defaultOpen,
}: {
  m: Mechanism<ScoredCatch>;
  pillarSize: number;
  defaultOpen: boolean;
}) {
  const tone = LADDER_TONE[m.maxStatus];
  const contra = m.items.filter((c) => c.verdict === 'contradicts').length;
  const unseparated = m.mentions > 8 && m.mentions / pillarSize > 0.25;

  return (
    <details open={defaultOpen} className="group rounded-md border border-white/[0.06] overflow-hidden">
      <summary className="list-none cursor-pointer px-3.5 py-3 min-h-[44px] hover:bg-white/[0.02]">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[13px] leading-none text-[#8A8A8A] group-open:rotate-90 transition-transform inline-block" style={MONO}>
            ▸
          </span>
          <span className="text-[14px] font-semibold text-[#FAFAFA]">{m.label}</span>
          <Chip tone={tone}>{LADDER_LABEL[m.maxStatus]}</Chip>
          {contra > 0 && (
            <span className="text-[10.5px] uppercase tracking-[0.12em] text-[#F87171]" style={MONO}>
              {contra} against
            </span>
          )}
          <span className="ml-auto text-[11px] text-[#6A6A6A] whitespace-nowrap" style={MONO}>
            {m.confirmations}× confirmed · {m.mentions} {m.mentions === 1 ? 'mention' : 'mentions'}
          </span>
        </div>
        <p className="mt-1.5 ml-[18px] text-[12.5px] leading-[1.5] text-[#8A8A8A] m-0">
          {m.sourceClasses.map((s) => SOURCE_CLASS_LABEL[s]).join(' · ')} — {m.ladderReason}
          {m.firstSeen !== m.lastSeen && (
            <span className="text-[#6A6A6A]" style={MONO}> · {m.firstSeen} to {m.lastSeen}</span>
          )}
        </p>
      </summary>

      {unseparated && (
        <p className="px-3.5 pb-2 text-[12px] leading-[1.5] text-[#E6B94D] m-0">
          This grouping did not separate. Entity overlap is standing in for a real mechanism enum, and it holds up on
          names with distinct external actors far better than on financials, where most coverage shares one vocabulary.
        </p>
      )}
      {/* Indent so a finding reads as evidence FOR the mechanism above it,
          rather than as a sibling of it. */}
      <div className="border-t border-white/[0.05] bg-[#080808] pl-[18px]">
        {m.items.map((c) => (
          <CatchRow key={c.id} c={c} />
        ))}
      </div>
    </details>
  );
}

function PillarBlock({ p }: { p: ScoredPillar }) {
  const contra = p.catches.filter((c) => c.verdict === 'contradicts').length;
  const decisive = p.catches.filter((c) => weight(c) === 'decisive').length;
  const topCeiling = p.mechanisms.reduce<LadderStatus>((m, x) => {
    const rank = { watch: 0, weakening: 1, broken: 2 } as const;
    return rank[x.maxStatus] > rank[m] ? x.maxStatus : m;
  }, 'watch');

  // A single uncorroborated mention is the firehose. It is kept, because
  // dropping evidence is how you miss the first sign of something, but it is
  // not worth a row of its own until something confirms it.
  const live = p.mechanisms.filter((m) => m.maxStatus !== 'watch' || m.mentions > 1);
  const quiet = p.mechanisms.filter((m) => m.maxStatus === 'watch' && m.mentions === 1);
  const movers = p.mechanisms.filter((m) => m.maxStatus !== 'watch').length;

  return (
    <section className="mt-4 rounded-lg border border-white/[0.07] bg-[#0B0B0B] overflow-hidden">
      <div className="px-4 sm:px-5 py-4 border-b border-white/[0.05]">
        <p className="text-[16px] leading-[1.4] font-semibold text-[#FAFAFA] m-0">{p.claim}</p>
        {p.breaksIf ? (
          <p className="mt-2 text-[13px] leading-[1.5] text-[#8A8A8A] m-0">
            <span className="text-[#E6B94D] uppercase tracking-[0.08em] text-[10.5px]" style={MONO}>Breaks if </span>
            {p.breaksIf}
          </p>
        ) : (
          <p className="mt-2 text-[12.5px] leading-[1.5] text-[#F87171] m-0">
            No kill criterion on this pillar, so realized-vs-emerging cannot be answered honestly. 164 of 171 user
            pillars are in this state; every hand-authored house pillar has one.
          </p>
        )}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <Chip tone={LADDER_TONE[topCeiling]}>ceiling: {LADDER_LABEL[topCeiling]}</Chip>
          <span className="text-[11px] text-[#6A6A6A]" style={MONO}>
            {movers} of {p.mechanisms.length} mechanisms can move this pillar · {p.catches.length} findings ·{' '}
            {contra} against · {decisive} decisive
          </span>
        </div>
      </div>

      {/* §5 mechanisms: the compression layer, and the unit the reader opens */}
      <div className="px-4 sm:px-5 py-4">
        <SectionLabel prototype>Mechanisms</SectionLabel>
        <p className="mt-1.5 mb-3 text-[12.5px] leading-relaxed text-[#7A7A7A]">
          One story reported five times is one mechanism with five mentions, not five alerts. Repetition inside a source
          class adds recency, never weight, which is what stops three news items outweighing one filing. Anything that
          can move the pillar is open; the rest waits until you ask.
        </p>

        <div className="space-y-2.5">
          {live.map((m, i) => (
            <MechanismBlock
              key={`${m.label}-${i}`}
              m={m}
              pillarSize={p.catches.length}
              // Anything that can move the pillar opens. If nothing can, the
              // best-corroborated one still opens, so the pillar is never a
              // wall of shut drawers.
              defaultOpen={m.maxStatus !== 'watch' || (movers === 0 && i === 0)}
            />
          ))}
        </div>

        {quiet.length > 0 && (
          <details className="group mt-2.5 rounded-md border border-white/[0.06] border-dashed">
            <summary className="list-none cursor-pointer px-3.5 py-3 min-h-[44px] flex items-baseline gap-2 flex-wrap hover:bg-white/[0.02]">
              <span className="text-[13px] leading-none text-[#8A8A8A] group-open:rotate-90 transition-transform inline-block" style={MONO}>▸</span>
              <span className="text-[13.5px] text-[#8A8A8A]">
                {quiet.length} single mentions nothing has confirmed
              </span>
              <span className="ml-auto text-[11px] text-[#5F5F5F]" style={MONO}>kept, not counted</span>
            </summary>
            <div className="border-t border-white/[0.05] bg-[#080808]">
              {quiet.map((m) => (
                <CatchRow key={m.items[0].id} c={m.items[0]} />
              ))}
            </div>
          </details>
        )}
      </div>
    </section>
  );
}

/* ── page ──────────────────────────────────────────────────────────────── */

export default async function ThesisV2({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { t } = await searchParams;
  const ticker = (t ?? 'AMZN').toUpperCase();
  const data = await getScoringThesisData(ticker);

  const folded = data.rawRows - data.dedupedRows;
  const mechanisms = data.pillars.reduce((s, p) => s + p.mechanisms.length, 0);

  return (
    <div className="min-h-dvh bg-[#060606] px-4 sm:px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <Link href="/testing" className="inline-flex items-center min-h-[44px] text-[12px] text-[#6A6A6A] hover:text-[#FAFAFA]" style={MONO}>
          ← Testing
        </Link>

        <div className="mt-1 flex flex-wrap gap-2">
          {PICKS.map((p) => (
            <Link key={p} href={`/testing/thesis-v2?t=${p}`}
              className={`px-3 min-h-[44px] inline-flex items-center rounded-full border text-[12px] tracking-[0.1em] ${
                p === ticker
                  ? 'border-[rgba(230,185,77,0.4)] bg-[rgba(230,185,77,0.08)] text-[#E6B94D]'
                  : 'border-white/[0.08] text-[#8A8A8A] hover:text-[#FAFAFA]'
              }`} style={MONO}>
              {p}
            </Link>
          ))}
        </div>

        <div className="mt-5 flex items-baseline gap-3 flex-wrap">
          <h1 className="text-[30px] font-bold tracking-tight text-[#FAFAFA] m-0">{data.ticker}</h1>
          {data.company && <span className="text-[14px] text-[#8A8A8A]">{data.company}</span>}
          <span className="ml-auto text-[11px] text-[#6A6A6A]" style={MONO}>
            last scan {data.lastScan ? data.lastScan.slice(0, 10) : 'never'}
          </span>
        </div>

        {/* §0 the whole argument, in numbers, on this ticker */}
        <section className="mt-4 rounded-lg border border-[rgba(230,185,77,0.25)] bg-[rgba(230,185,77,0.05)] px-4 py-4">
          <SectionLabel>§0 pipeline comparison</SectionLabel>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
            {[
              { n: data.publicRows, l: 'public page today', s: 'content_events' },
              { n: data.dedupedRows, l: 'scoring pipeline', s: 'pillar_evidence' },
              { n: mechanisms, l: 'mechanisms', s: 'after clustering' },
              { n: data.contributingUsers, l: 'scans folded', s: `${folded} duplicate rows` },
            ].map((x) => (
              <div key={x.l}>
                <div className="text-[24px] font-bold text-[#FAFAFA] leading-none" style={MONO}>{x.n}</div>
                <div className="mt-1 text-[11.5px] text-[#C8C8C8]">{x.l}</div>
                <div className="text-[10.5px] text-[#7A7A7A]" style={MONO}>{x.s}</div>
              </div>
            ))}
          </div>
          <p className="mt-3.5 mb-0 text-[12.5px] leading-relaxed text-[#C8C8C8]">
            Every quote, date, source, verdict and materiality below is a real row. Mechanism grouping, evidence class
            and weight are <span className="text-[#E6B94D]">PROTOTYPE</span> heuristics standing in for fields the schema
            does not have yet. Nothing on this page writes, and no public page reads it.
          </p>
        </section>

        {/* §3 legend, so the tiers are not just words */}
        <section className="mt-4 rounded-lg border border-white/[0.07] bg-[#0B0B0B] px-4 sm:px-5 py-4">
          <SectionLabel>What the weights mean</SectionLabel>
          <dl className="mt-2.5 space-y-1.5 m-0">
            {(['decisive', 'contributing', 'context'] as const).map((w) => (
              <div key={w} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                <dt className="w-[110px] shrink-0 text-[11px] uppercase tracking-[0.12em] text-[#E6B94D]" style={MONO}>{w}</dt>
                <dd className="ml-0 text-[13px] leading-[1.5] text-[#9A9A9A]">{WEIGHT_MEANING[w]}</dd>
              </div>
            ))}
          </dl>
        </section>

        {data.pillars.length === 0 ? (
          <p className="mt-10 text-[15px] text-[#8A8A8A]">
            No scored evidence for {data.ticker}. {data.hasHouseThesis
              ? 'A house thesis exists but nobody tracks this ticker, so the scorer has never run on it. That gap closes when house theses are scored under a system user.'
              : 'No house thesis and no user tracks it.'}
          </p>
        ) : (
          data.pillars.map((p) => <PillarBlock key={p.key} p={p} />)
        )}
      </div>
    </div>
  );
}
