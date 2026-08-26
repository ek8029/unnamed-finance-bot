/**
 * Real-time price refresh via Finazon quotes.
 *
 * Replaces the previous Polygon-based refresh which only returned
 * end-of-day prices (previous close). Finazon /quote returns real-time
 * data during US market hours at no cost (free tier, 60 calls/min).
 *
 * When ANY user triggers this (via dashboard load auto-sync), ALL users'
 * holdings get updated — the price of AAPL is the same for everyone.
 * Because the work is global, concurrent triggers (two dashboard hooks,
 * multiple open tabs, multiple users, and in dev React Strict Mode's
 * double effect) are coalesced into a SINGLE Finazon sweep — otherwise
 * N concurrent sweeps blow past the time_series rate limit and 429 each
 * other into a multi-minute pile-up.
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { runGlobalRefresh } from '@/lib/market/price-sweep';
import { rateLimit } from '@/lib/rate-limit';
import { coalesce } from '@/lib/coalesce';

// The sweep walks the whole held-ticker universe at vendor-throttled pace and
// was already brushing Vercel's 300s default; the last-trade lift tipped it
// into FUNCTION_INVOCATION_TIMEOUT, which kills the run BEFORE any row is
// written. Ten minutes is honest headroom for a batch job, not a hot path.
export const maxDuration = 600;

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit: 8 calls per 10 min per user — enough for 60-second polling
    // (6 calls in 6 minutes) with headroom for page reloads. The Finazon
    // in-memory cache (60s TTL) prevents actual API calls on every poll.
    const { allowed } = rateLimit(`prices-refresh:${user.id}`, 8, 600);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // The sweep is global and identical for every caller, so collapse
    // concurrent/rapid triggers into one upstream pass (30s fresh window).
    const { status, body } = await coalesce('global-price-refresh', 30_000, runGlobalRefresh);
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error('Error refreshing market prices:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
