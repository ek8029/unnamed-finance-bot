import { NextResponse } from 'next/server';
import { selectTopEvents } from '@/lib/content/select';
import { generateContent } from '@/lib/content/generate';
import { validateContent } from '@/lib/content/validate';
import { createServiceClient } from '@/lib/supabase/server';

// Depends on market_news being populated by the news-refresh cron earlier in the day.
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const runDate = new Date().toISOString().slice(0, 10);
  const supabase = await createServiceClient();

  // Harvest several candidates a day (one best hit per ticker) so /masthead stays fresh
  // on popular names. Each is queued as a draft for one-click review at /admin.
  const events = await selectTopEvents(runDate, 5);

  // Dedup against events stored in the last ~35d so reruns never double-queue the same cite.
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  const since = new Date(Date.now() - 35 * 86400000).toISOString().slice(0, 10);
  const { data: recent } = await supabase
    .from('content_events')
    .select('ticker, verbatim_cite')
    .gte('run_date', since);
  const seen = new Set((recent ?? []).map((e) => `${e.ticker}|${norm(e.verbatim_cite)}`));

  const results: string[] = [];
  for (const event of events) {
    const dkey = `${event.ticker}|${norm(event.verbatimCite)}`;
    if (seen.has(dkey)) { results.push(`${event.ticker}:dup`); continue; }
    seen.add(dkey);

    const { data: ev } = await supabase.from('content_events').insert({
      run_date: runDate, ticker: event.ticker, company: event.company, pillar_id: event.pillarId,
      pillar_claim: event.pillarClaim, verdict: event.verdict, verbatim_cite: event.verbatimCite,
      cite_date: event.citeDate, source_url: event.sourceUrl, source_type: event.sourceType,
      summary: event.summary, newsworthiness: event.newsworthiness, selected: true,
    }).select('id').maybeSingle();
    if (!ev) { results.push(`${event.ticker}:insert-failed`); continue; }

    const content = await generateContent({ ...event, id: ev.id });
    const check = validateContent(event, content);
    if (!check.ok) { results.push(`${event.ticker}:validation-failed`); continue; }

    await supabase.from('content_queue').insert({
      event_id: ev.id, status: 'draft', x_thread: content.xThread, linkedin_post: content.linkedinPost,
      caption: content.caption, slide_copy: [], disclaimer: content.disclaimer,
    });
    results.push(`${event.ticker}:queued`);
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

  return NextResponse.json({ status: 'ok', queued: results.filter((r) => r.endsWith('queued')).length, results });
}
