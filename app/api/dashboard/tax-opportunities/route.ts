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

  try {
    const report = await generateTaxReport(user.id);

    // The figure is free. The workings are the product.
    //
    // This route used to 403 below Pro, which meant the one deterministic
    // dollar amount Helm computes was invisible to exactly the people who had
    // not yet decided whether it was worth paying for. It is calculated from
    // lots the user already owns and waits on nothing, so showing the total
    // costs nothing and is the most honest thing the product can say to a free
    // account. What Pro buys is which lots, the 30-day wash-sale screening
    // across every account at once, and the Form 8949 worksheet.
    if (!allowed) {
      // NET OF WASH SALES, deliberately, and not report.totalHarvestableLoss.
      // That field sums every opportunity including §1091-blocked lots, while
      // the savings pool a few lines below it in tax-analysis skips them. Using
      // the raw total here would advertise a figure inflated by exactly the
      // quantity the paid feature then deducts, so the number would SHRINK
      // after payment. That is a refund conversation, and it is the one
      // direction this error must never run.
      const clean = report.opportunities.filter((o) => !o.washSaleRisk);
      const netLoss = clean.reduce((s, o) => s + o.unrealizedLoss, 0);

      // "Nothing to harvest" and "nothing connected" are different sentences.
      // Most accounts have no holdings at all, so without this the dominant
      // rendering of this screen would tell someone Helm checked every lot they
      // hold when it checked nothing.
      const { count: holdingsCount } = await supabase
        .from('holdings')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      return NextResponse.json({
        teaser: true,
        totalHarvestableLoss: netLoss,
        totalEstimatedSavings: report.totalEstimatedSavings,
        opportunityCount: clean.length,
        hasHoldings: (holdingsCount ?? 0) > 0,
        disclaimer: report.disclaimer,
      });
    }

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
