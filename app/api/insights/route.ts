import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getUserTier, tierAtLeast } from '@/lib/tier';
import { readInsights } from '@/lib/insights-reader';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tier = await getUserTier(user.id);
    const insights = await readInsights(supabase, user, {
      type: searchParams.get('type'),
      priority: searchParams.get('priority'),
      status: searchParams.get('status'),
      archived: searchParams.get('archived'),
    }, tierAtLeast(tier, 'pro'));
    return NextResponse.json({ insights });
  } catch (error) {
    console.error('Error in insights route:', error);
    return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 });
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
        updateData = { is_useful: false, is_dismissed: true };
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
