'use client';

// The overview: the synthesis view (2026-07-26). One screen that keeps the
// table's density and dollars, the cards' narrative and status color, the
// standings' trouble-first ranking, and the connection map tamed into a
// "shared forces" band — the drivers several theses hang on, as clickable
// chips that light up the theses they touch. No graph clutter; the connection
// IS the interaction.

import { useState } from 'react';
import {
  STATUS_WORD,
  STATUS_TONE,
  money,
  type OverviewRow,
  type OverviewDriver,
  type OverviewPillar,
  type OverviewStory,
} from '@/lib/content/thesis-view';

const MONO = { fontFamily: 'var(--font-mono)' } as const;

function Story({ s }: { s: OverviewStory }) {
  return (
    <details>
      <summary className="list-none cursor-pointer flex items-baseline gap-2 py-1 hover:bg-white/[0.02] rounded px-1 -mx-1">
        <span className="mt-[1px] w-1 h-1 rounded-full shrink-0" style={{ background: s.adverse ? '#E6B94D' : '#3F3F3F' }} />
        <span className={`text-[13.5px] leading-[1.45] min-w-0 truncate ${s.adverse ? 'text-[#C8C8C8]' : 'text-[#8A8A8A]'}`}>
          {s.label}
        </span>
        {s.fresh && (
          <span className="shrink-0 text-[9.5px] font-bold uppercase tracking-[0.14em] px-1 py-[1px] rounded bg-[rgba(230,185,77,0.15)] text-[#E6B94D]" style={MONO}>
            new
          </span>
        )}
        <span className="ml-auto shrink-0 text-[11.5px] text-[#5F5F5F]" style={MONO}>
          {s.mentions} {s.mentions === 1 ? 'report' : 'reports'} · {s.classes >= 2 ? `${s.classes} independent source types` : 'single source'}
        </span>
      </summary>
      <div className="ml-3 pb-1.5 space-y-1">
        {s.receipts.map((r, i) => (
          <div key={i} className="text-[12.5px] leading-[1.5] text-[#6A6A6A]">
            <span style={MONO} className="text-[11px] text-[#5F5F5F]">{r.date} · </span>
            {r.url ? (
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:text-[#E6B94D] transition-colors">
                {r.title}
              </a>
            ) : (
              r.title
            )}
            {r.quote && <span className="block text-[12px] text-[#5F5F5F] italic mt-0.5">&ldquo;{r.quote}&rdquo;</span>}
          </div>
        ))}
        {s.more > 0 && <div className="text-[11.5px] text-[#5F5F5F]" style={MONO}>+{s.more} more reports</div>}
      </div>
    </details>
  );
}

function Pillar({ p }: { p: OverviewPillar }) {
  return (
    <div className="py-2.5 border-t border-white/[0.04] first:border-t-0">
      <div className="flex items-baseline gap-2.5">
        <span className="mt-[1px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATUS_TONE[p.status] }} />
        <span className="text-[14.5px] leading-[1.45] text-[#DADADA] min-w-0">{p.claim}</span>
      </div>
      <div className="ml-4 mt-0.5 text-[12.5px] text-[#7A7A7A]">{p.line}</div>
      {p.breaksIf && (
        <div className="ml-4 mt-1 text-[12.5px] leading-[1.5] text-[#8A8A8A]">
          <span className="text-[#E6B94D] uppercase tracking-[0.08em] text-[10.5px] font-semibold" style={MONO}>Breaks if </span>
          {p.breaksIf}
        </div>
      )}
      {p.stories.length > 0 && (
        <div className="ml-4 mt-1.5">
          {p.stories.map((s, i) => (
            <Story key={i} s={s} />
          ))}
          {p.singles > 0 && (
            <div className="text-[11.5px] text-[#4A4A4A] py-1" style={MONO}>
              +{p.singles} single mentions nothing has confirmed
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ThesesOverview({
  rows,
  drivers,
  band,
}: {
  rows: OverviewRow[];
  drivers: OverviewDriver[];
  band: { label: string; value: string; sub: string; tone: string }[];
}) {
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const active = drivers.find((d) => d.name === selectedDriver) ?? null;
  const litTickers = active ? new Set(active.tickers) : null;

  return (
    <div>
      {/* summary band */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-lg overflow-hidden border border-white/[0.08] bg-white/[0.04]">
        {band.map((s) => (
          <div key={s.label} className="bg-[#0A0A0A] px-4 py-3.5">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#5F5F5F]" style={MONO}>{s.label}</div>
            <div className="mt-1 text-[22px] font-bold leading-none" style={{ ...MONO, color: s.tone }}>{s.value}</div>
            <div className="mt-1 text-[11.5px] text-[#6A6A6A] truncate" style={MONO}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* shared forces — the connection map, tamed */}
      {drivers.length > 0 && (
        <div className="mt-4">
          <div className="flex items-baseline gap-2">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#5F5F5F]" style={MONO}>
              Shared forces
            </span>
            <span className="text-[11.5px] text-[#6A6A6A]">
              several theses hang on the same driver — tap one to see which
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {drivers.map((d) => {
              const sel = d.name === selectedDriver;
              return (
                <button
                  key={d.name}
                  type="button"
                  onClick={() => setSelectedDriver(sel ? null : d.name)}
                  className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                    sel ? 'border-[rgba(230,185,77,0.5)] bg-[rgba(230,185,77,0.07)]' : 'border-white/[0.08] bg-[#0A0A0A] hover:border-white/[0.16]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_TONE[d.tone] }} />
                    <span className="text-[13px] font-semibold text-[#DADADA]">{d.name}</span>
                    <span className="text-[11px] text-[#6A6A6A]" style={MONO}>{d.tickers.join(' · ')}</span>
                  </span>
                  {sel && <span className="block mt-1 text-[12px] leading-[1.5] text-[#8A8A8A] max-w-[480px]">{d.rationale}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* thesis rows: card-row hybrid, trouble first */}
      <div className="mt-4 space-y-2">
        {rows.map((r) => {
          const dim = litTickers ? !litTickers.has(r.ticker) : false;
          return (
            <details
              key={r.ticker}
              className="group rounded-lg border border-white/[0.08] bg-[#0A0A0A] overflow-hidden transition-opacity"
              style={{ borderLeft: `3px solid ${STATUS_TONE[r.status]}`, opacity: dim ? 0.35 : 1 }}
            >
              <summary className="list-none cursor-pointer px-4 py-3 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <span className="text-[16px] font-semibold text-[#FAFAFA]" style={MONO}>{r.ticker}</span>
                    {r.freshEvidence && <span className="w-1 h-1 rounded-full bg-[#E6B94D]" title="new evidence this week" />}
                  </span>
                  <span className="text-[12px] font-semibold" style={{ ...MONO, color: STATUS_TONE[r.status] }}>
                    {STATUS_WORD[r.status]}
                  </span>
                  <span className="text-[12px]" style={MONO}>
                    <span className="text-[#4ADE80]">{r.supports}</span>
                    <span className="text-[#5F5F5F]"> / </span>
                    <span className={r.against > 0 ? 'text-[#F87171]' : 'text-[#5F5F5F]'}>{r.against}</span>
                  </span>
                  {r.drivers.length > 0 && (
                    <span className="flex items-center gap-1">
                      {r.drivers.map((name) => (
                        <span
                          key={name}
                          className={`text-[10px] px-1.5 py-[2px] rounded-full border ${
                            selectedDriver === name
                              ? 'border-[rgba(230,185,77,0.5)] text-[#E6B94D]'
                              : 'border-white/[0.1] text-[#6A6A6A]'
                          }`}
                          style={MONO}
                        >
                          {name}
                        </span>
                      ))}
                    </span>
                  )}
                  <span className="ml-auto text-right">
                    {r.value != null ? (
                      <>
                        <span className="text-[13.5px] text-[#DADADA]" style={MONO}>{money(r.value)}</span>
                        {r.pl != null && (
                          <span className="ml-2 text-[12px]" style={{ ...MONO, color: r.pl >= 0 ? '#4ADE80' : '#F87171' }}>
                            {r.pl >= 0 ? '+' : ''}{money(r.pl).replace('$-', '-$')}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-[11.5px] text-[#5F5F5F]" style={MONO}>not held</span>
                    )}
                    {r.earnings && (
                      <span className="ml-3 text-[11px] text-[#5F5F5F]" style={MONO}>earnings {r.earnings.slice(5)}</span>
                    )}
                  </span>
                </div>
                <p className="mt-1.5 text-[14px] leading-[1.5] text-[#B8B8B8] m-0">
                  {r.status === 'watch' && r.statement ? <em className="text-[#9A9A9A]">&ldquo;{r.statement}&rdquo;</em> : r.headline}
                </p>
              </summary>

              <div className="px-4 pb-3 bg-[#080808] border-t border-white/[0.05]">
                {r.statement && r.status !== 'watch' && (
                  <p className="pt-2.5 text-[13.5px] leading-[1.55] text-[#9A9A9A] italic m-0">&ldquo;{r.statement}&rdquo;</p>
                )}
                {r.pillars.length === 0 && (
                  <p className="pt-2.5 text-[13px] text-[#7A7A7A] m-0">
                    No evidence filed yet — Helm scans this thesis daily and the first receipts land here.
                  </p>
                )}
                {r.pillars.map((p, i) => (
                  <Pillar key={i} p={p} />
                ))}
                <div className="pt-2.5 border-t border-white/[0.04] flex items-center gap-4">
                  <a href="/dashboard/theses/classic" className="text-[12px] text-[#E6B94D] hover:brightness-110" style={MONO}>
                    full history & evidence →
                  </a>
                  <span className="ml-auto text-[11px] text-[#4A4A4A]" style={MONO}>
                    {r.receiptsOnFile} receipts on file · last scan {r.lastScan ?? 'never'}
                  </span>
                </div>
              </div>
            </details>
          );
        })}
      </div>

      <p className="mt-3 text-[12px] leading-[1.6] text-[#5F5F5F] m-0" style={MONO}>
        every status derives from cited evidence; open a row for the receipts.
      </p>
    </div>
  );
}
