import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * Public aggregate metrics — returns platform-wide totals.
 * Only exposes sums, never individual user data.
 * Cached for 5 minutes to avoid hammering the DB on landing page loads.
 */
export async function GET() {
  try {
    const supabase = await createServiceClient();

    // Fetch latest snapshot per user (ordered by date desc, dedupe in JS)
    const { data, error } = await supabase
      .from('net_worth_snapshots')
      .select('user_id, net_worth')
      .order('snapshot_date', { ascending: false })
      .limit(1000);

    if (error) {
      return NextResponse.json(
        { totalNetWorth: 0, totalUsers: 0 },
        { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
      );
    }

    // Keep only the latest snapshot per user
    const latestByUser = new Map<string, number>();
    for (const row of data) {
      if (!latestByUser.has(row.user_id)) {
        latestByUser.set(row.user_id, Number(row.net_worth) || 0);
      }
    }

    const totalNetWorth = Array.from(latestByUser.values()).reduce((sum, nw) => sum + nw, 0);

    return NextResponse.json(
      { totalNetWorth: Math.round(totalNetWorth), totalUsers: latestByUser.size },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
    );
  } catch {
    return NextResponse.json(
      { totalNetWorth: 0, totalUsers: 0 },
      { status: 200, headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
    );
  }
}
