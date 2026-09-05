// Dev-only data route for the agent-presence lab (/testing/app/presence,
// /ledger, /live-read). Takes an account email, resolves it with the service
// client (same pattern as /api/testing/research), and returns the numbers the
// three screens draw: the book, when it was priced, what the crons did, what
// is ahead, the harvestable figure, house coverage, the sources read, the flags.
//
// `?part=` returns one slice with its real server time in ms, so the Live Read
// screen can print each line when its work actually finishes. No part = all.
//
// 404s in production: it reads arbitrary accounts by design.

import { NextRequest, NextResponse } from 'next/server';
import { createStaticServiceClient } from '@/lib/supabase/server';
import { buildWorklog, type WorklogResponse } from '@/lib/agent/worklog';
import { getPortfolioBrief } from '@/lib/research/account';
import { generateTaxReport } from '@/lib/tax-analysis';
import { getTickerThesisData } from '@/lib/content/public-thesis';

export const dynamic = 'force-dynamic';

export type PresencePart =
  | 'book' | 'run' | 'concentration' | 'earnings' | 'tax' | 'coverage' | 'sources' | 'theses' | 'worklog' | 'digest' | 'flags';

export interface PresenceHolding { ticker: string; pct: number; value: number; dayChangePct: number | null; sector: string | null }
export interface PresenceBook {
  positions: number;
  names: number;
  accounts: { name: string; lastSyncedAt: string | null }[];
  totalValue: number;
  /** Weighted day move across the positions that have a price feed. Null when none do. */
  dayChangePct: number | null;
  dayChangeValue: number | null;
  pricedPositions: number;
  top: PresenceHolding[];
  movers: PresenceHolding[];
  sectors: { sector: string; pct: number }[];
}
export interface PresenceRun { pricedAt: string | null; lastRunAt: string | null; nextRunAt: string }
export interface PresenceEarning { ticker: string; date: string; pct: number }
export interface PresenceTax {
  harvestable: number;
  opportunityCount: number;
  positions: number;
  top: { ticker: string; loss: number; account: string | null }[];
  disclaimer: string | null;
}
export interface PresenceSource {
  title: string; type: string; ticker: string | null; verdict: string; materiality: string; at: string; url: string | null;
}
export interface PresencePillar { ticker: string; claim: string; status: string; breaksIf: string | null; changedAt: string | null }
export interface PresenceFlag { id: string; title: string; kind: string; priority: string; at: string; detail: string | null; impact: number | null }

export interface PresenceData {
  email: string;
  book: PresenceBook;
  run: PresenceRun;
  concentration: { ticker: string; pct: number } | null;
  earnings: PresenceEarning[];
  tax: PresenceTax | null;
  coverage: { covered: string[]; uncovered: string[] };
  sources: { filings: number; news: number; priceMoves: number; contradicts: number; items: PresenceSource[] };
  theses: { tracked: number; pillars: PresencePillar[] };
  flags: { scansRanAt: string | null; items: PresenceFlag[] };
  worklog: WorklogResponse;
  digest: string | null;
  ms: Partial<Record<PresencePart, number>>;
}

const CRON_UTC_HOUR = 13;
const CRON_UTC_MIN = 15;

function nextRunAt(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), CRON_UTC_HOUR, CRON_UTC_MIN));
  if (d.getTime() <= now.getTime()) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

async function resolveUserId(email: string): Promise<string | null> {
  const db = createStaticServiceClient();
  const { data } = await db.from('user_profiles').select('id').eq('email', email).maybeSingle();
  return data ? String(data.id) : null;
}

type Db = ReturnType<typeof createStaticServiceClient>;

