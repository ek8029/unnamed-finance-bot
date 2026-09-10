// GET /api/thesis/earnings?tickers=NVDA,MSFT
//
// Next estimated earnings date per ticker, for the Earnings column on the
// theses table.
//
// A thin read and nothing else: no database, no user data in the response, no
// derivation beyond what lib/earnings-edgar already does for the same tickers.
// It exists because getEdgarEarnings() is one SEC HTTP call per ticker, and
// doing up to thirty of them inside the /dashboard/theses server render put an
// external vendor on the critical path of a page about the user's own theses.
// Measured 2026-09-10: 341 to 666ms for 21 tickers on a cold process, 1ms once
// the in-memory hour cache is warm. The table now paints first and fills this in.
//
// A session is still required, and the ticker list is capped and validated, so
// this cannot be used as an open proxy to SEC on Helm's rate limit.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getEdgarEarnings } from '@/lib/earnings-edgar';
import { parseResearchTicker } from '@/lib/research-ticker';

export const dynamic = 'force-dynamic';

/** Matches MAX_THESES on the table: the column can never ask for more rows than that. */
const MAX_TICKERS = 30;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const requested = (new URL(request.url).searchParams.get('tickers') ?? '')
    .split(',')
    .map((t) => parseResearchTicker(t))
    .flatMap((p) => (p.ok ? [p.ticker] : []));
  const tickers = [...new Set(requested)].slice(0, MAX_TICKERS);

  const earnings: Record<string, string | null> = {};
  // getEdgarEarnings never throws: it returns nulls on any failure.
  await Promise.all(
    tickers.map(async (ticker) => {
      earnings[ticker] = (await getEdgarEarnings(ticker)).nextEstimatedDate;
    }),
  );

  return NextResponse.json({ earnings });
}
