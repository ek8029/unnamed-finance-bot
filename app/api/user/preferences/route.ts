import { createClient } from '@/lib/supabase/server';
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

    const allowedFields = [
      'theme', 'density', 'currency', 'number_format', 'date_format',
      'notification_market_alerts', 'notification_transaction_alerts',
      'notification_budget_alerts', 'notification_tax_reminders',
      'notification_weekly_digest', 'notification_monthly_report',
      'notification_daily_brief',
      'reduce_motion', 'high_contrast', 'large_text', 'screen_reader_optimized',
      'analytics_enabled', 'crash_reporting_enabled',
      'filing_status', 'tax_bracket', 'tax_state',
    ];
    const sanitized: Record<string, unknown> = {};
    for (const field of allowedFields) {
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