async function partBook(db: Db, uid: string): Promise<PresenceBook> {
  const [brief, accts] = await Promise.all([
    getPortfolioBrief(db, uid),
    db.from('linked_accounts').select('account_name, last_synced_at').eq('user_id', uid).eq('is_active', true),
  ]);
  const holdings = brief?.holdings ?? [];
  const toH = (h: (typeof holdings)[number]): PresenceHolding => ({ ticker: h.ticker, pct: h.pct, value: h.value, dayChangePct: h.dayChangePct, sector: h.sector });
  // Day change from the positions that carry a price feed. prev = value / (1 + pct).
  let prevSum = 0, changeSum = 0, priced = 0;
  for (const h of holdings) {
    if (h.dayChangePct === null || !isFinite(h.dayChangePct)) continue;
    const prev = h.value / (1 + h.dayChangePct / 100);
    if (!isFinite(prev) || prev <= 0) continue;
    prevSum += prev; changeSum += h.value - prev; priced++;
  }
  // Movers by contribution to the day (weight x move), not by raw move: a 0.1% position up 10% is noise.
  const contrib = (h: (typeof holdings)[number]) => Math.abs(h.dayChangePct ?? 0) * h.pct;
  const movers = holdings.filter((h) => h.dayChangePct !== null).sort((a, b) => contrib(b) - contrib(a)).slice(0, 4).map(toH);
  // The brief's sector shares are of NET value, so a negative sector (shorts, a negative cash row)
  // pushes the long sectors past 100 between them. Show shares of long value instead.
  const rawSectors = (brief?.sectorAllocation ?? []).filter((s) => s.pct > 0);
  const sectorTotal = rawSectors.reduce((a, s) => a + s.pct, 0) || 1;
  const sectors = rawSectors.map((s) => ({ sector: s.sector, pct: (s.pct / sectorTotal) * 100 })).slice(0, 6);
  return {
    positions: brief?.positionCount ?? 0,
    names: new Set(holdings.map((h) => h.ticker)).size,
    accounts: (accts.data ?? []).map((a) => ({ name: String(a.account_name ?? 'Account'), lastSyncedAt: (a.last_synced_at as string | null) ?? null })),
    totalValue: brief?.totalValue ?? 0,
    dayChangePct: priced > 0 && prevSum > 0 ? (changeSum / prevSum) * 100 : null,
    dayChangeValue: priced > 0 ? changeSum : null,
    pricedPositions: priced,
    top: holdings.slice(0, 8).map(toH),
    movers,
    sectors,
  };
}

async function partRun(db: Db, uid: string): Promise<PresenceRun> {
  const [perf, digest] = await Promise.all([
    db.from('portfolio_performance').select('calculated_at').eq('user_id', uid).order('calculated_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('brief_digests').select('generated_at').eq('user_id', uid).maybeSingle(),
  ]);
  return {
    pricedAt: (perf.data?.calculated_at as string | null) ?? null,
    lastRunAt: (digest.data?.generated_at as string | null) ?? null,
    nextRunAt: nextRunAt(),
  };
}

async function partConcentration(db: Db, uid: string) {
  const brief = await getPortfolioBrief(db, uid);
  const top = brief?.holdings?.[0];
  return top ? { ticker: top.ticker, pct: top.pct } : null;
}

async function partEarnings(db: Db, uid: string): Promise<PresenceEarning[]> {
  const brief = await getPortfolioBrief(db, uid);
  const holdings = brief?.holdings ?? [];
  if (holdings.length === 0) return [];
  const tickers = [...new Set(holdings.map((h) => h.ticker))];
  const start = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const { data } = await db
    .from('market_events').select('ticker, event_date')
    .eq('event_type', 'earnings').in('ticker', tickers).gte('event_date', start).lte('event_date', end)
    .order('event_date');
  const pct = new Map(holdings.map((h) => [h.ticker, h.pct]));
  const seen = new Set<string>();
  const out: PresenceEarning[] = [];
  for (const e of data ?? []) {
    const t = String(e.ticker);
    if (seen.has(t)) continue;
    seen.add(t);
    out.push({ ticker: t, date: String(e.event_date), pct: pct.get(t) ?? 0 });
  }
  return out;
}

async function partTax(uid: string, positions: number): Promise<PresenceTax | null> {
  if (positions === 0) return null;
  const report = await generateTaxReport(uid);
  return {
    harvestable: Math.abs(report.totalHarvestableLoss),
    opportunityCount: report.opportunityCount,
    positions,
    top: report.opportunities.slice(0, 3).map((o) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = o as any;
      return {
        ticker: String(r.ticker ?? ''),
        loss: Math.abs(Number(r.unrealizedLoss ?? r.unrealizedGainLoss ?? r.loss ?? 0)),
        account: (r.accountName ?? r.account_name ?? null) as string | null,
      };
    }),
    disclaimer: report.disclaimer ?? null,
  };
}

