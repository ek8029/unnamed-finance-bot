import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { generateDigest, generateGenericDigest } from '@/lib/generate-digest';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * GET /api/cron/digest
 *
 * Runs hourly. For each user whose preferred delivery hour matches
 * the current hour (ET), generates an AI digest and stores it.
 * Users without a preference default to 9 AM ET (14:00 UTC).
 *
 * Skips users who already have a digest generated today.
 */
export async function GET(request: Request) {
  const startTime = Date.now();
  const log: string[] = [];

  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
    }
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const serviceClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Current hour in ET
    const nowET = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false });
    const currentHourET = parseInt(nowET.split(', ')[1].split(':')[0], 10);
    log.push(`[digest] Current hour ET: ${currentHourET}`);

    // Get all users with their preferences
    const { data: { users }, error: usersError } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
    if (usersError) throw usersError;

    // Get all delivery time preferences
    const { data: prefs } = await serviceClient
      .from('user_preferences')
      .select('user_id, brief_delivery_time');

    const prefMap = new Map<string, string>();
    for (const p of prefs ?? []) {
      if (p.brief_delivery_time) prefMap.set(p.user_id, p.brief_delivery_time);
    }

    // Get today's already-generated digests
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const { data: existingDigests } = await serviceClient
      .from('brief_digests')
      .select('user_id, generated_at')
      .gte('generated_at', todayStart.toISOString());

    const alreadyGenerated = new Set((existingDigests ?? []).map(d => d.user_id));

    let generated = 0;
    let skipped = 0;

    for (const user of users) {
      if (!user.email) continue;
      if (alreadyGenerated.has(user.id)) { skipped++; continue; }

      // Determine user's preferred hour (ET)
      // brief_delivery_time is stored as "HH:MM" in ET (from the dropdown)
      const deliveryTime = prefMap.get(user.id);
      let preferredHour = 9; // default 9 AM ET
      if (deliveryTime) {
        preferredHour = parseInt(deliveryTime.split(':')[0], 10);
      }

      // Skip hour check if ?force=true (for testing)
      const forceAll = new URL(request.url).searchParams.get('force') === 'true';
      if (!forceAll && currentHourET !== preferredHour) { skipped++; continue; }

      // Get user's holdings
      const { data: holdings } = await serviceClient
        .from('holdings')
        .select('ticker')
        .eq('user_id', user.id);

      const userTickers = [...new Set((holdings ?? []).map(h => h.ticker.toUpperCase()))];

      try {
        const result = userTickers.length > 0
          ? await generateDigest(userTickers)
          : await generateGenericDigest();

        // Upsert — one digest per user
        await serviceClient
          .from('brief_digests')
          .upsert({
            user_id: user.id,
            digest: result.digest,
            holdings: result.holdings,
            generated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });

        generated++;
        log.push(`[digest] Generated for ${user.email.slice(0, 4)}... (${result.tokens} tokens, ${userTickers.length} holdings)`);
      } catch (err) {
        log.push(`[digest] Failed for ${user.email.slice(0, 4)}...: ${err instanceof Error ? err.message : 'unknown'}`);
      }
    }

    return NextResponse.json({
      success: true,
      generated,
      skipped,
      current_hour_et: currentHourET,
      duration_ms: Date.now() - startTime,
      log,
    });
  } catch (error) {
    console.error('[cron/digest] Fatal error:', error);
    return NextResponse.json({ error: 'Digest cron failed' }, { status: 500 });
  }
}
