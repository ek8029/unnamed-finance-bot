import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateTaxReport } from '@/lib/tax-analysis';
import { requirePro } from '@/lib/tier';
import { isThesisUser } from '@/lib/thesis-access';
import { getConvictionByTicker } from '@/lib/thesis-conviction';

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

    // Thesis-aware TLH: stamp each opportunity with its conviction so the UI can
    // tailor the harvest guidance (broken -> consider exiting; intact -> tax move
    // only). Gated to thesis users; plain TLH for everyone else.
    if (isThesisUser(user.email)) {
      const conviction = await getConvictionByTicker(supabase, user.id);
      if (conviction.size > 0) {
        for (const p of [...report.opportunities, ...report.retirementPositions]) {
          const c = conviction.get(p.ticker.toUpperCase());
          if (c) p.thesisStatus = c;
        }
      }
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error('Tax opportunities failed:', error);
    return NextResponse.json({ error: 'Failed to generate tax report' }, { status: 500 });
  }
}