async function partCoverage(db: Db, uid: string) {
  const brief = await getPortfolioBrief(db, uid);
  const tickers = [...new Set((brief?.holdings ?? []).map((h) => h.ticker))].slice(0, 40);
  const hits = await Promise.all(tickers.map(async (t) => [t, (await getTickerThesisData(t)) !== null] as const));
  return {
    covered: hits.filter(([, ok]) => ok).map(([t]) => t),
    uncovered: hits.filter(([, ok]) => !ok).map(([t]) => t),
  };
}

async function partSources(db: Db, uid: string) {
  const since = new Date(Date.now() - 72 * 3600 * 1000).toISOString();
  // pillar_evidence keys on pillar_id (no thesis_id column); map to a ticker through thesis_pillars.
  const [{ data, error }, { data: th }, { data: pl }] = await Promise.all([
    db.from('pillar_evidence')
      .select('source_type, source_title, source_url, verdict, materiality, created_at, pillar_id')
      .eq('user_id', uid).eq('is_backfill', false).gte('created_at', since)
      .order('created_at', { ascending: false }).limit(60),
    db.from('theses').select('id, ticker').eq('user_id', uid),
    db.from('thesis_pillars').select('id, thesis_id').eq('user_id', uid),
  ]);
  if (error) throw new Error(`pillar_evidence: ${error.message}`);
  const thesisTicker = new Map((th ?? []).map((t) => [String(t.id), String(t.ticker)]));
  const tickerOf = new Map((pl ?? []).map((p) => [String(p.id), thesisTicker.get(String(p.thesis_id)) ?? '']));
  let filings = 0, news = 0, priceMoves = 0, contradicts = 0;
  const items: PresenceSource[] = [];
  for (const e of data ?? []) {
    const st = String(e.source_type);
    if (st === 'filing' || st === 'form4' || st === 'xbrl') filings++;
    else if (st === 'news') news++;
    else if (st === 'price_move') priceMoves++;
    if (e.verdict === 'contradicts') contradicts++;
    const ticker = tickerOf.get(String(e.pillar_id)) || null;
    items.push({
      title: String(e.source_title ?? ''), type: st, ticker, verdict: String(e.verdict), materiality: String(e.materiality),
      at: String(e.created_at), url: (e.source_url as string | null) ?? null,
    });
  }
  return { filings, news, priceMoves, contradicts, items: items.slice(0, 20) };
}

async function partTheses(db: Db, uid: string) {
  const [{ count }, pillars] = await Promise.all([
    db.from('theses').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('tracked', true),
    db.from('thesis_pillars').select('claim, status, breaks_if, status_changed_at, theses!inner(ticker, tracked)').eq('user_id', uid)
      .eq('theses.tracked', true)
      .order('status_changed_at', { ascending: false, nullsFirst: false }).limit(12),
  ]);
  return {
    tracked: count ?? 0,
    pillars: (pillars.data ?? []).map((p) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ticker: ((p as any).theses?.ticker as string | undefined) ?? '',
      claim: String(p.claim), status: String(p.status), breaksIf: (p.breaks_if as string | null) ?? null,
      changedAt: (p.status_changed_at as string | null) ?? null,
    })),
  };
}

