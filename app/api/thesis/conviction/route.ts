import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasThesisAccess } from '@/lib/thesis-access-server';
import {
  convictionTrend,
  recentTransitions,
  type HistoryPillar,
  type HistoryEvidence,
} from '@/lib/thesis-history';

// GET /api/thesis/conviction — honest 14-day conviction history for the signed-in
// user: an intact-count trend and the real status transitions, both derived by
// replaying derivePillarStatus over each evidence row's true publish date. Read-only;
// computes from existing evidence, never writes or fabricates.
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
      console.error('[thesis] GET conviction theses error:', thesesError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const tickerById = new Map((theses ?? []).map((t) => [t.id as string, t.ticker as string]));
    const thesisIds = (theses ?? []).map((t) => t.id);
    if (thesisIds.length === 0) {
      return NextResponse.json({ trend: [], transitions: [] });
    }

    const { data: pillars, error: pillarsError } = await supabase
      .from('thesis_pillars')
      .select('id, thesis_id, claim, confirmed, lifecycle')
      .in('thesis_id', thesisIds)
      .eq('user_id', user.id)
      .neq('lifecycle', 'dismissed');
    if (pillarsError) {
      console.error('[thesis] GET conviction pillars error:', pillarsError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const pillarRows = pillars ?? [];
    const pillarIds = pillarRows.map((p) => p.id as string);

    const evByPillar = new Map<string, HistoryEvidence[]>();
    if (pillarIds.length > 0) {
      const { data: evidence, error: evidenceError } = await supabase
        .from('pillar_evidence')
        .select('pillar_id, verdict, materiality, source_type, source_key, source_published_at, created_at')
        .in('pillar_id', pillarIds);
      if (evidenceError) {
        console.error('[thesis] GET conviction evidence error:', evidenceError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }
      for (const e of evidence ?? []) {
        const arr = evByPillar.get(e.pillar_id as string) ?? [];
        arr.push({
          verdict: e.verdict as HistoryEvidence['verdict'],
          materiality: e.materiality as HistoryEvidence['materiality'],
          source_type: e.source_type as HistoryEvidence['source_type'],
          source_key: e.source_key as string,
          source_published_at: (e.source_published_at as string | null) ?? null,
          created_at: e.created_at as string,
        });
        evByPillar.set(e.pillar_id as string, arr);
      }
    }

    const history: HistoryPillar[] = pillarRows.map((p) => ({
      id: p.id as string,
      ticker: tickerById.get(p.thesis_id as string) ?? '?',
      claim: p.claim as string,
      confirmed: p.confirmed as boolean,
      lifecycle: p.lifecycle as string,
      evidence: evByPillar.get(p.id as string) ?? [],
    }));

    const now = new Date();
    return NextResponse.json({
      trend: convictionTrend(history, now, 14),
      transitions: recentTransitions(history, now, 14),
    });
  } catch (err) {
    console.error('[thesis] GET conviction unhandled error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
