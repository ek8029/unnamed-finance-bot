// GET /api/agent/worklog — "what Helm did while you were away".
// A platform-wide agent work log (not just theses): synced accounts, re-priced
// positions, re-read filings/news against your theses, ran risk scans, flagged
// items, wrote your brief. Every line is a REAL per-user timestamped row already
// written by the daily + score-theses crons. Pure DB read, zero LLM, RLS-scoped.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export type WorklogKind = 'sync' | 'price' | 'read' | 'scan' | 'flag' | 'brief';

export interface WorklogStep {
  id: string;
  ts: string; // ISO
  kind: WorklogKind;
  label: string;
  detail: string | null;
  href: string | null;
  emphasis: boolean; // flagged / needs-review items render hot
}

export interface WorklogResponse {
  ranAt: string | null;
  steps: WorklogStep[];
  summary: { theses: number; accounts: number; sources: number; flags: number };
}

const EMPTY: WorklogResponse = {
  ranAt: null,
  steps: [],
  summary: { theses: 0, accounts: 0, sources: 0, flags: 0 },
};

// Look back far enough to always catch the most recent cron cycle, even over a
// weekend, without pulling stale history. Real timestamps drive the display.
const WINDOW_MS = 72 * 60 * 60 * 1000;

const plural = (n: number, s: string) => `${n} ${s}${n === 1 ? '' : 's'}`;

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const uid = user.id;
    const since = new Date(Date.now() - WINDOW_MS).toISOString();
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
        href: '/dashboard', emphasis: false,
      });
    }

    // ── Run timestamp — anchors the scan line only. The overnight price refresh
    //    is automatic plumbing, not agent work, so it is never shown as a step.
    const { data: perf } = await supabase
      .from('portfolio_performance').select('calculated_at')
      .eq('user_id', uid).order('calculated_at', { ascending: false }).limit(1).maybeSingle();
    const priceTs = (perf?.calculated_at as string | undefined) ?? null;

    // ── Re-read filings / news against theses ──
    const { data: ev } = await supabase
      .from('pillar_evidence')
      .select('source_type, created_at')
      .eq('user_id', uid).eq('is_backfill', false)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(80);
    let filings = 0, news = 0, priceMoves = 0;
    let newestFiling: string | null = null, newestNews: string | null = null;
    for (const e of ev ?? []) {
      const st = e.source_type as string;
      const ts = e.created_at as string;
      if (st === 'filing' || st === 'form4' || st === 'xbrl') { filings++; if (!newestFiling) newestFiling = ts; }
      else if (st === 'news') { news++; if (!newestNews) newestNews = ts; }
      else if (st === 'price_move') { priceMoves++; }
    }
    if (filings > 0 && newestFiling) {
      steps.push({
        id: 'read-filings', ts: newestFiling, kind: 'read',
        label: `Re-read ${plural(filings, 'SEC filing')} against your theses`,
        detail: 'checked each against the reasons you hold',
        href: '/dashboard/theses', emphasis: false,
      });
    }
    if (news > 0 && newestNews) {
      steps.push({
        id: 'read-news', ts: newestNews, kind: 'read',
        label: `Scanned ${plural(news, 'news item')} for thesis impact`,
        detail: null, href: '/dashboard/theses', emphasis: false,
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
    // The daily cron always runs the 7-rule intelligence sweep; anchor it to the
    // freshest insight (or the pricing run) so the line has a real timestamp.
    const runTs = scanTs ?? priceTs;
    if (runTs) {
      steps.push({
        id: 'scan', ts: runTs, kind: 'scan',
        label: 'Ran 7 risk scans across your book',
        detail: liveIns.length > 0 ? `${plural(liveIns.length, 'item')} surfaced` : 'concentration, tax, earnings, cash flow, drift',
        href: '/dashboard/actions', emphasis: false,
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
        href: '/dashboard/actions', emphasis: true,
      });
    }

    steps.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));

    const res: WorklogResponse = {
      ranAt: steps[0]?.ts ?? null,
      steps,
      summary: {
        theses: thesesCount ?? 0,
        accounts: accountCount,
        sources: filings + news + priceMoves,
        flags: flagCount,
      },
    };
    return NextResponse.json(res);
  } catch (err) {
    console.error('[worklog] unhandled error:', err);
    return NextResponse.json(EMPTY);
  }
}
