// GET /api/thesis/activity — grounded "what Helm did" agent feed.
// Each live (non-backfill) pillar_evidence row is one timestamped agent action:
// the monitor re-read a filing/news source against a pillar and reached a verdict.
// Pure DB read, zero LLM. RLS scopes everything to the caller.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export interface ActivityEvent {
  id: string;
  ts: string; // created_at ISO
  ticker: string;
  thesisId: string;
  claim: string; // pillar claim the source was tested against
  verdict: 'supports' | 'contradicts' | 'neutral';
  materiality: 'material' | 'context';
  pillarStatus: 'intact' | 'weakening' | 'broken' | 'unverified';
  sourceType: string;
  source: string | null; // source_title
  url: string | null; // source_url
  flagged: boolean; // contradicts + material => needs review
  broke: boolean; // this contradiction sits on a now-broken pillar (matches the email)
}

export interface ActivityResponse {
  heartbeat: { count: number; lastScan: string | null };
  events: ActivityEvent[];
}

const EMPTY: ActivityResponse = { heartbeat: { count: 0, lastScan: null }, events: [] };

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: theses } = await supabase
      .from('theses')
      .select('id, ticker')
      .eq('user_id', user.id);

    const tickerByThesis = new Map<string, string>();
    for (const t of theses ?? []) tickerByThesis.set(t.id, t.ticker);
    const thesisIds = [...tickerByThesis.keys()];
    if (thesisIds.length === 0) return NextResponse.json(EMPTY);

    const { data: pillars } = await supabase
      .from('thesis_pillars')
      .select('id, thesis_id, claim, status, status_override')
      .in('thesis_id', thesisIds)
      .eq('user_id', user.id);

    const pillarMeta = new Map<string, { thesisId: string; claim: string; status: string }>();
    for (const p of pillars ?? []) {
      pillarMeta.set(p.id, {
        thesisId: p.thesis_id,
        claim: p.claim,
        // status_override (user-set) wins over the derived status, mirroring the UI.
        status: (p.status_override as string | null) ?? (p.status as string) ?? 'unverified',
      });
    }

    const { data: ev } = await supabase
      .from('pillar_evidence')
      .select('id, pillar_id, verdict, materiality, source_type, source_title, source_url, created_at')
      .eq('user_id', user.id)
      .eq('is_backfill', false)
      .order('created_at', { ascending: false })
      .limit(20);

    const events: ActivityEvent[] = [];
    for (const e of ev ?? []) {
      const meta = pillarMeta.get(e.pillar_id as string);
      if (!meta) continue;
      const ticker = tickerByThesis.get(meta.thesisId);
      if (!ticker) continue;
      const verdict = e.verdict as ActivityEvent['verdict'];
      const materiality = e.materiality as ActivityEvent['materiality'];
      const pillarStatus = meta.status as ActivityEvent['pillarStatus'];
      events.push({
        id: e.id as string,
        ts: e.created_at as string,
        ticker,
        thesisId: meta.thesisId,
        claim: meta.claim,
        verdict,
        materiality,
        pillarStatus,
        sourceType: (e.source_type as string) ?? 'source',
        source: (e.source_title as string) ?? null,
        url: (e.source_url as string) ?? null,
        flagged: verdict === 'contradicts' && materiality === 'material',
        broke: verdict === 'contradicts' && pillarStatus === 'broken',
      });
    }

    const lastScan = events[0]?.ts ?? null;
    const res: ActivityResponse = { heartbeat: { count: tickerByThesis.size, lastScan }, events };
    return NextResponse.json(res);
  } catch (err) {
    console.error('[activity] unhandled error:', err);
    return NextResponse.json(EMPTY);
  }
}
