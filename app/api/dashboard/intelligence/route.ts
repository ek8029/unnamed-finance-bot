import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateDailyInsights } from '@/lib/intelligence-feed';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const insights = await generateDailyInsights(user.id);
    return NextResponse.json({ insights });
  } catch (error) {
    console.error('Intelligence feed failed:', error);
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 });
  }
}
