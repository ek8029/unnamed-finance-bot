/**
 * Read-only probe: why does /admin/content show 0 drafts?
 * Tells us which gate the content pipeline is failing:
 *   - content_events empty            => selectTopEvent never picks (no fresh material source)
 *   - events exist, queue empty       => generation/validation kills the draft
 *   - queue rows but status != draft  => drafts were posted/rejected (not a bug)
 *   - market_news stale for house tix => the news source the picker reads is not fed
 * Usage: tsx scripts/probe-content.ts
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) { console.error('Missing Supabase env'); process.exit(1); }
const db = createClient(url, key);

const HOUSE = ['GOOGL', 'NVDA', 'AMD', 'OKLO', 'TSLA', 'MSFT', 'AMZN', 'META', 'AVGO', 'SMR'];

async function main() {
  // 1. content_events
  const { count: evCount } = await db.from('content_events').select('*', { count: 'exact', head: true });
  const { data: evRecent } = await db
    .from('content_events')
    .select('run_date, ticker, verdict, source_type, created_at')
    .order('created_at', { ascending: false })
    .limit(8);
  console.log(`content_events: ${evCount ?? 0} total`);
  for (const e of evRecent ?? []) console.log(`  ${e.run_date}  ${e.ticker}  ${e.verdict}  ${e.source_type}`);

  // 2. content_queue by status
  const { data: q } = await db.from('content_queue').select('status, created_at').order('created_at', { ascending: false });
  const byStatus = new Map<string, number>();
  for (const r of q ?? []) byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
  console.log(`content_queue: ${q?.length ?? 0} total`);
  for (const [s, n] of byStatus) console.log(`  ${s}: ${n}`);

  // 3. market_news freshness for house tickers
  const since = new Date(Date.now() - 4 * 86400_000).toISOString();
  const { count: newsAll } = await db
    .from('market_news').select('*', { count: 'exact', head: true }).gte('published_at', since);
  const { data: houseNews } = await db
    .from('market_news')
    .select('primary_ticker, published_at')
    .in('primary_ticker', HOUSE)
    .gte('published_at', since)
    .order('published_at', { ascending: false })
    .limit(20);
  const tix = new Set((houseNews ?? []).map((n) => n.primary_ticker));
  console.log(`market_news (last 4d): ${newsAll ?? 0} total rows; ${houseNews?.length ?? 0} for house tickers across {${[...tix].join(', ')}}`);
  if (houseNews?.[0]) console.log(`  newest house-ticker news: ${houseNews[0].primary_ticker} @ ${houseNews[0].published_at}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
