import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const priority = searchParams.get('priority');
    const archived = searchParams.get('archived');

    let query = supabase
      .from('insights')
      .select('*')
      .eq('user_id', user.id);

    if (archived === 'true') {
      // Show archived insights
      query = query.eq('is_archived', true);
    } else {
      // Default view: non-dismissed, non-archived, and not currently snoozed
      query = query
        .eq('is_dismissed', false)
        .eq('is_archived', false)
        .or('snoozed_until.is.null,snoozed_until.lte.' + new Date().toISOString());
    }

    if (type) {
      query = query.eq('insight_type', type);
    }

    if (priority) {
      query = query.eq('priority', priority);
    }

    const { data: insights, error } = await query
      .order('priority', { ascending: true }) // critical, high, medium, low
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching insights:', error);
      return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 });
    }

    // Transform and deduplicate by title (keep the newest)
    const seenTitles = new Set<string>();
    const transformedInsights = (insights || [])
      .map(insight => ({
        id: insight.id,
        type: insight.insight_type,
        priority: insight.priority,
        title: insight.title,
        description: insight.description,
        recommended_action: insight.recommended_action,
        estimated_impact: insight.estimated_impact_amount,
        source: insight.source_type,
        created_at: insight.created_at,
        expires_at: insight.expires_at,
        snoozed_until: insight.snoozed_until,
        is_archived: insight.is_archived,
      }))
      .filter(insight => {
        if (seenTitles.has(insight.title)) return false;
        seenTitles.add(insight.title);
        return true;
      });

    return NextResponse.json({ insights: transformedInsights });
  } catch (error) {
    console.error('Error in insights route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, action, feedback, snooze_days } = body;

    if (!id || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case 'dismiss':
        updateData = { is_dismissed: true };
        break;
      case 'useful':
        updateData = { is_useful: true };
        break;
      case 'not_useful':
        updateData = { is_useful: false };
        break;
      case 'feedback':
        updateData = { user_feedback: feedback };
        break;
      case 'snooze': {
        if (!snooze_days || snooze_days < 1) {
          return NextResponse.json({ error: 'snooze_days is required and must be >= 1' }, { status: 400 });
        }
        const snoozedUntil = new Date();
        snoozedUntil.setDate(snoozedUntil.getDate() + snooze_days);
        updateData = { snoozed_until: snoozedUntil.toISOString() };
        break;
      }
      case 'archive':
        updateData = { is_archived: true, is_dismissed: true };
        break;
      case 'unarchive':
        updateData = { is_archived: false, is_dismissed: false };
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const { error } = await supabase
      .from('insights')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error updating insight:', error);
      return NextResponse.json({ error: 'Failed to update insight' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in insights PATCH:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
