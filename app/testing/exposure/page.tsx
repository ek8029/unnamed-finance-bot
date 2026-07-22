// /testing/exposure — True Exposure, before vs after today's fixes, on a real book.
//
// Dev only (404s in production). Reads live holdings through the service client
// so the comparison reflects what the user would actually have seen.
//
// BEFORE reproduces the two defects together:
//   1. the 10% concentration filter that hid direct positions
//   2. HYNX and AMAU missing from SINGLE_STOCK_MAP, so leveraged positions sat
//      as their own line instead of decomposing to the underlying
// AFTER is the current shipped logic.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createStaticServiceClient } from '@/lib/supabase/server';
import { computePortfolioLookthrough, SINGLE_STOCK_MAP, LEVERAGED_ETF_MAP, ETF_HOLDINGS } from '@/lib/etf-holdings';

export const metadata = { title: 'Exposure before/after', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const MONO = { fontFamily: 'var(--font-mono)' } as const;
const OLD_THRESHOLD = 10;               // CONCENTRATION_THRESHOLDS.medium
const ADDED_TODAY = new Set(['HYNX', 'AMAU']);   // were unmapped before the fix

type Row = { ticker: string; directWeight: number; indirectWeight: number; totalWeight: number; sources: string[] };

/** Reproduces the pre-fix behaviour: HYNX/AMAU unmapped, then the 10% filter. */
function computeBefore(holdings: { ticker: string; totalValue: number }[], total: number): Row[] {
  const map = new Map<string, Row>();
  const add = (t: string, direct: number, indirect: number, source: string) => {
    const cur = map.get(t) ?? { ticker: t, directWeight: 0, indirectWeight: 0, totalWeight: 0, sources: [] };
    cur.directWeight += direct;
    cur.indirectWeight += indirect;
    cur.totalWeight = cur.directWeight + cur.indirectWeight;
    if (!cur.sources.includes(source)) cur.sources.push(source);
    map.set(t, cur);
  };

  for (const h of holdings) {
    const t = h.ticker.toUpperCase();
    const alloc = total > 0 ? (h.totalValue / total) * 100 : 0;

    // The two tickers we added today were simply absent from the map before.
    if (!ADDED_TODAY.has(t) && t in SINGLE_STOCK_MAP) {
      const p = SINGLE_STOCK_MAP[t];
      add(p.underlying, 0, alloc * Math.abs(p.leverage), t);
    } else if (t in LEVERAGED_ETF_MAP) {
      const p = LEVERAGED_ETF_MAP[t];
      for (const c of ETF_HOLDINGS[p.underlying] ?? []) {
        add(c.ticker, 0, (alloc * c.weight / 100) * Math.abs(p.leverage), `${t} (${p.leverage}x)`);
      }
    } else if (t in ETF_HOLDINGS) {
      for (const c of ETF_HOLDINGS[t]) add(c.ticker, 0, alloc * c.weight / 100, t);
    } else {
      add(t, alloc, 0, 'Direct');
    }
  }

  return [...map.values()]
    .filter((e) => e.indirectWeight > 0 || e.totalWeight > OLD_THRESHOLD)   // the bug
    .sort((a, b) => b.totalWeight - a.totalWeight);
}

export default async function ExposureBeforeAfter({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();

  // No default account. This repository is public, so a real user's address must
  // never be a literal here, however convenient the shortcut is locally.
  const { email } = await searchParams;
  const target = email?.trim();
  if (!target) {
    return (
      <div className="min-h-dvh bg-[#060606] p-10 text-[#FAFAFA]">
        <p className="text-[14px] m-0">
          Pass an account to compare, e.g. <span style={MONO}>/testing/exposure?email=someone@example.com</span>
        </p>
      </div>
    );
  }

  const db = createStaticServiceClient();
  const { data: profile } = await db.from('user_profiles').select('id, email').eq('email', target).maybeSingle();
  if (!profile) {
    return <div className="min-h-dvh bg-[#060606] p-10 text-[#FAFAFA]">No user found for {target}</div>;
  }

  const { data: holdings } = await db.from('holdings').select('ticker, total_value').eq('user_id', profile.id);
  const rows = (holdings ?? []).map((h) => ({ ticker: String(h.ticker), totalValue: Number(h.total_value ?? 0) }));
  const total = rows.reduce((s, r) => s + r.totalValue, 0);

  const before = computeBefore(rows, total);
  const after = [...computePortfolioLookthrough(rows, total).entries()]
    .map(([ticker, d]) => ({ ticker, ...d }))
    .sort((a, b) => b.totalWeight - a.totalWeight) as Row[];

  const beforeSet = new Set(before.map((r) => r.ticker));
  const newlyVisible = after.filter((r) => !beforeSet.has(r.ticker));

  const Table = ({ title, data, sub }: { title: string; data: Row[]; sub: string }) => (
    <div className="flex-1 min-w-0">
      <div className="text-[13px] font-semibold text-[#FAFAFA]">{title}</div>
      <div className="text-[11px] text-[#7A7A7A] mb-2" style={MONO}>{sub}</div>
      <div className="rounded-md border border-white/[0.08] overflow-hidden">
        {data.map((r) => {
          const isNew = !beforeSet.has(r.ticker);
          return (
            <div key={r.ticker}
              className={`flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.04] text-[12px] ${isNew && title.startsWith('After') ? 'bg-[rgba(74,222,128,0.07)]' : ''}`}>
              <span className="w-[74px] shrink-0 text-[#FAFAFA]" style={MONO}>{r.ticker}</span>
              <span className="w-[58px] text-right text-[#9A9A9A]" style={MONO}>{r.totalWeight.toFixed(2)}%</span>
              <span className="flex-1 min-w-0 truncate text-[10.5px] text-[#6A6A6A]" style={MONO}>
                {r.sources.join(', ')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-[#060606] px-5 py-10">
      <div className="max-w-4xl mx-auto">
        <Link href="/testing" className="text-[12px] text-[#6A6A6A] hover:text-[#FAFAFA]" style={MONO}>← Testing</Link>
        <h1 className="mt-4 text-[26px] font-bold text-[#FAFAFA]">True Exposure, before vs after</h1>
        <p className="mt-2 text-[13px] text-[#8A8A8A]">
          {profile.email} · {rows.length} holdings · ${Math.round(total).toLocaleString()}
        </p>

        <div className="mt-4 rounded-md border border-[rgba(230,185,77,0.25)] bg-[rgba(230,185,77,0.05)] px-4 py-3 text-[12.5px] leading-relaxed text-[#C8C8C8]">
          <strong>{before.length} rows</strong> shown before, <strong>{after.length}</strong> after.
          {newlyVisible.length > 0 && <> {newlyVisible.length} positions were previously hidden: <span style={MONO}>{newlyVisible.map((r) => r.ticker).join(', ')}</span>.</>}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-6">
          <Table title="Before" data={before} sub={`10% filter, HYNX/AMAU unmapped`} />
          <Table title="After (shipped)" data={after} sub={`all positions, HYNX/AMAU decomposed`} />
        </div>
      </div>
    </div>
  );
}
