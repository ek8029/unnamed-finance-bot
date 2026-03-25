import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { generateInsights } from '@/lib/insights-engine';
import { rateLimit } from '@/lib/rate-limit';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { allowed } = rateLimit(`insights-generate:${user.id}`, 5, 600);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const count = await generateInsights(supabase, user.id);

    return NextResponse.json({
      success: true,
      generated: count,
    });
  } catch (error) {
    console.error('Error generating insights:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
