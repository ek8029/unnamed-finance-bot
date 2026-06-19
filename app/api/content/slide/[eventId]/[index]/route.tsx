import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isThesisUser } from '@/lib/thesis-access';
import { toSlides } from '@/lib/content/slides';
import { buildSlideImage, type EventRow } from '@/lib/content/slide-render';

export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string; index: string }> }) {
  // Admin-only: drafts are internal until Evan posts them manually.
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!isThesisUser(user?.email)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { eventId, index } = await params;
  const idx = Number(index);
  if (!Number.isInteger(idx) || idx < 0 || idx > 5) {
    return new Response('Bad index', { status: 400 });
  }

  const supabase = await createServiceClient();
  const [{ data: queue }, { data: event }] = await Promise.all([
    supabase.from('content_queue').select('slide_copy').eq('event_id', eventId).maybeSingle(),
    supabase
      .from('content_events')
      .select('ticker, company, verdict, verbatim_cite, cite_date, source_url, pillar_claim')
      .eq('id', eventId)
      .maybeSingle(),
  ]);

  if (!queue) {
    return new Response('Not found', { status: 404 });
  }

  const slides = toSlides(queue.slide_copy as { title: string; body: string }[]);
  const slide = slides[idx];
  if (!slide) {
    return new Response('Bad index', { status: 400 });
  }

  const ev: EventRow = (event as EventRow) || {
    ticker: null,
    company: null,
    verdict: null,
    verbatim_cite: null,
    cite_date: null,
    source_url: null,
    pillar_claim: null,
  };

  return buildSlideImage(slide, ev);
}
