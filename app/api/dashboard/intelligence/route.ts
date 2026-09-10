import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateDailyInsights, FREE_INSIGHT_SOURCES } from '@/lib/intelligence-feed';
import { getUserTier, tierAtLeast } from '@/lib/tier';
import { persistOverviewActions, FEED_SOURCE_TO_INSIGHT_TYPE } from '@/lib/overview-actions';
import { readInsights, INSIGHT_SURFACE_TYPES } from '@/lib/insights-reader';

/**
 * The overview's "Actions inbox" (app/dashboard/page.tsx).
 *
 * This used to return generateDailyInsights() straight to the client: findings
 * recomputed from holdings on every request, each stamped createdAt = request
 * time, behind a one-hour in-memory cache. No row existed, so nothing could be
 * dismissed, nothing remembered when a finding was first raised, and every item
 * was new on every visit.
 *
 * Now the same generator runs, its findings are written down under the shared
 * recurrence policy (lib/overview-actions.ts), and the panel is served from the
 * table through readInsights. That is where announced / standing / gone is
 * decided (lib/insight-prominence.ts), so the panel inherits it rather than
 * carrying a second copy of the policy.
 */

/** What the free tier's "basic alerts" amount to, as insight_type values. The
 *  gate is unchanged: FREE_INSIGHT_SOURCES is ['cash_flow', 'performance'], and
 *  each of those feed sources has its own insight_type, so the same two lanes
 *  survive the move from a source filter to a table read. */
const FREE_TYPES = FREE_INSIGHT_SOURCES.map(s => FEED_SOURCE_TO_INSIGHT_TYPE[s]);

/** Everything the Actions page surfaces, plus the overview's own cash_flow lane. */
const PRO_TYPES = [...INSIGHT_SURFACE_TYPES, 'cash_flow'];

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [feed, tier] = await Promise.all([
      generateDailyInsights(user.id),
      getUserTier(user.id),
    ]);
    const isPro = tierAtLeast(tier, 'pro');

    // Write before reading, so a finding raised for the first time this minute
    // still appears on this render.
    //
    // Never fatal. The table already holds everything raised on previous runs,
    // so a failed write costs this render's newest finding and nothing else,
    // which is a far better outcome than the empty panel a 500 produces. It is
    // not hypothetical: dev impersonation refuses every write ("[lab]
    // impersonation is read-only: insert on insights blocked"), which took the
    // whole panel down locally, and in production an RLS refusal or a constraint
    // would do the same.
    try {
      await persistOverviewActions(supabase, user.id, feed);
    } catch (error) {
      console.error('Overview actions persist failed, serving the table as it stands:', error);
    }

    const rows = await readInsights(
      supabase,
      { id: user.id, email: user.email },
      { types: isPro ? PRO_TYPES : FREE_TYPES },
      isPro,
    );

    const insights = rows
      // The onboarding v3 "add a second brokerage" item readInsights appends is
      // not an insights row (source 'standing', the guard actions-client.tsx:439
      // uses), so it carries no id to dismiss. It was written for the Actions
      // page; this change neither moves it nor restyles it.
      .filter(r => r.source !== 'standing')
      .map(r => ({
        id: r.id,
        type: r.type,
        priority: r.priority,
        title: r.title,
        summary: r.description,
        createdAt: r.created_at,
        prominence: r.prominence,
      }));

    return NextResponse.json({ insights, tier });
  } catch (error) {
    console.error('Intelligence feed failed:', error);
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 });
  }
}