async function partFlags(db: Db, uid: string): Promise<PresenceData['flags']> {
  const since = new Date(Date.now() - 72 * 3600 * 1000).toISOString();
  const [{ data }, perf] = await Promise.all([
    db.from('insights').select('*').eq('user_id', uid).gte('created_at', since).order('created_at', { ascending: false }).limit(30),
    db.from('portfolio_performance').select('calculated_at').eq('user_id', uid).order('calculated_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = ((data ?? []) as any[]).filter((r) => !r.is_dismissed);
  const items: PresenceFlag[] = rows.slice(0, 8).map((r) => ({
    id: String(r.id), title: String(r.title ?? 'Flagged'), kind: String(r.insight_type ?? ''), priority: String(r.priority ?? ''),
    at: String(r.created_at), detail: (r.description as string | null) ?? null,
    impact: r.estimated_impact_amount != null ? Number(r.estimated_impact_amount) : null,
  }));
  return { scansRanAt: (rows[0]?.created_at as string | undefined) ?? (perf.data?.calculated_at as string | null) ?? null, items };
}

async function partDigest(db: Db, uid: string): Promise<string | null> {
  const { data } = await db.from('brief_digests').select('digest').eq('user_id', uid).maybeSingle();
  const d = data?.digest;
  return typeof d === 'string' ? d : d ? JSON.stringify(d) : null;
}

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const t0 = Date.now();
  const v = await fn();
  return [v, Date.now() - t0];
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 });
  const uid = await resolveUserId(email);
  if (!uid) return NextResponse.json({ error: `No account for ${email}` }, { status: 404 });
  const db = createStaticServiceClient();
  const part = req.nextUrl.searchParams.get('part') as PresencePart | null;

  try {
    if (part) {
      let value: unknown;
      let ms = 0;
      switch (part) {
        case 'book': [value, ms] = await timed(() => partBook(db, uid)); break;
        case 'run': [value, ms] = await timed(() => partRun(db, uid)); break;
        case 'concentration': [value, ms] = await timed(() => partConcentration(db, uid)); break;
        case 'earnings': [value, ms] = await timed(() => partEarnings(db, uid)); break;
        case 'tax': {
          const book = await partBook(db, uid);
          [value, ms] = await timed(() => partTax(uid, book.positions));
          break;
        }
        case 'coverage': [value, ms] = await timed(() => partCoverage(db, uid)); break;
        case 'sources': [value, ms] = await timed(() => partSources(db, uid)); break;
        case 'theses': [value, ms] = await timed(() => partTheses(db, uid)); break;
        case 'flags': [value, ms] = await timed(() => partFlags(db, uid)); break;
        case 'worklog': [value, ms] = await timed(() => buildWorklog(db, uid)); break;
        case 'digest': [value, ms] = await timed(() => partDigest(db, uid)); break;
        default: return NextResponse.json({ error: `unknown part ${part}` }, { status: 400 });
      }
      return NextResponse.json({ part, value, ms });
    }

    const [[book, msBook], [run, msRun], [concentration, msConc], [earnings, msEarn], [coverage, msCov], [sources, msSrc], [theses, msTh], [flags, msFl], [worklog, msWl], [digest, msDg]] = await Promise.all([
      timed(() => partBook(db, uid)), timed(() => partRun(db, uid)), timed(() => partConcentration(db, uid)),
      timed(() => partEarnings(db, uid)), timed(() => partCoverage(db, uid)), timed(() => partSources(db, uid)),
      timed(() => partTheses(db, uid)), timed(() => partFlags(db, uid)), timed(() => buildWorklog(db, uid)), timed(() => partDigest(db, uid)),
    ]);
    const [tax, msTax] = await timed(() => partTax(uid, book.positions));
    const body: PresenceData = {
      email, book, run, concentration, earnings, tax, coverage, sources, theses, flags, worklog, digest,
      ms: { book: msBook, run: msRun, concentration: msConc, earnings: msEarn, tax: msTax, coverage: msCov, sources: msSrc, theses: msTh, flags: msFl, worklog: msWl, digest: msDg },
    };
    return NextResponse.json(body);
  } catch (err) {
    console.error('[testing/presence]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 500 });
  }
}
