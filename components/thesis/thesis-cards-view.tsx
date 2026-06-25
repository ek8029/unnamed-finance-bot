'use client';

// Cards view for /dashboard/theses. True cross-position: shared-driver clusters
// (from /api/thesis/synthesis) render as one "idea" card spanning its positions
// (driver title, member ticker chips, aggregate P/L + conviction). Theses not in
// any 2+ cluster render as single standalone cards. Trimmed, scannable.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { PillarStatus } from '@/lib/thesis-palette';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

export interface CardThesis {
  thesisId: string;
  ticker: string;
  name?: string;
  status: PillarStatus | null; // worst pillar status
  intact: number;
  total: number;
  statement: string; // lead reason
  pl: number | null; // unrealised gain/loss, dollars
}

interface Cluster {
  driver: string;
  pillars: { ticker: string }[];
  rationale: string;
}

function statusColor(s: PillarStatus | null): string {
  if (s === 'broken') return '#F87171';
  if (s === 'weakening') return '#E6B94D';
  return '#4ADE80';
}

function worstOf(list: (PillarStatus | null)[]): PillarStatus | null {
  if (list.includes('broken')) return 'broken';
  if (list.includes('weakening')) return 'weakening';
  if (list.includes('intact')) return 'intact';
  return list[0] ?? null;
}

function fmtPL(n: number | null): { text: string; color: string } | null {
  if (n == null || !Number.isFinite(n)) return null;
  const abs = Math.abs(Math.round(n));
  return {
    text: `${n >= 0 ? '+' : '−'}$${abs.toLocaleString()}`,
    color: n >= 0 ? 'var(--color-positive)' : 'var(--color-negative-text)',
  };
}

function Dot({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
      style={{ background: color, boxShadow: `0 0 7px ${color}66` }}
    />
  );
}

const CARD_STYLE = (color: string, broken: boolean): React.CSSProperties => ({
  border: '1px solid var(--color-border-base)',
  borderLeft: `2px solid ${color}`,
  background: 'var(--color-bg-surface)',
  boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
  opacity: broken ? 0.78 : 1,
});

