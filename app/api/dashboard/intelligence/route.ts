import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateDailyInsights, FREE_INSIGHT_SOURCES } from '@/lib/intelligence-feed';
import { getUserTier, tierAtLeast } from '@/lib/tier';

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
    const [insights, tier] = await Promise.all([
      generateDailyInsights(user.id),
      getUserTier(user.id),
    ]);

    if (tierAtLeast(tier, 'pro')) {
      return NextResponse.json({ insights, tier });
    }

    // Free tier "basic alerts": cash flow anomalies + performance highlights only
    const basicInsights = insights.filter(i =>
      FREE_INSIGHT_SOURCES.includes(i.source)
    );

    return NextResponse.json({ insights: basicInsights, tier });
  } catch (error) {
    console.error('Intelligence feed failed:', error);
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 });
  }
}
