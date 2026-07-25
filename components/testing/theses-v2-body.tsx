// Theses as a terminal table (v3 proposal, 2026-07-25).
//
// Three rounds of feedback killed the previous shapes: separated per-ticker
// sections scroll forever, drawer hierarchies read as an internal tool, and
// ladder jargon means nothing to a user. This is the opposite: every thesis is
// ONE row in ONE dense table — ticker, a plain-English status word, pillar
// count, the single thing that matters right now, last activity. A row expands
// INLINE to pillar status lines with the freshest receipt under each. Nothing
// navigates away; nothing repeats; no term of art survives to the screen.

import { createStaticServiceClient } from '@/lib/supabase/server';
import { getScoringThesisData, type ScoringThesisData, type ScoredPillar } from '@/lib/content/scoring-thesis';
import { topCeiling } from '@/components/testing/thesis-v2-blocks';
import { convergence, type LadderStatus } from '@/lib/content/mechanism-cluster';

const MONO = { fontFamily: 'var(--font-mono)' } as const;
const MAX_THESES = 8;

/* Plain-English status vocabulary — the ladder stays internal. */
const STATUS_WORD: Record<LadderStatus, string> = {
  watch: 'steady',
  weakening: 'under pressure',
  broken: 'breaking',
};
const STATUS_TONE: Record<LadderStatus, string> = {
  watch: '#4ADE80',
  weakening: '#E6B94D',
  broken: '#F87171',
};
const RANK: Record<LadderStatus, number> = { broken: 0, weakening: 1, watch: 2 };

function thesisCeiling(d: ScoringThesisData): LadderStatus {
  return d.pillars.reduce<LadderStatus>(
    (worst, p) => (RANK[topCeiling(p.mechanisms)] < RANK[worst] ? topCeiling(p.mechanisms) : worst),
    'watch',
  );
}

/** The one thing that matters on this thesis right now, in one sentence. */
function headline(d: ScoringThesisData): string {
  // Worst pillar first; inside it, the strongest adverse mechanism's label.
  const pillars = [...d.pillars].sort(
    (a, b) => RANK[topCeiling(a.mechanisms)] - RANK[topCeiling(b.mechanisms)],
  );
  const worst = pillars[0];
  if (!worst) return 'No scored evidence yet.';
  const worstStatus = topCeiling(worst.mechanisms);
  if (worstStatus === 'watch') {
    const latest = d.pillars.flatMap((p) => p.catches)[0];
    return latest ? `Quiet. Latest: ${latest.title}` : 'Quiet. Nothing challenges this thesis.';
  }
  const mover = worst.mechanisms.find((m) => m.maxStatus === worstStatus);
  const conv = convergence(worst.mechanisms);
  const base = mover ? mover.label : 'Multiple reports';
  return conv.converging
    ? `${base} — and ${conv.adverseMechanisms - 1} more independent ${conv.adverseMechanisms - 1 === 1 ? 'issue' : 'issues'} on the same pillar`
    : base;
}

function pillarStateLine(p: ScoredPillar): { status: LadderStatus; line: string } {
  const status = topCeiling(p.mechanisms);
  if (status === 'watch') return { status, line: 'nothing confirmed against it' };
  const mover = p.mechanisms.find((m) => m.maxStatus === status);
  const classes = mover?.sourceClasses.length ?? 0;
  const corroboration =
    classes >= 2 ? `${classes} independent source types` : 'a single source so far';
  return { status, line: `${mover?.label ?? 'multiple reports'} · ${corroboration}` };
}

