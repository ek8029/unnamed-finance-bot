// "What Helm did while you were away", as a pure builder.
//
// Extracted from app/api/agent/worklog/route.ts so the same log can be built
// for the signed-in caller (the route, RLS client) and for a lab account (the
// dev-only /api/testing/presence route, service client). Every line is a REAL
// per-user timestamped row written by the crons and, since the perpetual watch,
// by the pollers and the judge queue. Zero LLM. The caller decides which client
// and which user.
//
// Every step carries its own time and its cadence: the time is the job's, never
// the brief's, and the cadence says how often that kind of work happens.

import type { SupabaseClient } from '@supabase/supabase-js';

export type WorklogKind = 'sync' | 'price' | 'read' | 'scan' | 'flag' | 'brief';
export type WorklogCadence = '1 min' | '5 min' | 'hourly' | 'daily' | 'on event';

export interface WorklogStep {
  id: string;
  ts: string; // ISO, the step's own time
  kind: WorklogKind;
  label: string;
  detail: string | null;
  href: string | null;
  emphasis: boolean; // flagged / needs-review items render hot
  cadence: WorklogCadence;
}

export interface WorklogWatch {
  /** When the filing poller last looked (watch_heartbeats), whatever it found. */
  checkedAt: string | null;
  newsCheckedAt: string | null;
  /** Filings the poller saw on this book's names inside the window. */
  filingsSeen: number;
  jobsDone: number;
  queued: number;
}

export interface WorklogResponse {
  ranAt: string | null;
  steps: WorklogStep[];
  summary: { theses: number; accounts: number; sources: number; flags: number };
  watch: WorklogWatch;
}

export const EMPTY_WORKLOG: WorklogResponse = {
  ranAt: null,
  steps: [],
  summary: { theses: 0, accounts: 0, sources: 0, flags: 0 },
  watch: { checkedAt: null, newsCheckedAt: null, filingsSeen: 0, jobsDone: 0, queued: 0 },
};

// Look back far enough to always catch the most recent cron cycle, even over a
// weekend, without pulling stale history. Real timestamps drive the display.
export const WORKLOG_WINDOW_MS = 72 * 60 * 60 * 1000;

const plural = (n: number, s: string) => `${n} ${s}${n === 1 ? '' : 's'}`;

/** 9:02 AM ET, for detail strings the builder writes server-side. */
function clockET(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET';
}

