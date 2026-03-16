import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateTaxReport } from '@/lib/tax-analysis';
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
      { error: 'Tax-loss harvesting intelligence is a Pro feature.', code: 'PRO_REQUIRED' },
      { status: 403 },
    );
  }

  try {
    const report = await generateTaxReport(user.id);
    return NextResponse.json(report);
  } catch (error) {
    console.error('Tax opportunities failed:', error);
    return NextResponse.json({ error: 'Failed to generate tax report' }, { status: 500 });
  }
}
