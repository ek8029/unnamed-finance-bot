import { NextRequest, NextResponse } from 'next/server';
import { createStaticServiceClient } from '@/lib/supabase/server';
import { TOP_TICKERS } from '@/lib/top-tickers';

// Lightweight ticker autocomplete for the command palette. Matches against the
// shared securities table (real company names from synced holdings) and the
// curated TOP_TICKERS symbol list, so a query returns named results where we
// have them and symbol-only results otherwise.

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Strip PostgREST filter metacharacters before interpolating into .or() —
  // commas/parens/colons would otherwise let a query inject filter logic.
  const q = (req.nextUrl.searchParams.get('q') || '')
    .replace(/[(),:*%]/g, '')
    .trim()
    .slice(0, 24);
  if (!q) return NextResponse.json({ results: [] });

  const upper = q.toUpperCase();
  const results: { ticker: string; name: string }[] = [];
  const seen = new Set<string>();

  // 1. Named matches from securities (ticker or company name).
  try {
    const db = createStaticServiceClient();
    const { data } = await db
      .from('securities')
      .select('ticker, security_name')
      .or(`ticker.ilike.${q}%,security_name.ilike.%${q}%`)
      .limit(8);
    for (const s of (data || []) as { ticker: string; security_name: string | null }[]) {
      const t = (s.ticker || '').toUpperCase();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      results.push({ ticker: t, name: s.security_name || t });
    }
  } catch {
    // securities lookup is best-effort — fall back to symbol matches below.
  }

  // 2. Symbol matches from the curated list (no company name available).
  for (const t of TOP_TICKERS) {
    if (results.length >= 8) break;
    if (t.toUpperCase().startsWith(upper) && !seen.has(t.toUpperCase())) {
      seen.add(t.toUpperCase());
      results.push({ ticker: t, name: t });
    }
  }

  return NextResponse.json({ results: results.slice(0, 8) });
}
