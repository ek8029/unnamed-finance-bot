import { ImageResponse } from 'next/og';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isThesisUser } from '@/lib/thesis-access';
import { toSlides } from '@/lib/content/slides';

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
  const { data } = await supabase
    .from('content_queue')
    .select('slide_copy')
    .eq('event_id', eventId)
    .maybeSingle();

  if (!data) {
    return new Response('Not found', { status: 404 });
  }

  const slides = toSlides(data.slide_copy as { title: string; body: string }[]);
  const slide = slides[idx];
  if (!slide) {
    return new Response('Bad index', { status: 400 });
  }

  return new ImageResponse(
    (
      <div
        style={{
          background: '#060606',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 80,
          fontFamily: 'sans-serif',
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            display: 'flex',
            fontSize: 28,
            fontWeight: 700,
            color: '#E6B94D',
            letterSpacing: '0.25em',
            textTransform: 'uppercase' as const,
          }}
        >
          Helm Terminal
        </div>

        {/* Title + body */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 64,
              fontWeight: 800,
              color: '#FAFAFA',
              lineHeight: 1.1,
            }}
          >
            {slide.title}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 36,
              color: '#C8C8C8',
              lineHeight: 1.4,
              marginTop: 36,
            }}
          >
            {slide.body}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            fontSize: 28,
            color: '#C8C8C8',
            letterSpacing: '0.04em',
          }}
        >
          helmterminal.dev/analyze
        </div>
      </div>
    ),
    { width: 1080, height: 1350 },
  );
}
