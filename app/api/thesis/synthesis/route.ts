// GET /api/thesis/synthesis - cross-thesis synthesis: finds hidden concentration
// where pillars from 2+ different tickers depend on the same underlying driver.
// Thin consumer of the clusterPillars pipeline (lib/thesis-synthesis); grounded
// (clusters may only reference real pillars) and neutral (describes concentration,
// never advises).
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { hasThesisAccess } from '@/lib/thesis-access-server';
import { getCachedClusters, type SynthPillarInput } from '@/lib/thesis-synthesis';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!(await hasThesisAccess(user.id, user.email))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { data: theses, error: thesesError } = await supabase
      .from('theses')
      .select('id, ticker')
      .eq('user_id', user.id);
    if (thesesError) {
      console.error('[synthesis] theses error:', thesesError);
      return NextResponse.json({ clusters: [], status: 'error' });
    }

    const tickerByThesis = new Map<string, string>();
    for (const t of theses ?? []) tickerByThesis.set(t.id, t.ticker);
    const thesisIds = [...tickerByThesis.keys()];
    if (thesisIds.length < 2) {
      return NextResponse.json({ clusters: [], status: 'insufficient' });
    }

    const { data: pillars, error: pillarsError } = await supabase
      .from('thesis_pillars')
      .select('id, thesis_id, claim, confirmed, lifecycle')
      .in('thesis_id', thesisIds)
      .eq('user_id', user.id)
      .eq('confirmed', true)
      .neq('lifecycle', 'dismissed');
    if (pillarsError) {
      console.error('[synthesis] pillars error:', pillarsError);
      return NextResponse.json({ clusters: [], status: 'error' });
    }

    const inputs: SynthPillarInput[] = [];
    for (const p of pillars ?? []) {
      const ticker = tickerByThesis.get(p.thesis_id);
      if (ticker && typeof p.claim === 'string' && p.claim.trim()) {
        inputs.push({ id: p.id, ticker, claim: p.claim.trim() });
      }
    }

    // Need 2+ distinct tickers for a cross-ticker driver to exist.
    const distinctTickers = new Set(inputs.map((i) => i.ticker));
    if (distinctTickers.size < 2) {
      return NextResponse.json({ clusters: [], status: 'insufficient' });
    }

    // Read the persisted clusters; recompute (one gpt-4o call) only when the pillar
    // set has changed. No per-instance recomputation, so cold starts cost nothing.
    const clusters = await getCachedClusters(supabase, openai, user.id, inputs);
    return NextResponse.json({ clusters, status: 'ok' });
  } catch (err) {
    console.error('[synthesis] unhandled error:', err);
    return NextResponse.json({ clusters: [], status: 'error' });
  }
}