interface JobRow {
  id: string;
  kind: string;
  ticker: string | null;
  source_key: string;
  status: string;
  payload: Record<string, unknown> | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  evidence_added: number | null;
  error: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buildWorklog(supabase: SupabaseClient<any, any, any>, uid: string): Promise<WorklogResponse> {
  const since = new Date(Date.now() - WORKLOG_WINDOW_MS).toISOString();
  const steps: WorklogStep[] = [];

  // ── Tracked-thesis count (heartbeat denominator) ──
  const { count: thesesCount } = await supabase
    .from('theses').select('id', { count: 'exact', head: true })
    .eq('user_id', uid).eq('tracked', true);

  // ── Synced accounts ──
  const { data: accts } = await supabase
    .from('linked_accounts')
    .select('account_name, last_synced_at')
    .eq('user_id', uid);
  const accountCount = accts?.length ?? 0;
  const synced = (accts ?? []).filter((a) => a.last_synced_at && (a.last_synced_at as string) >= since);
  if (synced.length > 0) {
    const newest = synced.reduce((m, a) => ((a.last_synced_at as string) > m ? (a.last_synced_at as string) : m), synced[0].last_synced_at as string);
    steps.push({
      id: 'sync', ts: newest, kind: 'sync',
      label: 'Synced your linked accounts',
      detail: `${plural(synced.length, 'account')} refreshed`,
      href: '/dashboard', emphasis: false, cadence: 'daily',
    });
  }

  // ── Re-read filings / news against theses ──
  const { data: ev } = await supabase
    .from('pillar_evidence')
    .select('source_type, created_at, source_url, verdict')
    .eq('user_id', uid).eq('is_backfill', false)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(80);
  let filings = 0, news = 0, priceMoves = 0;
  let newestFiling: string | null = null, newestNews: string | null = null;
  // Verdict per filing accession (digits), strongest first, for the watch lines below.
  const filingVerdict = new Map<string, string>();
  const rank = (v: string) => (v === 'contradicts' ? 3 : v === 'supports' ? 2 : 1);
  for (const e of ev ?? []) {
    const st = e.source_type as string;
    const ts = e.created_at as string;
    if (st === 'filing' || st === 'form4' || st === 'xbrl') {
      filings++; if (!newestFiling) newestFiling = ts;
      const digits = String(e.source_url ?? '').match(/\/(\d{18})\//)?.[1];
      const v = String(e.verdict ?? '');
      if (digits && v && rank(v) > rank(filingVerdict.get(digits) ?? '')) filingVerdict.set(digits, v);
    }
    else if (st === 'news') { news++; if (!newestNews) newestNews = ts; }
    else if (st === 'price_move') { priceMoves++; }
  }
  if (filings > 0 && newestFiling) {
    steps.push({
      id: 'read-filings', ts: newestFiling, kind: 'read',
      label: `Re-read ${plural(filings, 'SEC filing')} against your theses`,
      detail: 'checked each against the reasons you hold',
      href: '/dashboard/theses', emphasis: false, cadence: 'hourly',
    });
  }
  if (news > 0 && newestNews) {
    steps.push({
      id: 'read-news', ts: newestNews, kind: 'read',
      label: `Scanned ${plural(news, 'news item')} for thesis impact`,
      detail: null, href: '/dashboard/theses', emphasis: false, cadence: 'hourly',
    });
  }

  // ── The watch: filings the poller saw on this book's names, the jobs it
  //    raised, and when it last looked. Tables from migration 072; a query
  //    that fails (unapplied migration) yields no lines, never an error. ──
  const watch: WorklogWatch = { checkedAt: null, newsCheckedAt: null, filingsSeen: 0, jobsDone: 0, queued: 0 };
  const [{ data: held }, { data: mine }] = await Promise.all([
    supabase.from('holdings').select('ticker').eq('user_id', uid).neq('ticker', 'UNKNOWN').limit(1000),
    supabase.from('theses').select('ticker').eq('user_id', uid).eq('tracked', true).limit(500),
  ]);
  const myTickers = [...new Set([...(held ?? []), ...(mine ?? [])].map((r) => String(r.ticker ?? '').toUpperCase()).filter(Boolean))];
  const [{ data: feRaw }, { data: jobsRaw }, { data: beats }] = await Promise.all([
    myTickers.length > 0
      ? supabase.from('filing_events').select('accession_no, ticker, form, filed_at, seen_at, status, note')
          .in('ticker', myTickers).gte('seen_at', since).order('seen_at', { ascending: false }).limit(12)
      : Promise.resolve({ data: null }),
    supabase.from('judge_jobs')
      .select('id, kind, ticker, source_key, status, payload, created_at, started_at, finished_at, evidence_added, error')
      .eq('user_id', uid).gte('created_at', since).order('created_at', { ascending: false }).limit(40),
    supabase.from('watch_heartbeats').select('name, at').limit(10),
  ]);
  let dailyScansAt: string | null = null;
  for (const b of beats ?? []) {
    if (b.name === 'edgar-watch') watch.checkedAt = String(b.at);
    if (b.name === 'news-watch') watch.newsCheckedAt = String(b.at);
    if (b.name === 'daily-scans') dailyScansAt = String(b.at);
  }
  const jobs = (jobsRaw ?? []) as JobRow[];
  const jobBySource = new Map(jobs.map((j) => [j.source_key, j]));
  watch.jobsDone = jobs.filter((j) => j.status === 'done').length;
  watch.queued = jobs.filter((j) => j.status === 'queued' || j.status === 'running').length;

  const feRows = (feRaw ?? []) as { accession_no: string; ticker: string; form: string; filed_at: string; seen_at: string; status: string; note: string | null }[];
  watch.filingsSeen = feRows.length;
  for (const f of feRows) {
    const job = jobBySource.get(f.accession_no);
    const verdict = filingVerdict.get(f.accession_no.replace(/-/g, ''));
    const filed = `filed ${clockET(f.filed_at)}`;
    let ts = f.seen_at;
    let label = `Saw ${f.ticker} ${f.form}`;
    let detail: string;
    let emphasis = false;
    if (job?.status === 'done' && job.finished_at) {
      ts = job.finished_at;
      label = `Read ${f.ticker} ${f.form}`;
      detail = `${filed} · judged ${clockET(job.finished_at)} · ${verdict ?? 'nothing bears on a pillar'}`;
      emphasis = verdict === 'contradicts';
    } else if (job && (job.status === 'queued' || job.status === 'running')) {
      detail = `${filed} · in the queue`;
    } else if (job?.status === 'capped') {
      detail = `${filed} · held for the hourly read (daily cap)`;
    } else {
      detail = `${filed} · ${f.note ?? (f.status === 'skipped' ? 'not judged' : 'seen')}`;
    }
    steps.push({ id: `filing-${f.accession_no}`, ts, kind: 'read', label, detail, href: '/dashboard/theses', emphasis, cadence: '1 min' });
  }

  for (const j of jobs.filter((x) => x.kind === 'news' && x.status === 'done' && x.finished_at && !x.error).slice(0, 4)) {
    const title = String(j.payload?.title ?? '').slice(0, 70);
    steps.push({
      id: `news-${j.id}`, ts: j.finished_at as string, kind: 'read',
      label: `Read news on ${j.ticker ?? ''}`.trim(),
      detail: `${title ? `${title} · ` : ''}judged ${clockET(j.finished_at)}${j.evidence_added ? ` · ${plural(j.evidence_added, 'finding')}` : ''}`,
      href: '/dashboard/theses', emphasis: false, cadence: '5 min',
    });
  }
  for (const j of jobs.filter((x) => x.kind === 'investigate' && x.status === 'done' && x.finished_at).slice(0, 3)) {
    const pct = Number(j.payload?.pct);
    const move = Number.isFinite(pct) ? `${pct > 0 ? 'rose' : 'fell'} ${(Math.abs(pct) * 100).toFixed(1)}% intraday` : 'moved sharply intraday';
    steps.push({
      id: `severe-${j.id}`, ts: j.finished_at as string, kind: 'flag',
      label: `Investigated ${j.ticker ?? ''}: ${move}`.replace('  ', ' '),
      detail: `read against your pillars ${clockET(j.finished_at)}${j.evidence_added ? ` · ${plural(j.evidence_added, 'finding')}` : ''}`,
      href: '/dashboard/theses', emphasis: true, cadence: 'on event',
    });
  }

  // ── Risk scans + flagged items ──
  const { data: ins } = await supabase
    .from('insights')
    .select('id, title, insight_type, priority, created_at, is_dismissed')
    .eq('user_id', uid)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(40);
  const liveIns = (ins ?? []).filter((i) => !i.is_dismissed);
  const scanTs = liveIns[0]?.created_at as string | undefined;
  // The scan line needs a real time: the freshest insight, else the stamp the
  // daily run writes when the sweep finishes. Without either the sweep did not
  // run, and the line is left out rather than anchored to something else.
  const runTs = scanTs ?? dailyScansAt;
  if (runTs) {
    steps.push({
      id: 'scan', ts: runTs, kind: 'scan',
      label: 'Ran 7 risk scans across your book',
      detail: liveIns.length > 0 ? `${plural(liveIns.length, 'item')} surfaced` : 'concentration, tax, earnings, cash flow, drift',
      href: '/dashboard/actions', emphasis: false, cadence: 'daily',
    });
  }
  // Surface the top few flagged items individually — the juicy "it caught this".
  const flags = liveIns
    .filter((i) => i.priority === 'high' || i.priority === 'critical' || i.priority === 1 || i.priority === 2)
    .slice(0, 3);
  // Summary "flagged" count always matches the rows we actually render below.
  const flagCount = flags.length;
  for (const f of flags) {
    steps.push({
      id: `flag-${f.id}`, ts: f.created_at as string, kind: 'flag',
      label: (f.title as string) ?? 'Flagged an item for review',
      detail: 'needs your review',
      href: '/dashboard/actions', emphasis: true, cadence: 'daily',
    });
  }

  // ── Investigations the agent ran on its own (E1) ──
  // Tolerates migration 056 not being applied: query error → no steps.
  const { data: memos } = await supabase
    .from('thesis_investigations')
    .select('id, thesis_id, trigger_kind, memo, created_at, theses(ticker)')
    .eq('user_id', uid)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(3);
  for (const m of memos ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ticker = (m as any).theses?.ticker ?? '';
    const headline = ((m.memo as { headline?: string } | null)?.headline ?? '').slice(0, 120);
    steps.push({
      id: `inv-${m.id}`, ts: m.created_at as string, kind: 'flag',
      label: `Investigated ${ticker}: wrote a memo`,
      detail: headline || 'evidence moved a thesis pillar',
      href: `/dashboard/theses/${m.thesis_id}`, emphasis: true, cadence: 'on event',
    });
  }

  steps.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));

  return {
    ranAt: steps[0]?.ts ?? null,
    steps,
    summary: {
      theses: thesesCount ?? 0,
      accounts: accountCount,
      sources: filings + news + priceMoves,
      flags: flagCount,
    },
    watch,
  };
}
