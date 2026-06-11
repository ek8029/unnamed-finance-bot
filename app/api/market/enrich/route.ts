import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCompanyProfileEdgar } from '@/lib/edgar';
import { mapSicToSector, getTickerSectorOverride } from '@/lib/market-classify';
import { rateLimit } from '@/lib/rate-limit';

/**
 * POST /api/market/enrich
 *
 * Enriches securities metadata (sector, industry) for the user's holdings
 * from SEC EDGAR company submissions. Only fetches for securities missing
 * sector data to avoid unnecessary API calls.
 *
 * Dividend/split events: no provider after the Polygon migration
 * (Finazon us_stocks_essential has no corporate actions endpoint).
 */
export async function POST() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { allowed } = rateLimit(`market-enrich:${user.id}`, 3, 600);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    // Get user's holdings with their security IDs
    const { data: holdings } = await supabase
      .from('holdings')
      .select('ticker, security_id')
      .eq('user_id', user.id);

    if (!holdings || holdings.length === 0) {
      return NextResponse.json({ success: true, message: 'No holdings to enrich' });
    }

    const securityIds = [...new Set(
      holdings.map(h => h.security_id).filter(Boolean) as string[]
    )];

    const result = {
      securitiesEnriched: 0,
      dividendsFound: 0,
      splitsFound: 0,
      errors: [] as string[],
    };

    if (securityIds.length > 0) {
      const { data: securities } = await supabase
        .from('securities')
        .select('id, ticker, sector, industry, logo_url')
        .in('id', securityIds);

      // Only fetch details for securities missing sector
      const needsEnrichment = (securities || []).filter(
        s => !s.sector && s.ticker && !s.ticker.includes('-USD')
      );

      for (const sec of needsEnrichment) {
        const override = getTickerSectorOverride(sec.ticker);
        let sector: string | null = override;
        let industry: string | null = null;

        if (!sector) {
          const profile = await getCompanyProfileEdgar(sec.ticker);
          if (!profile?.sicDescription) continue;
          sector = mapSicToSector(profile.sicDescription);
          industry = profile.sicDescription;
        }

        if (!sector && !industry) continue;

        const { error: updateError } = await supabase
          .from('securities')
          .update({
            sector,
            ...(industry ? { industry } : {}),
          })
          .eq('id', sec.id);

        if (updateError) {
          result.errors.push(`enrich:${sec.ticker}`);
        } else {
          result.securitiesEnriched++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      ...result,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    console.error('Error enriching market data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
