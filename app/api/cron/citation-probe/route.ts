import { NextResponse } from 'next/server';
import { runCitationProbe } from '@/lib/citation-probe';
import { createServiceClient } from '@/lib/supabase/server';

// Weekly AEO/GEO scoreboard cron. Asks a web-search model the queries Helm wants to
// own and stores whether helmterminal.dev shows up. 9 sequential web-search calls,
// comfortably under the limit.
export const maxDuration = 120;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const date = new Date().toISOString().slice(0, 10);
    const result = await runCitationProbe({ date });
    const db = await createServiceClient();
    const { error } = await db.from('citation_probe_runs').insert({
      run_date: result.date,
      model: result.model,
      hits: result.hits,
      total: result.total,
      details: result.rows,
    });
    if (error) {
      console.error('[citation-probe] insert failed:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    console.log(`[citation-probe] ${result.date} ${result.hits}/${result.total} (${result.model})`);
    return NextResponse.json({ ok: true, date: result.date, hits: result.hits, total: result.total });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'probe failed';
    console.error('[citation-probe]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
