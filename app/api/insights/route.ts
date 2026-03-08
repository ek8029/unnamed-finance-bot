import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: insights, error } = await supabase
      .from('insights')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_dismissed', false)
      .order('priority', { ascending: true }) // critical, high, medium, low
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching insights:', error);
      return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 });
    }

    // Transform to match frontend expectations
    const transformedInsights = insights?.map(insight => ({
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
    }));

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
    const { id, action, feedback } = body;

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
