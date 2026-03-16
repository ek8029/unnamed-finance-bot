import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateEarningsReport } from '@/lib/earnings-analysis';
import { requirePro } from '@/lib/tier';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { allowed } = await requirePro(user.id);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Earnings impact analysis is a Pro feature.', code: 'PRO_REQUIRED' },
      { status: 403 },
    );
  }

  try {
    const report = await generateEarningsReport(user.id);
    return NextResponse.json(report);
  } catch (error) {
    console.error('Earnings report failed:', error);
    return NextResponse.json({ error: 'Failed to generate earnings report' }, { status: 500 });
  }
}
