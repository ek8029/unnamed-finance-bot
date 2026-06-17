import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateTaxReport } from '@/lib/tax-analysis';
import { requirePro } from '@/lib/tier';
import { hasThesisAccess } from '@/lib/thesis-access-server';
import { getConvictionByTicker, getContradictionCitesByTicker } from '@/lib/thesis-conviction';

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
    if (await hasThesisAccess(user.id, user.email)) {
      const conviction = await getConvictionByTicker(supabase, user.id);
      if (conviction.size > 0) {
        for (const p of [...report.opportunities, ...report.retirementPositions]) {
          const c = conviction.get(p.ticker.toUpperCase());
          if (c) p.thesisStatus = c;
        }
        // Broken-thesis harvests: attach the best verbatim contradiction cite so the
        // Tax Center can show *why* the thesis broke (exit and harvest align).
        const brokenTickers = report.opportunities
          .filter((p) => p.thesisStatus === 'broken')
          .map((p) => p.ticker);
        if (brokenTickers.length > 0) {
          const cites = await getContradictionCitesByTicker(supabase, user.id, brokenTickers);
          for (const p of report.opportunities) {
            if (p.thesisStatus === 'broken') {
              const cite = cites.get(p.ticker.toUpperCase());
              if (cite) p.thesisCite = cite;
            }
          }
        }
      }
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error('Tax opportunities failed:', error);
    return NextResponse.json({ error: 'Failed to generate tax report' }, { status: 500 });
  }
}
