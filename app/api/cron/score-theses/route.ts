import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { scoreAllTheses } from '@/lib/score-theses';
import { sendBreachAlerts } from '@/lib/thesis-breach';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

export async function GET(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
    }
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Missing required environment variables' }, { status: 500 });
    }
    const serviceClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const url = new URL(request.url);
    const ticker = url.searchParams.get('ticker') ?? undefined;

    const result = await scoreAllTheses(serviceClient, ticker);

    const breachesSent = await sendBreachAlerts(serviceClient, result.breaches, result.log);

    return NextResponse.json({
      ok: true,
      ticker: ticker ?? 'all',
      scanned: result.scanned,
      evidenceAdded: result.evidenceAdded,
      statusChanges: result.statusChanges,
      breachesSent,
      log: result.log,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
