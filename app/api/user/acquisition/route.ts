// POST /api/user/acquisition — "how did you find Helm?"
//
// Self-report, because UTM cannot see the channel Helm is betting on: an AI
// assistant citing Helm produces no referrer and no UTM, and neither does a
// name passed between two people.
//
// Write-once by default. Re-asking someone who already answered is a tax, and
// letting a later answer overwrite an earlier one would quietly rewrite the
// attribution history this exists to measure.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** The slugs the UI offers. Anything else is rejected rather than stored, so
 *  the column stays groupable; the free-text answer rides in `detail`. */
const SOURCES = new Set([
  'ai_assistant',
  'google',
  'friend',
  'blog_newsletter',
  'hacker_news',
  'reddit',
  'x',
  'tiktok',
  'linkedin',
  // Retired: 'social' was a combined "TikTok or LinkedIn" tile, which could not
  // tell the two channels apart in the data. They are separate options now.
  // Still accepted because a phone can be running an older bundle.
  'social',
  'other',
]);

const MAX_DETAIL = 200;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { source?: unknown; detail?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }

    const source = typeof body.source === 'string' ? body.source.trim() : '';
    if (!SOURCES.has(source)) {
      return NextResponse.json({ error: 'Unknown source' }, { status: 400 });
    }

    // Free text is user input on a surface that feeds a dashboard. Cap it and
    // store it verbatim otherwise — never interpolate it anywhere as markup.
    const rawDetail = typeof body.detail === 'string' ? body.detail.trim() : '';
    const detail = rawDetail ? rawDetail.slice(0, MAX_DETAIL) : null;

    const { data: existing } = await supabase
      .from('user_profiles')
      .select('acquisition_source')
      .eq('id', user.id)
      .maybeSingle();

    // Already answered: succeed without changing anything, so a double-tap or a
    // replayed request is harmless and the first answer is the one that stands.
    if (existing?.acquisition_source) {
      return NextResponse.json({ ok: true, alreadyAnswered: true });
    }

    const { error } = await supabase
      .from('user_profiles')
      .update({
        acquisition_source: source,
        acquisition_detail: detail,
        acquisition_answered_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      console.error('[user/acquisition] update failed:', error);
      return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[user/acquisition] unhandled:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
