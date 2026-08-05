// "Did anything happen?" — the question the retention data says users are
// actually asking.
//
// Every retained user opens /dashboard and scans a grid of numbers themselves.
// The intelligence to answer them already exists, but it lives on surfaces they
// never navigate to (research chat: zero pageviews from real users). This route
// answers the question in one line, on the page they already open.
//
// Grounding rules are the same as the research engine's: report what the
// headline says, attribute it, and never assert that it CAUSED the move.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getFullTickerData } from '@/lib/financial-data';

export const dynamic = 'force-dynamic';

/** Below this, a move is noise and saying so is the honest answer. */
const MOVE_THRESHOLD_PCT = 2;

export interface DashboardDelta {
  /** null when nothing on the book moved enough to be worth a sentence. */
  mover: {
    ticker: string;
    changePct: number;
    /** Dollar move on THEIR position — the part that is about them. */
    dollarImpact: number;
    positionValue: number;
  } | null;
  /** How many other positions also cleared the threshold. */
  otherMovers: number;
  /** Largest move among everything else, for the "nothing else moved" clause. */
  nextLargestPct: number | null;
  headline: { title: string; source: string; url: string; date: string | null } | null;
  positionsChecked: number;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: holdings } = await supabase
      .from('holdings')
      .select('ticker, total_value, day_change_pct')
      .eq('user_id', user.id);

    // Fold by ticker: the ICP holds one name across several brokerages, and an
    // unfolded list would report the same move twice at a fraction of the size.
    const byTicker = new Map<string, { value: number; pct: number | null }>();
    for (const h of holdings ?? []) {
      const ticker = String(h.ticker).toUpperCase();
      const value = Number(h.total_value ?? 0);
      // day_change_pct is a DECIMAL FRACTION in the DB (0.0124 = 1.24%).
      const pct = h.day_change_pct != null ? Number(h.day_change_pct) * 100 : null;
      const prev = byTicker.get(ticker);
      if (prev) {
        prev.value += value;
        prev.pct = prev.pct ?? pct;
      } else {
        byTicker.set(ticker, { value, pct });
      }
    }

    const ranked = [...byTicker.entries()]
      .filter(([, v]) => v.pct != null && v.value > 0)
      .sort((a, b) => Math.abs(b[1].pct as number) - Math.abs(a[1].pct as number));

    const empty: DashboardDelta = {
      mover: null,
      otherMovers: 0,
      nextLargestPct: ranked.length > 0 ? (ranked[0][1].pct as number) : null,
      headline: null,
      positionsChecked: byTicker.size,
    };

    const top = ranked[0];
    if (!top || Math.abs(top[1].pct as number) < MOVE_THRESHOLD_PCT) {
      return NextResponse.json(empty);
    }

    const [ticker, { value, pct }] = top;
    const changePct = pct as number;
    // Back out today's dollar move from the position's CURRENT value.
    const dollarImpact = value - value / (1 + changePct / 100);

    const others = ranked
      .slice(1)
      .filter(([, v]) => Math.abs(v.pct as number) >= MOVE_THRESHOLD_PCT);

    // One headline, best effort. A move with no explanation is still a useful
    // answer, so a news failure must not blank the whole line.
    let headline: DashboardDelta['headline'] = null;
    try {
      const td = await getFullTickerData(ticker);
      const first = td?.news?.find((n) => n.headline && n.url);
      if (first) {
        headline = {
          title: first.headline,
          source: first.source || 'News',
          url: first.url,
          date: first.datetime ? new Date(first.datetime * 1000).toISOString().slice(0, 10) : null,
        };
      }
    } catch {
      /* the move is the answer; the headline is the receipt */
    }

    return NextResponse.json({
      mover: { ticker, changePct, dollarImpact, positionValue: value },
      otherMovers: others.length,
      nextLargestPct: ranked[1] ? (ranked[1][1].pct as number) : null,
      headline,
      positionsChecked: byTicker.size,
    } satisfies DashboardDelta);
  } catch (error) {
    console.error('[dashboard/delta]', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
