// GET /api/agent/worklog — "what Helm did while you were away".
// A platform-wide agent work log (not just theses): synced accounts, re-priced
// positions, re-read filings/news against your theses, ran risk scans, flagged
// items, wrote your brief. Every line is a REAL per-user timestamped row already
// written by the daily + score-theses crons. Pure DB read, zero LLM, RLS-scoped.
//
// The builder lives in lib/agent/worklog so the dev lab can run it for any
// account with the service client; this route is the signed-in caller's view.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildWorklog, EMPTY_WORKLOG } from '@/lib/agent/worklog';

export type { WorklogKind, WorklogStep, WorklogResponse } from '@/lib/agent/worklog';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const res = await buildWorklog(supabase, user.id);
    return NextResponse.json(res);
  } catch (err) {
    console.error('[worklog] unhandled error:', err);
    return NextResponse.json(EMPTY_WORKLOG);
  }
}
