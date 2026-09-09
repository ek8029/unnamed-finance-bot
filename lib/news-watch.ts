// lib/news-watch.ts
// The news poller (perpetual watch, section 3).
//
// The RSS ingest (lib/free-news.ts refreshRssNews) reads two feeds per ticker
// and was capped at 25 tickers per call, which the daily run called once: most
// held names never had their news fetched at all. This runs every five minutes
// and rotates through the whole watched list in fixed slices, so every name is
// read about every 40 minutes and a story lands within that of publication.
// The rotation is a pure function of the clock, so it is the same on every
// instance and needs no state.
//
// Classification (Haiku, batches of 20) runs on what each tick inserts; the
// tokens are recorded as a `classify` row in judge_jobs so the spend query
// sees them. A row the classifier calls ABOUT a name with a tracked thesis
// becomes a judge job. The model is never called from here for judging.

import type { SupabaseClient } from '@supabase/supabase-js';
import { refreshRssNews } from '@/lib/free-news';
import { monitoredThesisIds } from '@/lib/agent/monitored';
import { enqueueJudgeJobs, recordLedgerRow, type NewJudgeJob } from '@/lib/agent/judge-queue';
import { beat } from '@/lib/agent/heartbeat';
import { emptyLedger } from '@/lib/ai/pricing';
import { newsDisposition, type NewsSubjectRow } from '@/lib/news-relevance';
import { cachedUniverse } from '@/lib/watch/universe-cache';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

/** Tickers read per tick. Two feeds plus a 300 ms pause each: about 45 s. */
export const NEWS_SLICE = 40;
export const NEWS_PERIOD_MIN = 5;

/** Which five-minute slot the clock is in. */
export function slotFor(now: Date, periodMin = NEWS_PERIOD_MIN): number {
  return Math.floor(now.getTime() / (periodMin * 60_000));
}

/** The `size` items starting at slot * size, wrapping, so consecutive slots cover everything. */
export function rotationSlice<T>(items: T[], slot: number, size: number): T[] {
  const n = items.length;
  if (n === 0 || size <= 0) return [];
  if (size >= n) return [...items];
  const offset = ((slot * size) % n + n) % n;
  const out: T[] = [];
  for (let i = 0; i < size; i++) out.push(items[(offset + i) % n]);
  return out;
}

async function distinctTickers(db: Db, table: 'holdings' | 'theses'): Promise<Set<string>> {
  const out = new Set<string>();
  for (let page = 0; page < 10; page++) {
    let q = db.from(table).select('ticker').range(page * 1000, page * 1000 + 999);
    q = table === 'holdings' ? q.neq('ticker', 'UNKNOWN') : q.eq('tracked', true);
    const { data, error } = await q;
    if (error || !data) break;
    for (const r of data) if (r.ticker) out.add(String(r.ticker).toUpperCase());
    if (data.length < 1000) break;
  }
  return out;
}

export interface NewsWatchResult {
  slot: number;
  tickers: number;
  slice: string[];
  inserted: number;
  classifierCalls: number;
  classifierCostUsd: number;
  about: number;
  queued: number;
  errors: string[];
  ms: number;
}

export async function runNewsWatch(db: Db, opts: { log: string[]; now?: Date; size?: number }): Promise<NewsWatchResult> {
  const now = opts.now ?? new Date();
  const started = Date.now();
  const log = opts.log;
  const size = opts.size ?? NEWS_SLICE;
  const errors: string[] = [];

  // Both lists are cached (lib/watch/universe-cache): the thesis names alone,
  // because the market_news re-read below filters on them, and the union.
  const thesis = new Set(await cachedUniverse('news-thesis', async () => [...await distinctTickers(db, 'theses')].sort()));
  const union = await cachedUniverse('news', async () => {
    const held = await distinctTickers(db, 'holdings');
    return [...new Set([...held, ...thesis])].sort();
  });
  // Sorted, so the rotation is identical on every instance.
  const all = union.filter((t) => !t.includes('-USD')).sort();
  const slot = slotFor(now);
  const slice = rotationSlice(all, slot, size);
  const tickStart = now.toISOString();

  const ledger = emptyLedger();
  let inserted = 0;
  try {
    inserted = await refreshRssNews(db, log, slice, { classifyMacro: false, classifySubjects: true, ledger, maxTickers: slice.length });
  } catch (err) {
    errors.push(`ingest: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (ledger.calls > 0) {
    try {
      await recordLedgerRow(db, { source_key: `classify:news-watch:${tickStart}`, ledger, payload: { tickers: slice.length, inserted } });
    } catch (err) {
      errors.push(`ledger row: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Alerts still require classifier evidence, including validated re-aims.
  // The shared disposition keeps unconfirmed context out of the judge queue.
  let about = 0;
  let queued = 0;
  if (thesis.size > 0 && inserted > 0) {
    const { data: rows, error } = await db
      .from('market_news')
      .select('url, title, primary_ticker, published_at, tickers, subject_verdict, subject_ticker')
      .gte('created_at', tickStart)
      .in('subject_verdict', ['about', 'mention'])
      .or(`primary_ticker.in.(${[...thesis].join(',')}),subject_ticker.in.(${[...thesis].join(',')})`)
      .limit(200);
    if (error) {
      errors.push(`about rows: ${error.message}`);
    } else {
      const fresh = ((rows ?? []) as (NewsSubjectRow & { url: string; published_at: string })[]).flatMap(row => {
        const subject = newsDisposition(row);
        return subject.kind === 'subject' && subject.evidence === 'classifier' && thesis.has(subject.ticker)
          ? [{ ...row, primary_ticker: subject.ticker }]
          : [];
      });
      about = fresh.length;
      if (fresh.length > 0) {
        const tickers = [...new Set(fresh.map((r) => r.primary_ticker.toUpperCase()))];
        const { data: theses, error: tErr } = await db
          .from('theses')
          .select('id, user_id, ticker')
          .in('ticker', tickers)
          .eq('tracked', true)
          .limit(500);
        if (tErr) {
          errors.push(`theses: ${tErr.message}`);
        } else {
          const owners = (theses ?? []) as { id: string; user_id: string; ticker: string }[];
          const kept = await monitoredThesisIds(db, owners.map((o) => o.user_id));
          const jobs: NewJudgeJob[] = [];
          for (const r of fresh) {
            for (const t of owners) {
              if (t.ticker.toUpperCase() !== r.primary_ticker.toUpperCase() || !kept.has(t.id)) continue;
              jobs.push({
                kind: 'news',
                user_id: t.user_id,
                thesis_id: t.id,
                ticker: t.ticker,
                source_key: r.url,
                payload: { url: r.url, title: r.title, published_at: r.published_at, ticker: r.primary_ticker },
              });
            }
          }
          const q = await enqueueJudgeJobs(db, jobs);
          if (q.error) errors.push(`enqueue: ${q.error}`);
          queued = q.inserted;
          if (jobs.length > 0) log.push(`[news-watch] ${fresh.length} about row(s) on thesis names, ${queued} job(s) queued`);
        }
      }
    }
  }

  const result: NewsWatchResult = {
    slot,
    tickers: all.length,
    slice,
    inserted,
    classifierCalls: ledger.calls,
    classifierCostUsd: Number(ledger.costUsd.toFixed(6)),
    about,
    queued,
    errors,
    ms: Date.now() - started,
  };
  await beat(db, 'news-watch', { slot, slice: slice.length, tickers: all.length, inserted, about, queued, classifierCostUsd: result.classifierCostUsd, errors: errors.length, ms: result.ms });
  return result;
}
