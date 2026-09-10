// Shared default thesis table: production and screenshot previews render the
// same markup and derivations. No data fetching or browser APIs belong here.
// The one exception is the Earnings column, which fills in after paint from
// components/thesis/theses-earnings and reads as no estimate until it does:
// its dates are one SEC HTTP call per ticker, measured at 341 to 666ms for 21
// tickers on a cold process, and no column here is worth holding the page for.
//
// The row bodies are the second exception, for the same reason at ten times the
// size: 21 tickers shipped 1.19MB of HTML, nearly all of it 170 mechanism lines
// behind closed disclosures. They now arrive per ticker from /api/thesis/board
// when a row is opened (components/thesis/thesis-row-receipts). Every summary
// line, every number and the row order are still rendered here.

import type { ScoringThesisData } from '@/lib/content/scoring-thesis';
import {
  EarningsCell, EarningsProvider, NextEarningsDate, NextEarningsTicker, type EarningsByTicker,
} from '@/components/thesis/theses-earnings';
import { PillarLine } from '@/components/thesis/thesis-receipts';
import { ThesisRowReceipts } from '@/components/thesis/thesis-row-receipts';
import { type LadderStatus } from '@/lib/content/mechanism-cluster';
import {
  RANK, STATUS_TONE, STATUS_WORD, headline, isFresh, pillarReceipts, pillarsInOrder, tally, thesisCeiling,
} from '@/lib/content/thesis-board';

const MONO = { fontFamily: 'var(--font-mono)' } as const;

