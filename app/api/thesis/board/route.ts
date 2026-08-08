// GET /api/thesis/board — the theses board the web table renders, as JSON.
//
// The phone reads this. Every number here comes from lib/content/thesis-board,
// the same module /dashboard/theses renders from, so the two surfaces cannot
// drift into telling different stories about the same book.
//
// SCOPING: getScoringThesisData() runs on the service client, so the caller is
// responsible for the user boundary. user.id is passed on EVERY call and the
// ticker list is read through the authenticated (RLS) client — without that
// filter the scoring query aggregates corpus-wide and would hand one user
// another's claims, kill criteria and evidence for any ticker they both hold.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasThesisAccess } from '@/lib/thesis-access-server';
import { getScoringThesisData, type ScoredPillar } from '@/lib/content/scoring-thesis';
import { topCeiling } from '@/components/testing/thesis-v2-blocks';
import type { LadderStatus } from '@/lib/content/mechanism-cluster';
import {
  RANK, STATUS_TONE, STATUS_WORD, headline, isFresh, pillarStateLine, tally, thesisCeiling,
} from '@/lib/content/thesis-board';
import { getEdgarEarnings } from '@/lib/earnings-edgar';

export const dynamic = 'force-dynamic';

const MAX_THESES = 30;
/** Mirrors PillarLine: adverse first, then corroborated-quiet, capped. */
const MAX_MECHANISMS = 4;
/** Receipts carried inline per mechanism. The rest are a tap away on the web. */
const MAX_ITEMS = 2;

interface Position { value: number; pl: number | null; plPct: number | null }

