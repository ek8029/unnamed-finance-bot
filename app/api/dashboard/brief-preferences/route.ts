import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

// ── GET: Return user's brief delivery time ──

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limited = rateLimit(`brief-prefs:${user.id}`, 20, 60);
    if (!limited.allowed) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: limited.retryAfterSeconds },
        { status: 429 },
      );
    }

    const { data, error } = await supabase
      .from('user_preferences')
      .select('brief_delivery_time')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[brief-preferences] GET error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch preferences' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      deliveryTime: data?.brief_delivery_time ?? null,
    });
  } catch (error) {
    console.error('[brief-preferences] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 },
    );
  }
}

// ── PUT: Update brief delivery time ──

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limited = rateLimit(`brief-prefs:${user.id}`, 20, 60);
    if (!limited.allowed) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: limited.retryAfterSeconds },
        { status: 429 },
      );
    }

    const body = await request.json();
    const { deliveryTime } = body;

    // Validate: must be null or HH:MM format
    if (deliveryTime !== null && deliveryTime !== undefined) {
      if (typeof deliveryTime !== 'string' || !TIME_REGEX.test(deliveryTime)) {
        return NextResponse.json(
          { error: 'Invalid time format. Use HH:MM (e.g. "07:00", "09:30") or null to clear.' },
          { status: 400 },
        );
      }
    }

    const timeValue = deliveryTime ?? null;

    // Upsert: create preferences row if it doesn't exist, update if it does
    const { error: upsertError } = await supabase
      .from('user_preferences')
      .upsert(
        {
          user_id: user.id,
          brief_delivery_time: timeValue,
        },
        { onConflict: 'user_id' },
      );

    if (upsertError) {
      console.error('[brief-preferences] PUT upsert error:', upsertError);
      return NextResponse.json(
        { error: 'Failed to update preferences' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      deliveryTime: timeValue,
    });
  } catch (error) {
    console.error('[brief-preferences] PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 },
    );
  }
}
