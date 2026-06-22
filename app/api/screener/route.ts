import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasThesisAccess } from '@/lib/thesis-access-server';
import { summarizePillars, type SummaryPillar } from '@/lib/thesis-summary';
import type { PillarStatus } from '@/lib/thesis-status';
import type { SynthCluster } from '@/lib/thesis-synthesis';

// Thesis Screener API. Reuses the /api/thesis query pattern and lib/thesis-summary
// so a position's conviction band, score and pillar counts match the Theses page
// exactly. clusterDriver is resolved by looking the ticker up in the user's CACHED
// thesis_clusters row (no recompute, no OpenAI call here).

export type ConvictionBand = 'strong' | 'holding' | 'review';

export interface ScreenerRow {
  ticker: string;
  convictionBand: ConvictionBand;
  score: number;
  intactCount: number;
  totalCount: number;
  brokenCount: number;
  weakeningCount: number;
  worstPillarStatus: PillarStatus | null;
  sector: string | null;
  clusterDriver: string | null;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!(await hasThesisAccess(user.id, user.email))) {
      return NextResponse.json({ error: 'Pro required' }, { status: 403 });
    }

    // Theses + their pillars (mirror /api/thesis: skip dismissed pillars).
    const { data: theses, error: thesesError } = await supabase
      .from('theses')
      .select('id, ticker')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (thesesError) {
      console.error('[screener] theses fetch error:', thesesError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const thesesList = theses ?? [];
    if (thesesList.length === 0) {
      return NextResponse.json({ rows: [], clusters: [] });
    }

    const thesisIds = thesesList.map((t) => t.id);

    const { data: pillars, error: pillarsError } = await supabase
      .from('thesis_pillars')
      .select('thesis_id, confirmed, status, status_override, lifecycle')
      .in('thesis_id', thesisIds)
      .neq('lifecycle', 'dismissed')
      .eq('user_id', user.id);

    if (pillarsError) {
      console.error('[screener] pillars fetch error:', pillarsError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const pillarsByThesis = new Map<string, SummaryPillar[]>();
    for (const p of pillars ?? []) {
      const existing = pillarsByThesis.get(p.thesis_id) ?? [];
      existing.push(p as unknown as SummaryPillar);
      pillarsByThesis.set(p.thesis_id, existing);
    }

    // Sectors: join securities by ticker (shared table, no RLS).
    const tickers = [...new Set(thesesList.map((t) => (t.ticker as string).toUpperCase()))];
    const sectorByTicker = new Map<string, string>();
    const { data: securities } = await supabase
      .from('securities')
      .select('ticker, sector')
      .in('ticker', tickers);
    for (const s of (securities ?? []) as { ticker: string; sector: string | null }[]) {
      if (s.sector) sectorByTicker.set(s.ticker.toUpperCase(), s.sector);
    }

    // Cached cross-thesis clusters (one row per user). Build ticker -> driver.
    // A ticker can sit in a cluster; first cluster wins if it spans many.
    const { data: clusterRow } = await supabase
      .from('thesis_clusters')
      .select('clusters')
      .eq('user_id', user.id)
      .maybeSingle();
    const clusters: SynthCluster[] = Array.isArray(clusterRow?.clusters)
      ? (clusterRow!.clusters as SynthCluster[])
      : [];
    const driverByTicker = new Map<string, string>();
    for (const c of clusters) {
      for (const m of c.pillars ?? []) {
        const t = m.ticker.toUpperCase();
        if (!driverByTicker.has(t)) driverByTicker.set(t, c.driver);
      }
    }

    const rows: ScreenerRow[] = thesesList.map((t) => {
      const ticker = (t.ticker as string).toUpperCase();
      const summary = summarizePillars(pillarsByThesis.get(t.id) ?? []);
      const sc = summary.statusCounts;
      const intact = sc.intact;
      const total = summary.confirmedCount;
      // Worst effective status + band/score: identical derivation to the Theses page.
      const worstPillarStatus: PillarStatus | null =
        sc.broken > 0 ? 'broken' : sc.weakening > 0 ? 'weakening' : intact > 0 ? 'intact' : total > 0 ? 'unverified' : null;
      const convictionBand: ConvictionBand =
        sc.weakening > 0 || sc.broken > 0 || total === 0 || intact === 0
          ? 'review'
          : intact >= 3 && sc.weakening === 0 && sc.broken === 0
            ? 'strong'
            : 'holding';
      const score = intact - (sc.weakening + sc.broken) * 2 - (intact === 0 ? 0.5 : 0);
      return {
        ticker,
        convictionBand,
        score,
        intactCount: intact,
        totalCount: total,
        brokenCount: sc.broken,
        weakeningCount: sc.weakening,
        worstPillarStatus,
        sector: sectorByTicker.get(ticker) ?? null,
        clusterDriver: driverByTicker.get(ticker) ?? null,
      };
    });

    return NextResponse.json({ rows, clusters }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (err) {
    console.error('[screener] GET unhandled error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