/** One mechanism as one line: the story, how corroborated, receipts a click away. */
function StoryLine({ m }: { m: ScoredPillar['mechanisms'][number] }) {
  const adverse = m.maxStatus !== 'watch';
  const tone = STATUS_TONE[m.maxStatus];
  const corroboration =
    m.sourceClasses.length >= 2
      ? `${m.sourceClasses.length} independent source types`
      : 'single source';

  return (
    <details className="group/story">
      <summary className="list-none cursor-pointer flex items-baseline gap-2 py-1 hover:bg-white/[0.02] rounded px-1 -mx-1">
        <span className="mt-[1px] w-1 h-1 rounded-full shrink-0" style={{ background: adverse ? tone : '#3F3F3F' }} />
        <span className={`text-[12.5px] leading-[1.45] min-w-0 truncate ${adverse ? 'text-[#C8C8C8]' : 'text-[#8A8A8A]'}`}>
          {m.label}
        </span>
        <span className="ml-auto shrink-0 text-[10.5px] text-[#5F5F5F]" style={MONO}>
          {m.mentions} {m.mentions === 1 ? 'report' : 'reports'} · {corroboration}
        </span>
      </summary>
      <div className="ml-3 pb-1.5 space-y-1">
        {m.items.slice(0, 2).map((c) => (
          <div key={c.id} className="text-[11.5px] leading-[1.5] text-[#6A6A6A]">
            <span style={MONO} className="text-[10px] text-[#5F5F5F]">{c.dateISO} · </span>
            {c.url ? (
              <a href={c.url} target="_blank" rel="noopener noreferrer" className="hover:text-[#E6B94D] transition-colors">
                {c.title}
              </a>
            ) : (
              c.title
            )}
            {c.excerpt && (
              <span className="block text-[11px] text-[#5F5F5F] italic mt-0.5">&ldquo;{c.excerpt.slice(0, 160)}&rdquo;</span>
            )}
          </div>
        ))}
        {m.items.length > 2 && (
          <div className="text-[10.5px] text-[#5F5F5F]" style={MONO}>+{m.items.length - 2} more reports</div>
        )}
      </div>
    </details>
  );
}

