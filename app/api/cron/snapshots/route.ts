import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { computeSnapshots } from '@/lib/plaid-sync';

// Dedicated net-worth snapshot cron. The heavy daily cron also computes
// snapshots, but it filters plaid_items to status='active' and runs under a
// 60s cap, so users get skipped and their net-worth history goes stale even
// though holdings keep syncing via webhooks. This job does ONLY the snapshot
// pass for every Plaid-connected user — cheap (reads current DB state, no
// Plaid API calls) and idempotent (computeSnapshots upserts one row per
// user+day), so it can run several times a day to keep today's point fresh.

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Missing required environment variables' }, { status: 500 });
  }

  const db = createClient(url, key, { auth: { persistSession: false } });

  // Every user with a Plaid connection, regardless of item status — snapshots
  // read current DB state, so one errored item shouldn't drop a user's history.
  const { data: items, error } = await db.from('plaid_items').select('user_id');
  if (error) {
    return NextResponse.json({ error: 'Failed to read plaid_items' }, { status: 500 });
  }
  const userIds = [...new Set((items || []).map((i) => i.user_id))];

  let ok = 0;
  const failed: string[] = [];
  for (const uid of userIds) {
    try {
      await computeSnapshots(db, uid);
      ok++;
    } catch (e) {
      failed.push(uid.slice(0, 8));
      console.error(`[cron/snapshots] failed for ${uid}:`, e);
    }
  }

  return NextResponse.json({ users: userIds.length, ok, failed });
}
