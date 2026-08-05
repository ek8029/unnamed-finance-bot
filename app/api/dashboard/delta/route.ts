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
import { getCompanyNews, getQuote } from '@/lib/financial-data';

export const dynamic = 'force-dynamic';

/** Below this, a move is noise and saying so is the honest answer. */
const MOVE_THRESHOLD_PCT = 2;
/** How many stored-column candidates to re-price live before ranking.
 *  Each is a vendor round-trip, and the stored column is a good enough
 *  pre-filter that checking beyond the top few buys accuracy nobody sees. */
const LIVE_CHECK_LIMIT = 3;
/** A headline older than this relative to the session is not an explanation. */
const HEADLINE_MAX_AGE_DAYS = 2;

/** Today in the exchange's timezone, YYYY-MM-DD. */
function todayET(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

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
  /** The trading session these numbers describe (YYYY-MM-DD, ET). The stored
   *  day_change_pct column is only as fresh as the last price refresh, so the
   *  line must never assert "Today" without checking. */
  sessionDate: string | null;
  /** True when sessionDate is today in ET — i.e. "Today" is an honest label. */
  isToday: boolean;
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

    // The stored column is only as fresh as the last price refresh, so it is
    // used ONLY to pick candidates cheaply. Everything reported is re-priced
    // live below — otherwise the line labels yesterday's move as today's.
    const candidates = [...byTicker.entries()]
      .filter(([, v]) => v.pct != null && v.value > 0)
      .sort((a, b) => Math.abs(b[1].pct as number) - Math.abs(a[1].pct as number))
      .slice(0, LIVE_CHECK_LIMIT);

    // ONE wave, not two. The headline used to be fetched only after every
    // quote resolved, so the user waited for two serial vendor round-trips to
    // read one line. The stored column already names the likely top mover, so
    // its news is fetched alongside the quotes and kept only if the live
    // re-rank agrees.
    const likelyTop = candidates[0]?.[0] ?? null;
    const [quotes, likelyTopNews] = await Promise.all([
      Promise.all(
        candidates.map(async ([ticker, v]) => {
          const q = await getQuote(ticker).catch(() => null);
          if (!q || !Number.isFinite(q.dp)) return null;
          return { ticker, value: v.value, pct: q.dp, sessionDate: q.date ?? null };
        }),
      ),
      likelyTop ? getCompanyNews(likelyTop).catch(() => null) : Promise.resolve(null),
    ]);

    const quoted = quotes.filter(Boolean) as {
      ticker: string; value: number; pct: number; sessionDate: string | null;
    }[];

    const ranked = quoted.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
    const today = todayET();
    const sessionDate = ranked[0]?.sessionDate ?? null;

    const empty: DashboardDelta = {
      mover: null,
      otherMovers: 0,
      nextLargestPct: ranked.length > 0 ? ranked[0].pct : null,
      headline: null,
      positionsChecked: byTicker.size,
      sessionDate,
      isToday: sessionDate === today,
    };

    const top = ranked[0];
    if (!top || Math.abs(top.pct) < MOVE_THRESHOLD_PCT) {
      return NextResponse.json(empty);
    }

    const { ticker, value, pct: changePct } = top;
    // Back out today's dollar move from the position's CURRENT value.
    const dollarImpact = value - value / (1 + changePct / 100);

    const others = ranked.slice(1).filter((r) => Math.abs(r.pct) >= MOVE_THRESHOLD_PCT);

    // One headline, best effort. A move with no explanation is still a useful
    // answer, so a news failure must not blank the whole line.
    let headline: DashboardDelta['headline'] = null;
    try {
      // Already fetched above when the live ranking agrees with the stored
      // column, which is the overwhelmingly common case. When it disagrees the
      // move ships without a headline rather than paying a second round-trip.
      const news = ticker === likelyTop ? likelyTopNews : null;
      // A headline from last week does not explain today's move. Bound it to
      // the session being reported, or show the move with no explanation.
      const cutoff = sessionDate
        ? new Date(new Date(sessionDate + 'T00:00:00Z').getTime() - HEADLINE_MAX_AGE_DAYS * 86_400_000)
        : null;
      const first = news?.find((n) => {
        if (!n.headline || !n.url) return false;
        if (!cutoff || !n.datetime) return true;
        return new Date(n.datetime * 1000) >= cutoff;
      });
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
      nextLargestPct: ranked[1] ? ranked[1].pct : null,
      headline,
      positionsChecked: byTicker.size,
      sessionDate,
      isToday: sessionDate === today,
    } satisfies DashboardDelta);
  } catch (error) {
    console.error('[dashboard/delta]', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
