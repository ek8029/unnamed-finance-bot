import { createClient } from '@/lib/supabase/server';
import { WRITABLE_PREFERENCE_FIELDS } from '@/lib/preference-fields';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: preferences, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching preferences:', error);
      return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
    }

    // Return defaults if no preferences exist
    const defaultPreferences = {
      theme: 'dark',
      density: 'comfortable',
      currency: 'USD',
      date_format: 'MM/DD/YYYY',
      number_format: 'US',
      notification_market_alerts: true,
      notification_transaction_alerts: true,
      notification_budget_alerts: true,
      notification_tax_reminders: true,
      notification_weekly_digest: true,
      notification_monthly_report: false,
      notification_daily_brief: true,
      notification_email: true,
      notification_push: false,
      notification_push_level: 'matters',
      reduce_motion: false,
      high_contrast: false,
      large_text: false,
      screen_reader_optimized: false,
      default_tab: 'overview',
      compact_charts: false,
      show_insights: true,
      auto_refresh: false,
      refresh_interval: 5,
      analytics_enabled: true,
      crash_reporting_enabled: true,
    };

    return NextResponse.json({
      preferences: preferences || defaultPreferences,
    });
  } catch (error) {
    console.error('Error in preferences route:', error);
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

    const updates = await request.json();

    // Anything the settings UI sends that is not on this list is dropped
    // without a word, and the request still returns 200 with the row, so the
    // toggle looks saved. That is how "This Week at Helm" and the master email
    // switch became controls that did nothing: both were sent by
    // contexts/settings-context and neither was listed here. The list lives in
    // lib/preference-fields now, next to the columns the unsubscribe links
    // switch off, with a test that fails when the two drift apart.
    const sanitized: Record<string, unknown> = {};
    for (const field of WRITABLE_PREFERENCE_FIELDS) {
      if (field in updates) sanitized[field] = updates[field];
    }

    const { data, error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: user.id,
        ...sanitized,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })
      .select()
      .maybeSingle();

    if (error || !data) {
      console.error('Error updating preferences:', error);
      return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
    }

    return NextResponse.json({ preferences: data });
  } catch (error) {
    console.error('Error in preferences PATCH:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