function ClusterCard({ driver, rationale, members }: { driver: string; rationale?: string; members: CardThesis[] }) {
  const [open, setOpen] = useState(false);
  const worst = worstOf(members.map((m) => m.status));
  const color = statusColor(worst);
  const pl = fmtPL(members.reduce((s, m) => s + (m.pl ?? 0), 0));
  const intact = members.reduce((s, m) => s + m.intact, 0);
  const total = members.reduce((s, m) => s + m.total, 0);
  const conv = total > 0 ? Math.round((intact / total) * 100) : null;

  return (
    <div className="rounded-lg" style={CARD_STYLE(color, worst === 'broken')}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full p-4 text-left sm:p-[18px]">
        <div className="mb-2 flex items-start gap-2.5">
          <span className="mt-[5px]">
            <Dot color={color} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[15.5px] font-semibold leading-snug text-[#FAFAFA]">{driver}</div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#6A6A6A]" style={MONO}>
              Shared driver · {members.length} positions
            </div>
          </div>
          {pl && (
            <span className="shrink-0 font-mono text-[13px] font-semibold" style={{ ...MONO, color: pl.color }}>
              {pl.text}
            </span>
          )}
        </div>
        {rationale && (
          <p className="m-0 mb-3 line-clamp-2 text-[13px] leading-[1.55] text-[var(--color-text-secondary)]">{rationale}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
          {members.map((m) => (
            <span
              key={m.thesisId}
              className="rounded px-2 py-[3px] font-mono text-[11px] font-bold text-[var(--color-gold)]"
              style={{ ...MONO, background: 'rgba(230,185,77,0.06)' }}
            >
              {m.ticker}
            </span>
          ))}
          {conv != null && (
            <span className="font-mono text-[10.5px] text-[#7A7A7A]" style={MONO}>
              {conv}% conviction
            </span>
          )}
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.1em] text-[#7A7A7A]" style={MONO}>
            {open ? 'Hide' : 'Positions'} {open ? '▴' : '▾'}
          </span>
        </div>
      </button>
      {open && (
        <div className="border-t border-white/[0.06] px-4 sm:px-[18px]">
          {members.map((m) => {
            const mpl = fmtPL(m.pl);
            return (
              <Link
                key={m.thesisId}
                href={`/dashboard/theses/${m.thesisId}`}
                className="flex items-center gap-2.5 border-b border-white/[0.04] py-2.5 no-underline last:border-0"
              >
                <Dot color={statusColor(m.status)} />
                <span className="w-[54px] shrink-0 font-mono text-[12.5px] font-bold uppercase tracking-[0.05em] text-[#FAFAFA]" style={MONO}>
                  {m.ticker}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-[#B8B8B8]">{m.statement}</span>
                {mpl && (
                  <span className="shrink-0 font-mono text-[12px] font-semibold" style={{ ...MONO, color: mpl.color }}>
                    {mpl.text}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StandaloneCard({ t }: { t: CardThesis }) {
  const color = statusColor(t.status);
  const pl = fmtPL(t.pl);
  return (
    <Link
      href={`/dashboard/theses/${t.thesisId}`}
      className="block rounded-lg p-4 no-underline transition-colors hover:border-[rgba(230,185,77,0.28)] sm:p-[18px]"
      style={CARD_STYLE(color, t.status === 'broken')}
    >
      <div className="mb-2 flex items-center gap-2.5">
        <Dot color={color} />
        <span className="font-mono text-[13px] font-bold uppercase tracking-[0.06em] text-[#FAFAFA]" style={MONO}>
          {t.ticker}
        </span>
        {t.name && t.name !== t.ticker && (
          <span className="min-w-0 flex-1 truncate text-[12.5px] text-[#6A6A6A]">{t.name}</span>
        )}
        {pl && (
          <span className="ml-auto shrink-0 font-mono text-[13px] font-semibold" style={{ ...MONO, color: pl.color }}>
            {pl.text}
          </span>
        )}
      </div>
      <div className="mb-2 line-clamp-2 text-[14.5px] leading-snug text-[#E8E8E8]">{t.statement}</div>
      {t.total > 0 && (
        <span className="font-mono text-[10.5px] text-[#7A7A7A]" style={MONO}>
          Conviction {t.intact}/{t.total}
        </span>
      )}
    </Link>
  );
}

export function ThesisCardsView({ theses }: { theses: CardThesis[] }) {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    fetch('/api/thesis/synthesis')
      .then((r) => (r.ok ? r.json() : { clusters: [] }))
      .then((d: { clusters?: Cluster[] }) => {
        if (mounted.current) setClusters(Array.isArray(d.clusters) ? d.clusters : []);
      })
      .catch(() => {});
    return () => {
      mounted.current = false;
    };
  }, []);

  const byTicker = new Map(theses.map((t) => [t.ticker.toUpperCase(), t]));

  // A cross-position card needs 2+ of the user's theses sharing a driver.
  const clusterCards = clusters
    .map((c) => {
      const tks = [...new Set(c.pillars.map((p) => p.ticker.toUpperCase()))];
      const members = tks.map((tk) => byTicker.get(tk)).filter((m): m is CardThesis => !!m);
      return { driver: c.driver, rationale: c.rationale, members };
    })
    .filter((c) => c.members.length >= 2);

  const inCluster = new Set(clusterCards.flatMap((c) => c.members.map((m) => m.thesisId)));
  const standalones = theses.filter((t) => !inCluster.has(t.thesisId));

  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
      {clusterCards.map((c, i) => (
        <ClusterCard key={`cluster-${i}`} driver={c.driver} rationale={c.rationale} members={c.members} />
      ))}
      {standalones.map((t) => (
        <StandaloneCard key={t.thesisId} t={t} />
      ))}
    </div>
  );
}
