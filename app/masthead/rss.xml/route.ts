import { createStaticServiceClient } from '@/lib/supabase/server';

// RSS feed of approved catches (The Masthead). Forwardable + crawlable; each item links to
// the catch's anchor on its per-ticker thesis page. Same visibility gate as /masthead
// (content_queue.status='approved'). Public read via the cookie-free service client.

export const revalidate = 1800;

const BASE = 'https://helmterminal.dev';

interface EventCols {
  id: string;
  ticker: string;
  pillar_claim: string | null;
  verdict: string;
  verbatim_cite: string;
  summary: string | null;
  cite_date: string | null;
  source_url: string | null;
  source_type: string;
  run_date: string | null;
}
interface QueueRow {
  content_events: EventCols | null;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function rfc822(raw: string | null): string {
  const d = raw ? new Date(raw) : new Date();
  return (Number.isNaN(d.getTime()) ? new Date() : d).toUTCString();
}

function sourceLabel(t: string): string {
  return t === 'filing' ? 'SEC filing' : 'News';
}

export async function GET() {
  const db = createStaticServiceClient();
  const { data } = await db
    .from('content_queue')
    .select(
      'decided_at, content_events(id, ticker, pillar_claim, verdict, verbatim_cite, summary, cite_date, source_url, source_type, run_date)',
    )
    .eq('status', 'approved')
    .order('decided_at', { ascending: false })
    .limit(50);

  const events = ((data ?? []) as unknown as QueueRow[])
    .map((r) => r.content_events)
    .filter((e): e is EventCols => !!e)
    .sort((a, b) => (b.cite_date ?? b.run_date ?? '').localeCompare(a.cite_date ?? a.run_date ?? ''));

  const items = events
    .map((e) => {
      const title = `${e.ticker}: ${e.verdict} — ${e.pillar_claim ?? 'thesis evidence'}`;
      const descParts = [e.verbatim_cite, e.summary].filter(Boolean) as string[];
      const sourceTail = e.source_url ? `${sourceLabel(e.source_type)}: ${e.source_url}` : sourceLabel(e.source_type);
      const description = `${descParts.join(' ')} — ${sourceTail}`;
      const link = `${BASE}/thesis/${e.ticker.toLowerCase()}#c-${e.id}`;
      return `    <item>
      <title>${esc(title)}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="false">${esc(e.id)}</guid>
      <pubDate>${rfc822(e.cite_date ?? e.run_date)}</pubDate>
      <description>${esc(description)}</description>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>The Masthead — Helm Terminal</title>
    <link>${BASE}/masthead</link>
    <atom:link href="${BASE}/masthead/rss.xml" rel="self" type="application/rss+xml" />
    <description>Filing and news evidence tested against live investment theses, each with the verbatim source quote.</description>
    <language>en-us</language>
    <lastBuildDate>${rfc822(events[0]?.cite_date ?? events[0]?.run_date ?? null)}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=1800',
    },
  });
}