function PillarLine({ p }: { p: ScoredPillar }) {
  const { status, line } = pillarStateLine(p);

  // The stories under this pillar, adverse first, quiet single-mention noise
  // compressed to one count line. Mechanisms stay — as one clean line each.
  const adverse = p.mechanisms.filter((m) => m.maxStatus !== 'watch');
  const corroboratedQuiet = p.mechanisms.filter((m) => m.maxStatus === 'watch' && m.mentions > 1);
  const singles = p.mechanisms.length - adverse.length - corroboratedQuiet.length;
  const shown = [...adverse, ...corroboratedQuiet].slice(0, 4);

  return (
    <div className="py-2.5 border-t border-white/[0.04] first:border-t-0">
      <div className="flex items-baseline gap-2.5">
        <span className="mt-[1px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATUS_TONE[status] }} />
        <span className="text-[13.5px] leading-[1.45] text-[#DADADA] min-w-0">{p.claim}</span>
      </div>
      <div className="ml-4 mt-0.5 text-[11.5px] text-[#7A7A7A]">{line}</div>

      {shown.length > 0 && (
        <div className="ml-4 mt-1.5">
          {shown.map((m, i) => (
            <StoryLine key={`${m.label}-${i}`} m={m} />
          ))}
          {singles > 0 && (
            <div className="text-[10.5px] text-[#4A4A4A] py-1" style={MONO}>
              +{singles} single mentions nothing has confirmed
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export async function ThesesV2Body({ email }: { email: string }) {
  const target = email.trim().toLowerCase();
  if (!target) {
    return <p className="text-[14px] text-[#8A8A8A] m-0">Pick an account to see its theses.</p>;
  }

  const db = createStaticServiceClient();
  const { data: profile } = await db
    .from('user_profiles')
    .select('id, email')
    .eq('email', target)
    .maybeSingle();
  if (!profile) return <p className="text-[14px] text-[#FAFAFA] m-0">No account for {target}</p>;

  const { data: theses } = await db
    .from('theses')
    .select('ticker, tracked')
    .eq('user_id', profile.id)
    .order('tracked', { ascending: false });

  const tickers = [...new Set((theses ?? []).map((t) => String(t.ticker).toUpperCase()))].slice(0, MAX_THESES);
  const data = (await Promise.all(tickers.map((t) => getScoringThesisData(t)))).filter((d) => d.pillars.length > 0);

  const rows = data
    .map((d) => ({ d, ceiling: thesisCeiling(d) }))
    .sort((a, b) => RANK[a.ceiling] - RANK[b.ceiling]);

  const pressured = rows.filter((r) => r.ceiling !== 'watch').length;

  return (
    <div>
      <div className="flex items-baseline gap-3 flex-wrap">
        <h1 className="text-[26px] font-bold tracking-tight text-[#FAFAFA] m-0">Theses</h1>
        <span className="text-[12.5px] text-[#8A8A8A]">
          {pressured === 0
            ? `All ${rows.length} steady. Nothing needs your attention.`
            : `${pressured} of ${rows.length} under pressure.`}
        </span>
        <span className="ml-auto text-[10.5px] text-[#5F5F5F]" style={MONO}>v3 proposal · terminal table</span>
      </div>

      <div className="mt-4 rounded-lg border border-white/[0.08] bg-[#0A0A0A] overflow-hidden">
        {/* header row */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-white/[0.06] text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#5F5F5F]" style={MONO}>
          <span className="w-[64px] shrink-0">Ticker</span>
          <span className="w-[120px] shrink-0">Status</span>
          <span className="w-[72px] shrink-0 text-right">Pillars OK</span>
          <span className="flex-1 min-w-0">What matters right now</span>
          <span className="w-[76px] shrink-0 text-right">Last scan</span>
        </div>

        {rows.map(({ d, ceiling }) => {
          const okPillars = d.pillars.filter((p) => topCeiling(p.mechanisms) === 'watch').length;
          return (
            <details key={d.ticker} className="group border-b border-white/[0.05] last:border-b-0">
              <summary className="list-none cursor-pointer flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                <span className="w-[64px] shrink-0 text-[14.5px] font-semibold text-[#FAFAFA]" style={MONO}>
                  {d.ticker}
                </span>
                <span className="w-[120px] shrink-0 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_TONE[ceiling] }} />
                  <span className="text-[12px] font-semibold" style={{ ...MONO, color: STATUS_TONE[ceiling] }}>
                    {STATUS_WORD[ceiling]}
                  </span>
                </span>
                <span className="w-[72px] shrink-0 text-right text-[12.5px] text-[#8A8A8A]" style={MONO}>
                  {okPillars}/{d.pillars.length}
                </span>
                <span className="flex-1 min-w-0 truncate text-[13px] text-[#B8B8B8]">{headline(d)}</span>
                <span className="w-[76px] shrink-0 text-right text-[10.5px] text-[#5F5F5F]" style={MONO}>
                  {d.lastScan ? d.lastScan.slice(5, 10) : '—'}
                </span>
              </summary>

              {/* inline expansion: pillars as status lines, freshest receipt each */}
              <div className="px-4 pb-3 pl-[76px] bg-[#080808]">
                {[...d.pillars]
                  .sort((a, b) => RANK[topCeiling(a.mechanisms)] - RANK[topCeiling(b.mechanisms)])
                  .map((p) => (
                    <PillarLine key={p.key} p={p} />
                  ))}
                <div className="pt-2.5 border-t border-white/[0.04]">
                  <a
                    href="/dashboard/theses"
                    className="text-[11px] text-[#E6B94D] hover:brightness-110"
                    style={MONO}
                  >
                    full history & evidence →
                  </a>
                </div>
              </div>
            </details>
          );
        })}

        {rows.length === 0 && (
          <p className="px-4 py-6 text-[13.5px] text-[#8A8A8A] m-0">No theses with scored evidence on this account.</p>
        )}
      </div>

      <p className="mt-3 text-[11px] leading-[1.6] text-[#5F5F5F] m-0" style={MONO}>
        {profile.email} · every status derives from cited evidence; open a row for the receipts.
      </p>
    </div>
  );
}
