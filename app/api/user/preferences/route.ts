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
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
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

    // Upsert preferences (insert if not exists, update if exists)
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: user.id,
        ...updates,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating preferences:', error);
      return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
    }

    return NextResponse.json({ preferences: data });
  } catch (error) {
    console.error('Error in preferences PATCH:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
