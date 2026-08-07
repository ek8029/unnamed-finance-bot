// GET /api/scan/house?symbols=NVDA,TSM,...
//
// Status only, for the cold open's opening grid. The first screen used to be an
// inert form: six dead chips asking a question before the product had shown it
// could do anything. This makes the grid itself the information — each name
// carries its REAL current thesis status, so a person can see Helm is already
// running before they tap, and picking becomes choosing which live thing to
// open rather than filling in a field.
//
// Deliberately NOT /api/scan/ticker in a loop: this returns no claims, no
// citations and no evidence. Rendering somebody else's findings before the user
// has chosen a name is the testimonial problem, and it is what got an earlier
// prefetch removed. A status is the state of the world, not a result.
//
// One indexed read per symbol, no model call. Capped at 12.

import { NextResponse } from 'next/server';
import { getTickerThesisData } from '@/lib/content/public-thesis';
import { rateLimit, getClientIP } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const MAX_SYMBOLS = 12;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = (searchParams.get('symbols') ?? '')
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(s => /^[A-Z.]{1,6}$/.test(s))
    .slice(0, MAX_SYMBOLS);

  if (symbols.length === 0) {
    return NextResponse.json({ error: 'No symbols' }, { status: 400 });
  }

  const limit = rateLimit(`scan-house:${getClientIP(request)}`, 20, 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const results = await Promise.all(
    symbols.map(async (ticker) => {
      try {
        const d = await getTickerThesisData(ticker);
        if (!d) return null;
        return { ticker: d.ticker, company: d.company, health: d.health, lastChecked: d.lastChecked };
      } catch {
        // One bad symbol must not blank the whole grid; it just goes statusless.
        return null;
      }
    }),
  );

  return NextResponse.json(
    { statuses: results.filter(Boolean) },
    { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=900' } },
  );
}
