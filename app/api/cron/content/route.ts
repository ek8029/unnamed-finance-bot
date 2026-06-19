import { NextResponse } from 'next/server';
import { selectTopEvent } from '@/lib/content/select';
import { generateContent } from '@/lib/content/generate';
import { validateContent } from '@/lib/content/validate';
import { createServiceClient } from '@/lib/supabase/server';

// Depends on market_news being populated by the news-refresh cron earlier in the day.
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const runDate = new Date().toISOString().slice(0, 10);
  const event = await selectTopEvent(runDate);
  if (!event) return NextResponse.json({ status: 'no-event' });
  const supabase = await createServiceClient();
  const { data: ev } = await supabase.from('content_events').insert({
    run_date: runDate, ticker: event.ticker, company: event.company, pillar_id: event.pillarId,
    pillar_claim: event.pillarClaim, verdict: event.verdict, verbatim_cite: event.verbatimCite,
    cite_date: event.citeDate, source_url: event.sourceUrl, source_type: event.sourceType,
    summary: event.summary, newsworthiness: event.newsworthiness, selected: true,
  }).select('id').maybeSingle();
  if (!ev) return NextResponse.json({ status: 'insert-failed' }, { status: 500 });
  const content = await generateContent({ ...event, id: ev.id });
  const check = validateContent(event, content);
  if (!check.ok) return NextResponse.json({ status: 'validation-failed', reasons: check.reasons, eventId: ev.id });
  await supabase.from('content_queue').insert({
    event_id: ev.id, status: 'draft', x_thread: content.xThread, linkedin_post: content.linkedinPost,
    caption: content.caption, slide_copy: content.slideCopy, disclaimer: content.disclaimer,
  });
  return NextResponse.json({ status: 'queued', eventId: ev.id });
}
