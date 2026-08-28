// GET /api/scan/ticker?symbol=NVDA — the pre-connect value moment (cliff #1).
// A REAL thesis verdict + verbatim dated citation on a ticker the user TYPES,
// with zero brokerage connection. House-universe tickers return the living
// thesis (computed status + real approved catches, same data as /thesis/[ticker]).
// Off-universe tickers degrade honestly to "no Helm thesis yet — read it on Analyze"
// (never a fabricated thesis; see Delphia SEC AI-washing guardrail in the spec).

import { NextResponse } from 'next/server';
import { getTickerThesisData, type PublicPillar, type PublicCatch } from '@/lib/content/public-thesis';
import { getCompanyEntries } from '@/lib/edgar';
import { classifyScanSymbol, rankCompanyMatches } from '@/lib/scan-classify';
import { rateLimit, getClientIP } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

function newestCatch(p: PublicPillar): PublicCatch | null {
  return p.catches.length > 0 ? p.catches[0] : null; // catches are pre-sorted newest-first
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get('symbol') ?? '').trim().toUpperCase();

  if (!/^[A-Z.\-]{1,10}$/.test(raw)) {
    return NextResponse.json({ error: 'Invalid ticker format' }, { status: 400 });
  }

  const limit = rateLimit(`scan-ticker:${getClientIP(request)}`, 20, 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many scans. Try again in a moment.', retryAfterSeconds: limit.retryAfterSeconds },
      { status: 429 },
    );
  }

  try {
    const data = await getTickerThesisData(raw);

    // Off-universe: still no fabricated thesis, but say WHAT it is. An SEC
    // filer can have its pillars drafted by the signed-in client (POST
    // /api/thesis/seed, user-reviewed before anything is tracked); a name or
    // typo gets "did you mean"; gold and forex get told there is nothing to
    // read; and if EDGAR's list is down we say unknown rather than guess.
    if (!data) {
      const entries = await getCompanyEntries();
      const match = entries?.find((e) => e.ticker === raw) ?? null;
      const suggestions = entries && !match ? rankCompanyMatches(raw, entries, 3) : [];
      const { kind } = classifyScanSymbol({ house: false, filer: !!match, suggestions, known: entries !== null });
      return NextResponse.json(
        { house: false, kind, ticker: raw, company: match?.title ?? null, suggestions, analyzePath: `/analyze/${raw}` },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    }

    const catchCount = data.pillars.reduce((n, p) => n + p.catches.length, 0);

    // Feature the most informative pillar:
    // - unhealthy thesis (broken/weakening/watch) -> the pillar carrying the pressure,
    //   so the receipt shows the catch that actually moved it.
    // - healthy (intact) -> the pillar with the freshest supporting evidence.
    const severity: Record<string, number> = { broken: 4, weakening: 3, watch: 2, intact: 1, unverified: 0 };
    const unhealthy = data.health === 'broken' || data.health === 'weakening' || data.health === 'watch';
    const withCatches = data.pillars.filter((p) => p.catches.length > 0);
    const pool = withCatches.length > 0 ? withCatches : data.pillars;

    const featured = unhealthy
      ? [...pool].sort((a, b) => (severity[b.status] ?? 0) - (severity[a.status] ?? 0))[0]
      : [...pool].sort((a, b) => {
          const ad = newestCatch(a)?.dateISO ?? '';
          const bd = newestCatch(b)?.dateISO ?? '';
          return bd.localeCompare(ad);
        })[0];

    // Receipt: featured pillar's newest catch; else the newest catch anywhere; else none.
    let receipt = featured ? newestCatch(featured) : null;
    if (!receipt && catchCount > 0) {
      const all = data.pillars.flatMap((p) => p.catches);
      receipt = all.sort((a, b) => b.dateISO.localeCompare(a.dateISO))[0] ?? null;
    }

    return NextResponse.json(
      {
        house: true,
        ticker: data.ticker,
        company: data.company,
        health: data.health,
        healthLabel: data.healthLabel,
        asOfDate: data.asOfDate,
        pillarCount: data.pillars.length,
        catchCount,
        pillar: featured
          ? { claim: featured.claim, status: featured.status, statusLabel: featured.statusLabel }
          : null,
        // Every pillar Helm watches: claim, tripwire, computed status, and its own
        // cited evidence. Powers both the "Watching" card (no catch yet) and the
        // expandable "all pillars + evidence" view on receipt cards.
        pillars: data.pillars.map((p) => ({
          // The house pillar id, so a caller can adopt the specific claims a
          // person recognises as their own (POST /api/thesis/adopt pillarIds).
          id: p.id,
          claim: p.claim,
          breaksIf: p.breaks_if,
          status: p.status,
          statusLabel: p.statusLabel,
          catches: p.catches.map((c) => ({
            verbatimCite: c.verbatimCite,
            dateISO: c.dateISO,
            sourceLabel: c.sourceLabel,
            sourceUrl: c.sourceUrl,
            verdict: c.verdict,
          })),
        })),
        receipt: receipt
          ? {
              verbatimCite: receipt.verbatimCite,
              dateISO: receipt.dateISO,
              sourceLabel: receipt.sourceLabel,
              sourceUrl: receipt.sourceUrl,
              // Whether this catch supports or challenges the pillar. Never omit:
              // a contradicting quote shown unlabeled reads as supporting evidence.
              verdict: receipt.verdict,
            }
          : null,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (err) {
    console.error('[scan/ticker] error:', err);
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 });
  }
}