function pillarPayload(p: ScoredPillar) {
  const { status, line } = pillarStateLine(p);
  const adverse = p.mechanisms.filter((m) => m.maxStatus !== 'watch');
  const corroboratedQuiet = p.mechanisms.filter((m) => m.maxStatus === 'watch' && m.mentions > 1);
  const singles = p.mechanisms.length - adverse.length - corroboratedQuiet.length;
  const shown = [...adverse, ...corroboratedQuiet].slice(0, MAX_MECHANISMS);

  return {
    key: p.key,
    claim: p.claim,
    breaksIf: p.breaksIf,
    status,
    statusTone: STATUS_TONE[status],
    line,
    singles,
    mechanisms: shown.map((m) => ({
      label: m.label,
      mentions: m.mentions,
      sourceClasses: m.sourceClasses,
      confirmations: m.confirmations,
      maxStatus: m.maxStatus,
      lastSeen: m.lastSeen,
      fresh: !!m.lastSeen && isFresh(m.lastSeen),
      items: m.items.slice(0, MAX_ITEMS).map((c) => ({
        id: c.id,
        dateISO: c.dateISO,
        title: c.title,
        excerpt: c.excerpt,
        url: c.url,
      })),
    })),
  };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!(await hasThesisAccess(user.id, user.email))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Read through the authenticated client: RLS is the boundary, not a filter
    // we remembered to write.
    const [{ data: theses }, { data: holdings }, { data: clusterRow }] = await Promise.all([
      supabase.from('theses').select('ticker, tracked, notes')
        .eq('user_id', user.id).order('tracked', { ascending: false }),
      supabase.from('holdings').select('ticker, total_value, unrealised_gain_loss, unrealised_gain_loss_pct')
        .eq('user_id', user.id),
      supabase.from('thesis_clusters').select('clusters').eq('user_id', user.id).maybeSingle(),
    ]);

    if (!theses?.length) {
      return NextResponse.json({ summary: null, forces: [], rows: [] });
    }

    // The money behind each thesis. Multiple lots fold into one line.
    const positions = new Map<string, Position>();
    let bookTotal = 0;
    for (const h of holdings ?? []) {
      const t = String(h.ticker).toUpperCase();
      const value = Number(h.total_value ?? 0);
      bookTotal += value;
      const prev = positions.get(t) ?? { value: 0, pl: null, plPct: null };
      positions.set(t, {
        value: prev.value + value,
        // Unknown cost basis stays null. Coercing it to 0 paints a confident
        // green "+$0" on transfer-in positions Plaid has no basis for.
        pl: h.unrealised_gain_loss != null
          ? (prev.pl ?? 0) + Number(h.unrealised_gain_loss)
          : prev.pl,
        plPct: h.unrealised_gain_loss_pct != null ? Number(h.unrealised_gain_loss_pct) : prev.plPct,
      });
    }

    const notesByTicker = new Map(
      theses.map((t) => [String(t.ticker).toUpperCase(), (t.notes as string | null) ?? null]),
    );
    const tickers = [...new Set(theses.map((t) => String(t.ticker).toUpperCase()))].slice(0, MAX_THESES);

    const data = await Promise.all(tickers.map((t) => getScoringThesisData(t, user.id)));

    // Next earnings per ticker (EDGAR, cached ~1h). Best effort: a vendor blip
    // must not blank the board.
    const earnings = new Map<string, string | null>();
    await Promise.allSettled(
      data.map(async (d) => {
        const e = await getEdgarEarnings(d.ticker);
        earnings.set(d.ticker, e.nextEstimatedDate);
      }),
    );

    const rows = data
      .map((d) => ({ d, ceiling: thesisCeiling(d), pos: positions.get(d.ticker) ?? null, t: tally(d) }))
      .sort((a, b) => RANK[a.ceiling] - RANK[b.ceiling] || (b.pos?.value ?? 0) - (a.pos?.value ?? 0));

    const trackedValue = rows.reduce((s, r) => s + (r.pos?.value ?? 0), 0);
    const pressured = rows.filter((r) => r.ceiling !== 'watch');
    const receipts7d = rows.reduce(
      (s, r) => s + r.d.pillars.flatMap((p) => p.catches).filter((c) => isFresh(c.dateISO)).length,
      0,
    );
    const nextEarnings = rows
      .map((r) => ({ ticker: r.d.ticker, date: earnings.get(r.d.ticker) }))
      .filter((x): x is { ticker: string; date: string } => !!x.date)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;

    // Shared forces: only a driver linking 2+ theses ON SCREEN is a force.
    interface SynthClusterRow { driver: string; pillars: { ticker: string }[]; rationale: string }
    const statusOfTicker = new Map(rows.map((r) => [r.d.ticker, r.ceiling]));
    const forces = ((clusterRow?.clusters as SynthClusterRow[] | null) ?? [])
      .map((c) => ({
        name: c.driver,
        rationale: c.rationale,
        tickers: [...new Set((c.pillars ?? []).map((p) => p.ticker.toUpperCase()))]
          .filter((t) => statusOfTicker.has(t)),
      }))
      .filter((c) => c.tickers.length >= 2)
      .map((c) => {
        const status = c.tickers.reduce<LadderStatus>(
          (worst, t) => (RANK[statusOfTicker.get(t) ?? 'watch'] < RANK[worst] ? (statusOfTicker.get(t) ?? 'watch') : worst),
          'watch',
        );
        return { ...c, status, statusTone: STATUS_TONE[status] };
      });

    return NextResponse.json({
      summary: {
        trackedValue,
        bookTotal,
        coveragePct: bookTotal > 0 ? (trackedValue / bookTotal) * 100 : null,
        pressuredValue: pressured.reduce((s, r) => s + (r.pos?.value ?? 0), 0),
        pressuredTickers: pressured.map((r) => r.d.ticker),
        receipts7d,
        nextEarnings,
      },
      forces,
      rows: rows.map(({ d, ceiling, pos, t }) => ({
        ticker: d.ticker,
        company: d.company,
        status: ceiling,
        statusWord: STATUS_WORD[ceiling],
        statusTone: STATUS_TONE[ceiling],
        position: pos,
        supports: t.supports,
        against: t.against,
        headline: headline(d),
        statement: notesByTicker.get(d.ticker) ?? null,
        nextEarnings: earnings.get(d.ticker) ?? null,
        hasFresh: d.pillars.some((p) =>
          p.mechanisms.some((m) => m.lastSeen && isFresh(m.lastSeen) && m.maxStatus !== 'watch')),
        receiptsOnFile: d.dedupedRows,
        lastScan: d.lastScan,
        pillars: [...d.pillars]
          .sort((a, b) => RANK[topCeiling(a.mechanisms)] - RANK[topCeiling(b.mechanisms)])
          .map(pillarPayload),
      })),
    });
  } catch (err) {
    console.error('[thesis/board] unhandled error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
