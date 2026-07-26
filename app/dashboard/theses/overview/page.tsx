// /dashboard/theses/overview — the synthesis view: table density + card
// narrative + trouble-first ranking + the connection map as a shared-forces
// band. Server-assembled, client-rendered (driver selection lights up rows).

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasThesisAccess } from '@/lib/thesis-access-server';
import { getScoringThesisData } from '@/lib/content/scoring-thesis';
import { getEdgarEarnings } from '@/lib/earnings-edgar';
import {
  RANK,
  headline,
  isFresh,
  money,
  tally,
  thesisCeiling,
  toOverviewPillars,
  type OverviewDriver,
  type OverviewRow,
} from '@/lib/content/thesis-view';
import { ThesesOverview } from '@/components/thesis/theses-overview';

export const metadata = { title: 'Theses · Overview' };
export const dynamic = 'force-dynamic';

const MONO = { fontFamily: 'var(--font-mono)' } as const;
const MAX_THESES = 8;

interface SynthClusterRow {
  driver: string;
  pillars: { ticker: string; claim: string; pillarId: string }[];
  rationale: string;
}

export default async function ThesesOverviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect('/login');
  if (!(await hasThesisAccess(user.id, user.email))) redirect('/dashboard/theses');

  const [{ data: theses }, { data: holdings }, { data: clusterRow }] = await Promise.all([
    supabase.from('theses').select('ticker, tracked, notes').eq('user_id', user.id).order('tracked', { ascending: false }),
    supabase.from('holdings').select('ticker, total_value, unrealised_gain_loss').eq('user_id', user.id),
    supabase.from('thesis_clusters').select('clusters').eq('user_id', user.id).maybeSingle(),
  ]);

  const positions = new Map<string, { value: number; pl: number }>();
  let bookTotal = 0;
  for (const h of holdings ?? []) {
    const t = String(h.ticker).toUpperCase();
    const value = Number(h.total_value ?? 0);
    bookTotal += value;
    const prev = positions.get(t) ?? { value: 0, pl: 0 };
    positions.set(t, { value: prev.value + value, pl: prev.pl + Number(h.unrealised_gain_loss ?? 0) });
  }
  const notesByTicker = new Map(
    (theses ?? []).map((t) => [String(t.ticker).toUpperCase(), (t.notes as string | null) ?? null]),
  );

  const tickers = [...new Set((theses ?? []).map((t) => String(t.ticker).toUpperCase()))].slice(0, MAX_THESES);
  const data = (await Promise.all(tickers.map((t) => getScoringThesisData(t)))).filter((d) => d.pillars.length > 0);

  const earnings = new Map<string, string | null>();
  await Promise.allSettled(
    data.map(async (d) => {
      const e = await getEdgarEarnings(d.ticker);
      earnings.set(d.ticker, e.nextEstimatedDate);
    }),
  );

  // Shared forces: the user's cross-thesis clusters, limited to tickers on
  // screen, needing 2+ present members to count as a connection.
  const clusters = ((clusterRow?.clusters as SynthClusterRow[] | null) ?? []).map((c) => ({
    ...c,
    tickers: [...new Set((c.pillars ?? []).map((p) => p.ticker.toUpperCase()))].filter((t) =>
      data.some((d) => d.ticker === t),
    ),
  }));
  const statusOf = new Map(data.map((d) => [d.ticker, thesisCeiling(d)]));
  const drivers: OverviewDriver[] = clusters
    .filter((c) => c.tickers.length >= 2)
    .map((c) => ({
      name: c.driver,
      rationale: c.rationale,
      tickers: c.tickers,
      tone: c.tickers.reduce<'watch' | 'weakening' | 'broken'>(
        (worst, t) => (RANK[statusOf.get(t) ?? 'watch'] < RANK[worst] ? (statusOf.get(t) ?? 'watch') : worst),
        'watch',
      ),
    }));
  const driversOf = (ticker: string) => drivers.filter((d) => d.tickers.includes(ticker)).map((d) => d.name);

  const rows: OverviewRow[] = data
    .map((d) => {
      const status = thesisCeiling(d);
      const pos = positions.get(d.ticker) ?? null;
      const t = tally(d);
      return {
        ticker: d.ticker,
        status,
        value: pos?.value ?? null,
        pl: pos?.pl ?? null,
        supports: t.supports,
        against: t.against,
        headline: headline(d),
        statement: notesByTicker.get(d.ticker) ?? null,
        earnings: earnings.get(d.ticker) ?? null,
        freshEvidence: d.pillars.some((p) =>
          p.mechanisms.some((m) => m.lastSeen && isFresh(m.lastSeen) && m.maxStatus !== 'watch'),
        ),
        receiptsOnFile: d.dedupedRows,
        lastScan: d.lastScan ? d.lastScan.slice(0, 10) : null,
        pillars: toOverviewPillars(d),
        drivers: driversOf(d.ticker),
      };
    })
    .sort((a, b) => RANK[a.status] - RANK[b.status] || (b.value ?? 0) - (a.value ?? 0));

  const trackedValue = rows.reduce((s, r) => s + (r.value ?? 0), 0);
  const pressured = rows.filter((r) => r.status !== 'watch');
  const pressuredValue = pressured.reduce((s, r) => s + (r.value ?? 0), 0);
  const receipts7d = data.reduce(
    (s, d) => s + d.pillars.flatMap((p) => p.catches).filter((c) => isFresh(c.dateISO)).length,
    0,
  );
  const nextEarnings = rows
    .map((r) => ({ ticker: r.ticker, date: r.earnings }))
    .filter((x): x is { ticker: string; date: string } => !!x.date)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  const band = [
    {
      label: 'Under thesis coverage',
      value: money(trackedValue),
      sub: bookTotal > 0 ? `${((trackedValue / bookTotal) * 100).toFixed(0)}% of your book` : '',
      tone: '#FAFAFA',
    },
    {
      label: 'Under pressure',
      value: pressured.length > 0 ? money(pressuredValue) : '$0',
      sub: pressured.length > 0 ? pressured.map((r) => r.ticker).join(' · ') : 'nothing needs your attention',
      tone: pressured.length > 0 ? '#E6B94D' : '#4ADE80',
    },
    { label: 'Receipts this week', value: String(receipts7d), sub: 'evidence read, judged and filed', tone: '#FAFAFA' },
    {
      label: 'Next earnings',
      value: nextEarnings ? nextEarnings.ticker : '—',
      sub: nextEarnings ? `est. ${nextEarnings.date}` : 'none estimated',
      tone: '#FAFAFA',
    },
  ];

  return (
    <main className="mx-auto px-4 sm:px-7 py-[26px] pb-[60px] max-w-[1240px]">
      <div className="mb-3 flex items-center gap-4">
        <Link
          href="/dashboard/theses"
          className="text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          style={MONO}
        >
          ← classic view
        </Link>
        <Link
          href="/dashboard/theses/table"
          className="text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          style={MONO}
        >
          table view
        </Link>
      </div>
      <div className="mb-4">
        <h1 className="text-[28px] font-bold tracking-tight text-[var(--color-text-primary)] m-0">Theses</h1>
      </div>
      <ThesesOverview rows={rows} drivers={drivers} band={band} />
    </main>
  );
}
