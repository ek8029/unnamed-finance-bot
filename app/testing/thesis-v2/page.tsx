// /testing/thesis-v2 — the Thesis Intelligence v2 concepts rendered on REAL
// approved catches (same source as /thesis/[ticker]).
//
// HONESTY RULE: everything here is computed from real DB rows. Where a concept
// needs a field the schema doesn't have yet (mechanism_id, magnitude,
// evidence_class, headline), it is DERIVED BY A LABELLED PROTOTYPE HEURISTIC and
// marked as such on screen. Nothing is invented and nothing mock is dressed as real.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTickerThesisData, type PublicPillar, type PublicCatch } from '@/lib/content/public-thesis';

export const metadata = { title: 'Thesis v2', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const MONO = { fontFamily: 'var(--font-mono)' } as const;
// Tickers with enough approved evidence to evaluate density and clustering.
const PICKS = ['MSTR', 'GME', 'NVDA', 'TSM', 'AVGO', 'LCID', 'AAPL', 'NFLX'];

const STATUS_TONE: Record<string, string> = {
  intact: '#4ADE80', watch: '#E6B94D', weakening: '#E6B94D', broken: '#F87171', unverified: '#6A6A6A',
};

/* ── Prototype heuristics (stand in for fields the schema doesn't have yet) ── */

// §4 realized vs emerging. Real rule would come from the judge answering
// "has breaks_if been met, or is it just more likely?"
function evidenceClass(c: PublicCatch): 'realized' | 'emerging' | 'speculative' {
  const t = c.verbatimCite.toLowerCase();
  const hedged = /\b(could|may|might|expects?|projected|forecast|potential|risk of|would)\b/.test(t);
  const hasPastNumber = /\b(totaled|reported|increased|declined|rose|fell|was|were|recorded|had)\b/.test(t);
  if (c.sourceType === 'filing' && hasPastNumber && !hedged) return 'realized';
  if (hedged) return c.sourceType === 'filing' ? 'emerging' : 'speculative';
  return c.sourceType === 'filing' ? 'realized' : 'emerging';
}

// §3 magnitude. Real rule would be judge-emitted.
function magnitude(c: PublicCatch): 'routine' | 'material' | 'major' {
  const t = c.verbatimCite;
  if (/\$\s?\d+(\.\d+)?\s?(b|billion)/i.test(t) || /\b\d{2,}(\.\d+)?\s?(percent|%)/.test(t)) return 'major';
  if (/\$\s?\d/.test(t) || /\b\d+(\.\d+)?\s?(percent|%)/.test(t)) return 'material';
  return 'routine';
}

// §5 mechanism clustering. Real version = per-pillar enum from breaks_if + 10-K
// risk factors, picked by the judge. Here: cluster on shared salient entities.
const STOP = new Set(['The', 'This', 'That', 'These', 'Those', 'As', 'For', 'And', 'But', 'Our', 'We', 'In', 'On', 'At', 'It', 'A', 'An', 'Of', 'To', 'Its', 'Company', 'Inc', 'Corp']);
function entities(text: string): string[] {
  const caps = text.match(/\b[A-Z][A-Za-z0-9.&-]{1,}\b/g) ?? [];
  return [...new Set(caps.filter((w) => !STOP.has(w) && w.length > 1))];
}
function clusterByMechanism(catches: PublicCatch[]) {
  const clusters: { key: string; label: string; items: PublicCatch[] }[] = [];
  for (const c of catches) {
    const ents = entities(c.verbatimCite);
    const hit = clusters.find((cl) => ents.some((e) => cl.key.includes(e)));
    if (hit) { hit.items.push(c); hit.key = [...new Set([...hit.key.split('|'), ...ents])].join('|'); }
    else clusters.push({ key: ents.join('|'), label: ents.slice(0, 2).join(' + ') || 'Unlabelled', items: [c] });
  }
  return clusters.sort((a, b) => b.items.length - a.items.length);
}

// §2 thesis-relative headline. Real version writes this at judge time with a
// per-pillar `shorthand`; this is a mechanical stand-in to evaluate the format.
function headline(c: PublicCatch, pillarShorthand: string): string {
  const subject = entities(c.verbatimCite)[0] ?? 'New evidence';
  const verb = c.verdict === 'contradicts' ? 'cuts into' : 'puts fresh numbers behind';
  return `${subject} ${verb} your ${pillarShorthand}`;
}
function shorthand(claim: string): string {
  const w = claim.split(/\s+/).slice(0, 4).join(' ').replace(/[,.]$/, '');
  return `${w.toLowerCase()} call`;
}

// §6 synthesis, derived from COMPUTED statuses only, never a free-form take.
function synthesize(ticker: string, pillars: PublicPillar[]): string {
  const strong = pillars.filter((p) => p.status === 'intact');
  const weak = pillars.filter((p) => p.status === 'weakening' || p.status === 'broken');
  const watch = pillars.filter((p) => p.status === 'watch');
  if (!strong.length && !weak.length && !watch.length) return `No approved evidence has landed on ${ticker} yet.`;
  const parts: string[] = [];
  if (strong.length) parts.push(`${strong.length} of ${pillars.length} pillars are holding on current evidence`);
  if (weak.length) parts.push(`${weak.length} ${weak.length === 1 ? 'is' : 'are'} under real pressure`);
  if (watch.length) parts.push(`${watch.length} ${watch.length === 1 ? 'is' : 'are'} worth watching`);
  const carrier = strong[0]?.claim ?? watch[0]?.claim;
  const tail = weak.length && carrier ? ` The thesis is being carried by "${carrier}", not by the pillars under pressure.` : '';
  return `${parts.join(', ')}.${tail}`;
}

export default async function ThesisV2({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { t } = await searchParams;
  const ticker = (t ?? 'MSTR').toUpperCase();
  const data = await getTickerThesisData(ticker);

  const all = data ? data.pillars.flatMap((p) => p.catches) : [];
  const thesisLane = all;                 // every approved catch is pillar-bound today
  const companyLaneCount = 0;             // §1 lane doesn't exist in the schema yet
  const clusters = clusterByMechanism(all);

  return (
    <div className="min-h-dvh bg-[#060606] px-5 sm:px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <Link href="/testing" className="text-[12px] text-[#6A6A6A] hover:text-[#FAFAFA]" style={MONO}>← Testing</Link>

        {/* ticker switcher */}
        <div className="mt-5 flex flex-wrap gap-2">
          {PICKS.map((p) => (
            <Link key={p} href={`/testing/thesis-v2?t=${p}`}
              className={`px-3 h-[32px] inline-flex items-center rounded-full border text-[12px] tracking-[0.1em] ${
                p === ticker ? 'border-[rgba(230,185,77,0.4)] bg-[rgba(230,185,77,0.08)] text-[#E6B94D]' : 'border-white/[0.08] text-[#8A8A8A] hover:text-[#FAFAFA]'
              }`} style={MONO}>{p}</Link>
          ))}
        </div>

        <div className="mt-4 rounded-md border border-[rgba(230,185,77,0.25)] bg-[rgba(230,185,77,0.05)] px-4 py-3">
          <p className="text-[12.5px] leading-relaxed text-[#C8C8C8] m-0">
            All catches, quotes, dates, sources and pillar statuses below are <strong>real</strong> (same data as /thesis/{ticker.toLowerCase()}).
            Fields the schema does not have yet (mechanism, magnitude, evidence class, headline) are marked
            <span className="text-[#E6B94D]"> PROTOTYPE</span> and computed by a labelled heuristic so the format can be judged.
          </p>
        </div>

        {!data ? (
          <p className="mt-10 text-[15px] text-[#8A8A8A]">No house thesis for {ticker}.</p>
        ) : (
          <>
            {/* ── header ── */}
            <div className="mt-8 flex items-baseline gap-3 flex-wrap">
              <h1 className="text-[30px] font-bold tracking-tight text-[#FAFAFA] m-0">{data.ticker}</h1>
              <span className="text-[14px] text-[#8A8A8A]">{data.company}</span>
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] px-2 py-1 rounded"
                style={{ ...MONO, color: STATUS_TONE[data.health], background: `${STATUS_TONE[data.health]}14` }}>
                {data.healthLabel}
              </span>
              <span className="ml-auto text-[11px] text-[#6A6A6A]" style={MONO}>
                {all.length} approved {all.length === 1 ? 'catch' : 'catches'} · as of {data.asOfDate ?? 'n/a'}
              </span>
            </div>

            {/* ── §6 synthesis ── */}
            <section className="mt-6 rounded-lg border border-white/[0.07] bg-[#0B0B0B] p-5">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#6A6A6A] mb-2" style={MONO}>
                Thesis analysis · derived from computed statuses
              </div>
              <p className="text-[15.5px] leading-[1.55] text-[#D8D8D8] m-0">{synthesize(data.ticker, data.pillars)}</p>
            </section>

            {/* ── §7 analysis breakdown ── */}
            <section className="mt-4 rounded-lg border border-white/[0.07] bg-[#0B0B0B] p-5">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#6A6A6A] mb-4" style={MONO}>
                Analysis breakdown
              </div>
              <div className="space-y-5">
                {data.pillars.map((p) => (
                  <div key={p.id} className="border-l-2 pl-4" style={{ borderColor: STATUS_TONE[p.status] }}>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ ...MONO, color: STATUS_TONE[p.status] }}>
                        {p.statusLabel}
                      </span>
                      <span className="text-[11px] text-[#5F5F5F]" style={MONO}>
                        {p.catches.length} {p.catches.length === 1 ? 'alert' : 'alerts'}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[15px] leading-[1.45] text-[#D8D8D8] m-0">{p.claim}</p>
                    <p className="mt-1.5 text-[13px] leading-[1.5] text-[#7A7A7A] m-0">
                      <span className="text-[#E6B94D] uppercase tracking-[0.08em] text-[10.5px]" style={MONO}>Breaks if </span>{p.breaks_if}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* ── §5 mechanism clusters ── */}
            <section className="mt-4 rounded-lg border border-white/[0.07] bg-[#0B0B0B] p-5">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#6A6A6A]" style={MONO}>Mechanism clusters</span>
                <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#E6B94D]" style={MONO}>Prototype</span>
              </div>
              <p className="text-[12.5px] text-[#7A7A7A] leading-relaxed mt-0 mb-4">
                One story reported five times should be one row with five confirmations, not five alerts. Clustered here on shared entities; the real version uses a per-pillar mechanism enum.
              </p>
              {clusters.length === 0 ? (
                <p className="text-[13px] text-[#6A6A6A] m-0" style={MONO}>No catches to cluster.</p>
              ) : (
                <div className="space-y-3">
                  {clusters.map((cl, i) => {
                    const classes = [...new Set(cl.items.map((c) => c.sourceLabel))];
                    const gated = classes.length >= 2 ? 'may weaken' : 'watch only';
                    return (
                      <div key={i} className="rounded-md border border-white/[0.06] p-3.5">
                        <div className="flex items-baseline justify-between gap-3 flex-wrap">
                          <span className="text-[14px] font-semibold text-[#FAFAFA]">{cl.label}</span>
                          <span className="text-[11px] text-[#6A6A6A]" style={MONO}>
                            {cl.items.length} confirmation{cl.items.length === 1 ? '' : 's'} · {classes.length} source class{classes.length === 1 ? '' : 'es'} · ladder: {gated}
                          </span>
                        </div>
                        <p className="mt-2 text-[13.5px] leading-[1.5] text-[#9A9A9A] m-0">
                          Latest: &ldquo;{cl.items[0].verbatimCite.slice(0, 150)}{cl.items[0].verbatimCite.length > 150 ? '…' : ''}&rdquo;
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── §1/2/3/4 alert rows ── */}
            <section className="mt-4 rounded-lg border border-white/[0.07] bg-[#0B0B0B] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-white/[0.05] flex items-baseline gap-2 flex-wrap">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#6A6A6A]" style={MONO}>Alerts</span>
                <span className="text-[11px] text-[#5F5F5F]" style={MONO}>
                  {thesisLane.length} thesis · {companyLaneCount} company (lane not in schema yet)
                </span>
              </div>
              {all.length === 0 ? (
                <p className="px-5 py-6 text-[13px] text-[#6A6A6A] m-0" style={MONO}>
                  No approved catches. This is the approval-queue problem from §0 of the spec, not a detection problem.
                </p>
              ) : (
                <div className="divide-y divide-white/[0.05]">
                  {data.pillars.flatMap((p) =>
                    p.catches.map((c) => {
                      const cls = evidenceClass(c);
                      const mag = magnitude(c);
                      const contra = c.verdict === 'contradicts';
                      const tone = contra ? '#F87171' : '#4ADE80';
                      return (
                        <div key={c.id} className="px-5 py-4">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em] px-1.5 py-0.5 rounded" style={{ ...MONO, color: tone, background: `${tone}14` }}>
                              Thesis alert
                            </span>
                            <span className="text-[9.5px] uppercase tracking-[0.12em]" style={{ ...MONO, color: tone }}>
                              {contra ? '▼' : '▲'} {mag}
                            </span>
                            <span className="text-[9.5px] uppercase tracking-[0.12em] text-[#8A8A8A]" style={MONO}>{cls}</span>
                            <span className="ml-auto text-[10.5px] text-[#5F5F5F]" style={MONO}>{c.sourceLabel} · {c.dateISO}</span>
                          </div>
                          <p className="text-[15px] leading-[1.4] font-semibold text-[#FAFAFA] m-0">
                            {headline(c, shorthand(p.claim))}
                            <span className="ml-2 text-[8.5px] font-semibold uppercase tracking-[0.14em] text-[#E6B94D] align-middle" style={MONO}>Prototype</span>
                          </p>
                          <p className="mt-2 text-[14px] leading-[1.5] text-[#9A9A9A] m-0 border-l-2 pl-3" style={{ borderColor: `${tone}55` }}>
                            &ldquo;{c.verbatimCite}&rdquo;
                          </p>
                          {c.sourceUrl && (
                            <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-[11px] text-[#E6B94D] hover:brightness-110" style={MONO}>
                              source ↗
                            </a>
                          )}
                        </div>
                      );
                    }),
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
