import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isThesisUser } from '@/lib/thesis-access';
import { approveDraft, rejectDraft } from './actions';

export const dynamic = 'force-dynamic';

interface DraftRow {
  id: string;
  event_id: string;
  x_thread: string[];
  linkedin_post: string;
  caption: string;
  slide_copy: { title: string; body: string }[];
  disclaimer: string;
  created_at: string;
  content_events: { ticker: string; company: string; pillar_claim: string; verdict: string } | null;
}

export default async function ContentApprovalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isThesisUser(user?.email)) {
    return (
      <div className="min-h-screen bg-[#060606] text-[#FAFAFA] flex items-center justify-center px-6">
        <p className="text-sm text-[#C8C8C8]">Not found.</p>
      </div>
    );
  }

  const db = await createServiceClient();
  const { data } = await db
    .from('content_queue')
    .select('id, event_id, x_thread, linkedin_post, caption, slide_copy, disclaimer, created_at, content_events(ticker, company, pillar_claim, verdict)')
    .eq('status', 'draft')
    .order('created_at', { ascending: false });

  const drafts = (data ?? []) as unknown as DraftRow[];

  return (
    <div className="min-h-screen bg-[#060606] text-[#FAFAFA] px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk, monospace' }}>
          Content Approval Queue
        </h1>
        <p className="mt-1 text-sm text-[#C8C8C8]">{drafts.length} draft{drafts.length === 1 ? '' : 's'} awaiting review.</p>

        {drafts.length === 0 && (
          <p className="mt-12 text-sm text-[#888]">Nothing in the queue.</p>
        )}

        <div className="mt-8 space-y-12">
          {drafts.map((d) => {
            const ev = d.content_events;
            return (
              <article key={d.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
                <header className="mb-4 flex items-baseline justify-between gap-4">
                  <div>
                    <span className="text-[#E6B94D] font-bold">{ev?.ticker ?? '—'}</span>
                    <span className="ml-2 text-sm text-[#C8C8C8]">{ev?.company ?? ''}</span>
                    {ev?.verdict && (
                      <span className="ml-2 text-xs uppercase tracking-wide text-[#888]">{ev.verdict}</span>
                    )}
                  </div>
                  <time className="text-xs text-[#888]">{new Date(d.created_at).toLocaleString()}</time>
                </header>

                {ev?.pillar_claim && (
                  <p className="mb-6 text-sm text-[#C8C8C8] italic">{ev.pillar_claim}</p>
                )}

                {/* X thread */}
                <section className="mb-6">
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[#E6B94D]">X thread</h2>
                  <div className="space-y-2">
                    {d.x_thread.map((tweet, i) => (
                      <pre
                        key={i}
                        className="whitespace-pre-wrap break-words rounded-md border border-white/10 bg-black/40 p-3 text-sm text-[#FAFAFA]"
                      >
                        <code>{tweet}</code>
                      </pre>
                    ))}
                  </div>
                </section>

                {/* LinkedIn */}
                <section className="mb-6">
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[#E6B94D]">LinkedIn post</h2>
                  <pre className="whitespace-pre-wrap break-words rounded-md border border-white/10 bg-black/40 p-3 text-sm text-[#FAFAFA]">
                    <code>{d.linkedin_post}</code>
                  </pre>
                </section>

                {/* Caption */}
                <section className="mb-6">
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[#E6B94D]">Caption</h2>
                  <pre className="whitespace-pre-wrap break-words rounded-md border border-white/10 bg-black/40 p-3 text-sm text-[#FAFAFA]">
                    <code>{d.caption}</code>
                  </pre>
                </section>

                {/* Disclaimer */}
                <section className="mb-6">
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[#E6B94D]">Disclaimer</h2>
                  <pre className="whitespace-pre-wrap break-words rounded-md border border-white/10 bg-black/40 p-3 text-xs text-[#C8C8C8]">
                    <code>{d.disclaimer}</code>
                  </pre>
                </section>

                {/* Slides */}
                <section className="mb-6">
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[#E6B94D]">Slides</h2>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {[0, 1, 2, 3, 4, 5].map((idx) => {
                      const src = `/api/content/slide/${d.event_id}/${idx}`;
                      return (
                        <figure key={idx} className="space-y-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt={`Slide ${idx + 1}`} className="w-full rounded-md border border-white/10" />
                          <a href={src} download={`${ev?.ticker ?? 'slide'}-${idx}.png`} className="block text-center text-xs text-[#E6B94D] hover:underline">
                            Download {idx + 1}
                          </a>
                        </figure>
                      );
                    })}
                  </div>
                </section>

                {/* Decision */}
                <footer className="flex gap-3">
                  <form action={approveDraft.bind(null, d.id)}>
                    <button
                      type="submit"
                      className="rounded-md bg-[#4ADE80] px-4 py-2 text-sm font-bold text-black hover:opacity-90"
                    >
                      Approve
                    </button>
                  </form>
                  <form action={rejectDraft.bind(null, d.id)}>
                    <button
                      type="submit"
                      className="rounded-md border border-[#F87171]/40 px-4 py-2 text-sm font-bold text-[#F87171] hover:bg-[#F87171]/10"
                    >
                      Reject
                    </button>
                  </form>
                </footer>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
