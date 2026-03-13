import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateEarningsReport } from '@/lib/earnings-analysis';

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
    const report = await generateEarningsReport(user.id);
    return NextResponse.json(report);
  } catch (error) {
    console.error('Earnings report failed:', error);
    return NextResponse.json({ error: 'Failed to generate earnings report' }, { status: 500 });
  }
}