const money = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n).toLocaleString('en-US')}`;

export interface ThesisTablePosition {
  value: number;
  pl: number | null;
  plPct: number | null;
}

export interface ThesisTableCluster {
  driver: string;
  pillars: { ticker: string }[];
  rationale: string;
}

export function ThesesTableView({
  data, positions, bookTotal, earnings, notesByTicker, clusters = [], accountEmail, labTags = false,
  inlineReceipts = false,
}: {
  data: ScoringThesisData[];
  positions: ReadonlyMap<string, ThesisTablePosition>;
  bookTotal: number;
  /** Only the capture fixtures pass this, so a marketing capture still renders
   *  its dates on the first paint. The app leaves it unset and the column fetches
   *  after mount instead. */
  earnings?: EarningsByTicker;
  /** Same reason as `earnings`: the capture fixtures have no session to read
   *  /api/thesis/board with, so they render every row body up front. The app
   *  leaves this false and each row loads its own receipts when opened. */
  inlineReceipts?: boolean;
  notesByTicker: ReadonlyMap<string, string | null>;
  clusters?: ThesisTableCluster[] | null;
  accountEmail?: string;
  labTags?: boolean;
}) {
  const rows = data
    .map((d) => ({
      d,
      ceiling: thesisCeiling(d),
      pos: positions.get(d.ticker) ?? null,
      t: tally(d),
    }))
    .sort((a, b) => RANK[a.ceiling] - RANK[b.ceiling] || (b.pos?.value ?? 0) - (a.pos?.value ?? 0));

  /* ── Summary band numbers ── */
  const trackedValue = rows.reduce((s, r) => s + (r.pos?.value ?? 0), 0);
  const pressuredRows = rows.filter((r) => r.ceiling !== 'watch');
  const pressuredValue = pressuredRows.reduce((s, r) => s + (r.pos?.value ?? 0), 0);
  const receipts7d = rows.reduce(
    (s, r) => s + r.d.pillars.flatMap((p) => p.catches).filter((c) => isFresh(c.dateISO)).length,
    0,
  );
  const rowTickers = rows.map((r) => r.d.ticker);

  return (
    <EarningsProvider tickers={rowTickers} initial={earnings}>
      <div className="helm-thesis-board">
        <div className="helm-thesis-heading flex items-baseline gap-3 flex-wrap">
          <h1 className="text-[28px] font-bold tracking-tight text-[var(--color-text-primary)] m-0">Your investment theses.</h1>
          {labTags && (
            <span className="ml-auto text-[11.5px] text-[var(--color-text-secondary)]" style={MONO}>v3.2 proposal · terminal table</span>
          )}
        </div>

        <p className="helm-thesis-intro">The reasons you own each position, tested against the evidence. Open a row to inspect what changed.</p>
        {/* ── Summary band: the book, in dollars ── */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-px rounded-lg overflow-hidden border border-white/[0.08] bg-white/[0.04]">
          {[
            {
              label: 'Under thesis coverage',
              value: money(trackedValue),
              sub: `${rows.length} ${rows.length === 1 ? 'thesis' : 'theses'}${bookTotal > 0 ? ` · ${((trackedValue / bookTotal) * 100).toFixed(0)}% of your book` : ''}`,
              tone: 'var(--color-text-primary)',
            },
            {
              label: 'Under pressure',
              value: pressuredRows.length > 0 ? money(pressuredValue) : '$0',
              sub:
                pressuredRows.length > 0
                  ? `${pressuredRows.length} ${pressuredRows.length === 1 ? 'position' : 'positions'} · ${pressuredRows.map((r) => r.d.ticker).join(' · ')}`
                  : 'nothing needs your attention',
              tone: pressuredRows.length > 0 ? '#E6B94D' : '#4ADE80',
            },
            {
              label: 'Receipts this week',
              value: String(receipts7d),
              sub: 'evidence read, judged and filed',
              tone: 'var(--color-text-primary)',
            },
            {
              label: 'Next earnings',
              value: <NextEarningsTicker tickers={rowTickers} />,
              sub: <NextEarningsDate tickers={rowTickers} />,
              tone: 'var(--color-text-primary)',
            },
          ].map((s) => (
            <div key={s.label} className="bg-[var(--color-bg-base)] px-4 py-3.5">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]" style={MONO}>
                {s.label}
              </div>
              <div className="mt-1 text-[22px] font-bold leading-none" style={{ ...MONO, color: s.tone }}>
                {s.value}
              </div>
              <div className="mt-1 text-[11.5px] text-[var(--color-text-secondary)] truncate" style={MONO}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Shared forces: cross-thesis drivers, absorbed from the overview
               (council verdict 2026-07-27). Server-rendered chips; rationale one
               click down; only shown when a driver links 2+ theses on screen. ── */}
        {(() => {
          const statusOfTicker = new Map(rows.map((r) => [r.d.ticker, r.ceiling]));
          const forces = (((clusters) ?? [])
            .map((c) => ({
              name: c.driver,
              rationale: c.rationale,
              tickers: [...new Set((c.pillars ?? []).map((p) => p.ticker.toUpperCase()))].filter((t) =>
                statusOfTicker.has(t),
              ),
            }))
            .filter((c) => c.tickers.length >= 2)
            .map((c) => ({
              ...c,
              tone: c.tickers.reduce<LadderStatus>(
                (worst, t) => (RANK[statusOfTicker.get(t) ?? 'watch'] < RANK[worst] ? (statusOfTicker.get(t) ?? 'watch') : worst),
                'watch',
              ),
            })));
          if (forces.length === 0) return null;
          return (
            <div className="mt-4">
              <div className="flex items-baseline gap-2">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]" style={MONO}>
                  Shared forces
                </span>
                <span className="text-[12px] text-[var(--color-text-secondary)]">several theses hang on the same driver</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {forces.map((f) => (
                  <details key={f.name} className="rounded-lg border border-white/[0.08] bg-[var(--color-bg-base)]">
                    <summary className="list-none cursor-pointer px-3 py-2 hover:bg-white/[0.02] flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_TONE[f.tone] }} />
                      <span className="text-[13.5px] font-semibold text-[var(--color-text-primary)]">{f.name}</span>
                      <span className="text-[11.5px] text-[var(--color-text-secondary)]" style={MONO}>{f.tickers.join(' · ')}</span>
                    </summary>
                    <p className="px-3 pb-2.5 text-[12.5px] leading-[1.5] text-[var(--color-text-secondary)] max-w-[520px] m-0">{f.rationale}</p>
                  </details>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── The table ── */}
        <div className="helm-thesis-table mt-4 rounded-lg border border-white/[0.08] bg-[var(--color-bg-base)]" role="region" aria-label="Investment theses and evidence" tabIndex={0}>
          <div className="flex items-center gap-3 px-4 py-2 border-b border-white/[0.06] text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]" style={MONO}>
            <span className="w-[64px] shrink-0">Ticker</span>
            <span className="w-[110px] shrink-0 text-right">Position · P/L</span>
            <span className="w-[118px] shrink-0">Status</span>
            <span className="w-[76px] shrink-0 text-right">For / Against</span>
            <span className="flex-1 min-w-0">What matters right now</span>
            <span className="w-[64px] shrink-0 text-right">Earnings</span>
          </div>

          {rows.map(({ d, ceiling, pos, t }) => {
            const statement = notesByTicker.get(d.ticker);
            const hasFresh = d.pillars.some((p) => p.mechanisms.some((m) => m.lastSeen && isFresh(m.lastSeen) && m.maxStatus !== 'watch'));
            return (
              <details key={d.ticker} className="group border-b border-white/[0.05] last:border-b-0">
                <summary className="list-none cursor-pointer flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                  <span className="w-[64px] shrink-0 flex items-center gap-1.5">
                    <span className="text-[15.5px] font-semibold text-[var(--color-text-primary)]" style={MONO}>{d.ticker}</span>
                    {hasFresh && <span className="w-1 h-1 rounded-full bg-[#E6B94D]" title="new evidence this week" />}
                  </span>
                  <span className="w-[110px] shrink-0 text-right">
                    {pos ? (
                      <>
                        <span className="block text-[13.5px] text-[var(--color-text-primary)] leading-tight" style={MONO}>{money(pos.value)}</span>
                        {pos.pl != null && (
                          <span className="block text-[11.5px] leading-tight" style={{ ...MONO, color: pos.pl >= 0 ? '#4ADE80' : '#F87171' }}>
                            {pos.pl >= 0 ? '+' : ''}{money(pos.pl).replace('$-', '-$')}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-[11.5px] text-[var(--color-text-secondary)]" style={MONO}>not held</span>
                    )}
                  </span>
                  <span className="w-[118px] shrink-0 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_TONE[ceiling] }} />
                    <span className="text-[12.5px] font-semibold" style={{ ...MONO, color: STATUS_TONE[ceiling] }}>
                      {STATUS_WORD[ceiling]}
                    </span>
                  </span>
                  <span className="w-[76px] shrink-0 text-right text-[12.5px]" style={MONO}>
                    <span className="text-[#4ADE80]">{t.supports}</span>
                    <span className="text-[var(--color-text-secondary)]"> / </span>
                    <span className={t.against > 0 ? 'text-[#F87171]' : 'text-[var(--color-text-secondary)]'}>{t.against}</span>
                  </span>
                  <span className="flex-1 min-w-0 truncate text-[14px] text-[var(--color-text-secondary)]">{headline(d)}</span>
                  <span className="w-[64px] shrink-0 text-right text-[11.5px] text-[var(--color-text-secondary)]" style={MONO}>
                    <EarningsCell ticker={d.ticker} />
                  </span>
                </summary>

                <div className="px-4 pb-3 pl-[76px] bg-[var(--color-bg-inset)]">
                  {/* the thesis, in the user's own words when they wrote them */}
                  {statement && (
                    <p className="pt-2.5 text-[13.5px] leading-[1.55] text-[var(--color-text-secondary)] italic m-0">&ldquo;{statement}&rdquo;</p>
                  )}
                  {d.pillars.length === 0 && (
                    <p className="pt-2.5 text-[13px] text-[var(--color-text-secondary)] m-0">
                      No evidence filed yet. Helm scans this thesis daily and the first receipts land here.
                    </p>
                  )}
                  {d.pillars.length > 0 &&
                    (inlineReceipts ? (
                      pillarsInOrder(d).map((p) => <PillarLine key={p.key} p={pillarReceipts(p)} />)
                    ) : (
                      <ThesisRowReceipts ticker={d.ticker} pillarCount={d.pillars.length} />
                    ))}
                  <div className="pt-2.5 border-t border-white/[0.04] flex items-center gap-4">
                    <a href="/dashboard/theses/classic" className="text-[12px] text-[#E6B94D] hover:brightness-110" style={MONO}>
                      full history & evidence →
                    </a>
                    <span className="ml-auto text-[11px] text-[var(--color-text-secondary)]" style={MONO}>
                      {d.dedupedRows} receipts on file · last scan {d.lastScan ? d.lastScan.slice(0, 10) : 'never'}
                    </span>
                  </div>
                </div>
              </details>
            );
          })}

          {rows.length === 0 && (
            <p className="px-4 py-6 text-[14.5px] text-[var(--color-text-secondary)] m-0">No theses with scored evidence on this account.</p>
          )}
        </div>

        <p className="mt-3 text-[12px] leading-[1.6] text-[var(--color-text-secondary)] m-0" style={MONO}>
          {labTags ? `${accountEmail} · ` : ''}every status derives from cited evidence; open a row for the receipts.
        </p>
      </div>
    </EarningsProvider>
  );
}
