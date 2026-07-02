import { NextResponse } from 'next/server';
import { selectTopEvents, selectNoiseEvent } from '@/lib/content/select';
import { generateContent } from '@/lib/content/generate';
import { validateContent } from '@/lib/content/validate';
import { createServiceClient } from '@/lib/supabase/server';
import type { ContentEvent } from '@/lib/content/types';

// A hit at/above this is a real "catch" (see IMPACT x SOURCE_WEIGHT in select.ts);
// below it, hits are still verbatim-cited pillar-relevant material, just quieter.
const CATCH_THRESHOLD = 1.0;

// Depends on market_news being populated by the news-refresh cron earlier in the day.
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const runDate = new Date().toISOString().slice(0, 10);
  const supabase = await createServiceClient();

  // Quality ladder — guarantees the queue gets at least one draft per run:
  //   1. catches: hits clearing CATCH_THRESHOLD (up to 3)
  //   2. best hit of the day below threshold (1) — still verbatim-cited
  //   3. signal-or-noise fallback on the day's most-covered house ticker (1)
  // One scoring pass (threshold 0) feeds tiers 1-2; drafts are human-reviewed at /admin.
  const scoredAll = await selectTopEvents(runDate, 8, 0);
  const catches = scoredAll.filter((e) => e.newsworthiness >= CATCH_THRESHOLD).slice(0, 3);
  const belowBar = scoredAll.filter((e) => e.newsworthiness < CATCH_THRESHOLD);

  // Dedup against events stored in the last ~35d so reruns never double-queue the same cite.
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  const since = new Date(Date.now() - 35 * 86400000).toISOString().slice(0, 10);
  const { data: recent } = await supabase
    .from('content_events')
    .select('ticker, verbatim_cite')
    .gte('run_date', since);
  const seen = new Set((recent ?? []).map((e) => `${e.ticker}|${norm(e.verbatim_cite)}`));

  const results: string[] = [];
  let queued = 0;

  async function queueEvent(event: ContentEvent, tier: string): Promise<boolean> {
    const dkey = `${event.ticker}|${norm(event.verbatimCite)}`;
    if (seen.has(dkey)) { results.push(`${event.ticker}:dup`); return false; }
    seen.add(dkey);

    const { data: ev } = await supabase.from('content_events').insert({
      run_date: runDate, ticker: event.ticker, company: event.company, pillar_id: event.pillarId,
      pillar_claim: event.pillarClaim, verdict: event.verdict, verbatim_cite: event.verbatimCite,
      cite_date: event.citeDate, source_url: event.sourceUrl, source_type: event.sourceType,
      summary: event.summary, newsworthiness: event.newsworthiness, selected: true,
    }).select('id').maybeSingle();
    if (!ev) { results.push(`${event.ticker}:insert-failed`); return false; }

    const content = await generateContent({ ...event, id: ev.id });
    const check = validateContent(event, content);
    if (!check.ok) { results.push(`${event.ticker}:validation-failed`); return false; }

    await supabase.from('content_queue').insert({
      event_id: ev.id, status: 'draft', x_thread: content.xThread, linkedin_post: content.linkedinPost,
      caption: content.caption, slide_copy: [], disclaimer: content.disclaimer,
    });
    results.push(`${event.ticker}:queued:${tier}`);
    queued++;
    return true;
  }

  // Tier 1: every non-dup catch.
  for (const event of catches) await queueEvent(event, 'catch');

  // Tier 2: if nothing queued, the best below-threshold hit that isn't a dup.
  if (queued === 0) {
    for (const event of belowBar) {
      if (await queueEvent(event, 'best-hit')) break;
    }
  }

  // Tier 3: still nothing — signal-or-noise on the loudest house ticker.
  if (queued === 0) {
    const noise = await selectNoiseEvent(runDate);
    if (noise) await queueEvent(noise, 'signal-or-noise');
    else results.push('noise:no-candidate');
  }

  // Expiry: hard-delete drafts/rejected events older than 45d. APPROVED catches are the
  // published record — they back the permanent /thesis/[ticker] archive and RSS, so they
  // must survive past 45d. Two-step: collect approved event_ids, then delete only events
  // older than the cutoff that are NOT in that set (content_queue cascades via the FK).
  const cutoff = new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10);
  const { data: approved } = await supabase
    .from('content_queue')
    .select('event_id')
    .eq('status', 'approved');
  const approvedIds = (approved ?? []).map((r) => r.event_id).filter(Boolean);
  let expiry = supabase.from('content_events').delete().lt('run_date', cutoff);
  if (approvedIds.length > 0) {
    expiry = expiry.not('id', 'in', `(${approvedIds.join(',')})`);
  }
  await expiry;

  return NextResponse.json({ status: 'ok', queued, results });
}
