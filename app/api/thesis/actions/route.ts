import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { generateThesisActions } from '@/lib/thesis-actions';

// POST /api/thesis/actions — run the reasoned-actions pipeline for the signed-in
// user: turn broken/weakening thesis pillars into grounded, non-discretionary
// actions written into the shared `insights` table (so they appear in the Actions
// Inbox automatically and inside each thesis view). Returns the structured result.
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { allowed } = rateLimit(`thesis-actions:${user.id}`, 5, 600);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const { generated, actions } = await generateThesisActions(supabase, user.id);
    return NextResponse.json({ success: true, generated, actions });
  } catch (error) {
    console.error('[thesis] POST actions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/thesis/actions[?thesisId=] — fetch the thesis-derived actions for the
// signed-in user (open: not dismissed/archived/snoozed). Scoped to one thesis when
// thesisId is passed, so a thesis view can surface its own actions inline.
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const thesisId = searchParams.get('thesisId');

    let query = supabase
      .from('insights')
      .select(
        'id, insight_type, priority, title, description, recommended_action, explanation, estimated_impact_amount, related_entity_ids, created_at',
      )
      .eq('user_id', user.id)
      .eq('related_entity_type', 'thesis')
      .eq('is_dismissed', false)
      .eq('is_archived', false)
      .or('snoozed_until.is.null,snoozed_until.lte.' + new Date().toISOString());

    if (thesisId) {
      query = query.contains('related_entity_ids', [thesisId]);
    }

    const { data, error } = await query
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('[thesis] GET actions error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const actions = (data ?? []).map((r) => ({
      id: r.id,
      type: r.insight_type,
      priority: r.priority,
      title: r.title,
      description: r.description,
      recommended_action: r.recommended_action,
      explanation: r.explanation,
      estimated_impact: r.estimated_impact_amount,
      thesis_id: Array.isArray(r.related_entity_ids) ? r.related_entity_ids[0] : null,
      created_at: r.created_at,
    }));

    return NextResponse.json({ actions });
  } catch (error) {
    console.error('[thesis] GET actions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
