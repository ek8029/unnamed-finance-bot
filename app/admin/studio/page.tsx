import { notFound } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isThesisUser } from '@/lib/thesis-access';
import { HOUSE_THESES } from '@/lib/content/house-theses';

export const metadata = { title: 'Studio' };

import { getTickerThesisData } from '@/lib/content/public-thesis';
import {
  catchToXPost,
  catchToLongPost,
  thesisTeardownX,
  scoreboardPost,
  type StudioCatch,
} from '@/lib/content/post-templates';
import { StudioCards, type StudioGroup } from '@/components/admin/studio-cards';

export const dynamic = 'force-dynamic';

interface QueueRow {
  event_id: string;
  content_events: StudioCatch | null;
}

export default async function StudioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isThesisUser(user?.email)) notFound();

  const db = await createServiceClient();

  // Approved catches = the raw material for the "what the agent caught" franchise.
  const { data: queueRows } = await db
    .from('content_queue')
    .select('event_id, content_events(ticker, company, pillar_claim, verdict, verbatim_cite, cite_date, run_date, source_type, source_url)')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(25);

  const catches = ((queueRows ?? []) as unknown as QueueRow[])
    .map((r) => r.content_events)
    .filter((c): c is StudioCatch => !!c);

  // Scoreboard: live status for the tickers that actually have evidence.
  const evidencedTickers = [...new Set(catches.map((c) => c.ticker))];
  const scoreData = (await Promise.all(evidencedTickers.map((t) => getTickerThesisData(t))))
    .filter(Boolean)
    .map((d) => ({ ticker: d!.ticker, healthLabel: d!.healthLabel }));

  const todayISO = new Date().toISOString().slice(0, 10);
  const fmtDay = (d?: string | null) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');

  // Rotate the teardown set daily so it is not the same tickers every day.
  const dayIndex = Math.floor(Date.now() / 86400000) % Math.max(1, HOUSE_THESES.length);
  const teardownPicks = [...HOUSE_THESES.slice(dayIndex), ...HOUSE_THESES.slice(0, dayIndex)].slice(0, 5);

  const groups: StudioGroup[] = [
    {
      title: 'What the agent caught',
      blurb: 'Your flagship X franchise. One real catch, one post. Nobody else can post these.',
      posts: catches.map((c, i) => {
        const day = fmtDay(c.cite_date ?? c.run_date);
        return {
          id: `caught-${c.ticker}-${i}`,
          kind: 'X / post',
          meta: day ? `${c.ticker} · ${day}` : c.ticker,
          date: c.cite_date ?? c.run_date ?? undefined,
          text: catchToXPost(c),
        };
      }),
    },
    {
      title: 'Long form (LinkedIn / thread lead)',
      blurb: 'The same catches, expanded. For LinkedIn or as the opener of an X thread.',
      posts: catches.slice(0, 5).map((c, i) => {
        const day = fmtDay(c.cite_date ?? c.run_date);
        return {
          id: `long-${c.ticker}-${i}`,
          kind: 'LinkedIn',
          meta: day ? `${c.ticker} · ${day}` : c.ticker,
          date: c.cite_date ?? c.run_date ?? undefined,
          text: catchToLongPost(c),
        };
      }),
    },
    {
      title: 'Thesis teardowns',
      blurb: 'The pillars + breaks-if falsifiers, straight from the house theses. Rotates daily.',
      posts: teardownPicks.map((t) => ({
        id: `teardown-${t.ticker}`,
        kind: 'X thread',
        meta: t.ticker,
        date: todayISO,
        text: thesisTeardownX({ ticker: t.ticker, company: t.company, pillars: t.pillars }),
      })),
    },
    {
      title: 'Thesis scoreboard',
      blurb: 'The always-on shareable number. Computed from real evidence.',
      posts: scoreData.length
        ? [{ id: 'scoreboard', kind: 'X / post', date: todayISO, text: scoreboardPost(scoreData, todayISO) }]
        : [],
    },
  ];

  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
      <div className="container mx-auto max-w-3xl px-6 py-12">
        <header className="mb-10">
          <h1 className="text-[28px] font-bold tracking-tight">Content Studio</h1>
          <p className="mt-2 text-[15px] text-[var(--color-text-muted)]">
            Today&rsquo;s posts, generated from real catches and theses. Copy, paste, post. Everything is built
            from actual evidence: no fabricated breaks, no made-up numbers. Post daily, reply to the anchor
            accounts, let the voice compound.
          </p>
        </header>
        <StudioCards groups={groups} />
      </div>
    </main>
  );
}
