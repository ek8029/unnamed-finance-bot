/**
 * Free, license-clean news + events ingestion.
 *
 * Three sources, none requiring an API key:
 *  1. Nasdaq per-ticker RSS — headline + link + short description with
 *     attribution. We never republish article bodies; sentiment and
 *     summaries are computed in-house.
 *  2. Yahoo Finance per-ticker RSS — broader syndication (Reuters, AP,
 *     Barron's, Bloomberg headlines). Same headline+link+attribution posture.
 *  3. SEC EDGAR 8-K filings (public domain) — material corporate events
 *     (earnings releases, M&A, leadership changes) into market_events.
 */

import { scoreSentiment } from '@/lib/market-classify';
import { detectPrimaryTicker } from '@/lib/news-primary-ticker';
import { subjectPrefilter } from '@/lib/news-subject';
import { classifySubjects, SUBJECT_MODEL } from '@/lib/news-subject-model';
import { getRecentFilings } from '@/lib/edgar';
import { fence, INJECTION_GUARD } from '@/lib/prompt-safety';
import OpenAI from 'openai';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

// Lazy-init: a module-scope `new OpenAI()` throws at import time when
// OPENAI_API_KEY is unset (breaks tests and any non-LLM import of this module).
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}
const MACRO_MODEL = 'gpt-4o-mini';

// ── RSS parsing ──

interface RssArticle {
  title: string;
  url: string;
  description: string;
  source: string | null;
  publishedAt: string; // ISO
  tickers: string[];
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .trim();
}

/**
 * Junk genres that pollute per-ticker feeds: templated screener listicles
 * (Zacks "Top Growth Stock"), dividend-reminder spam, options-channel
 * boilerplate, law-firm class action alerts. High-precision patterns only.
 */
const JUNK_HEADLINE =
  /ex-dividend reminder|top (growth|value|momentum) stock|validea|noteworthy etf|pre-market most active|after-hours most active|put and call options|options trading begins|shareholder alert|class action|deadline alert/i;

/**
 * Some feed summaries are promo boilerplate about the research service, not
 * the article (e.g. Zacks: "...finding strong stocks becomes easier with the
 * Zacks Style Scores, a top feature of the Zacks Premium research service").
 * Blank those — headline-only beats a misleading summary.
 */
function scrubBoilerplate(s: string): string {
  return /zacks (style scores|premium|rank|investment research)/i.test(s) ? '' : s;
}

function tagContent(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? decodeEntities(m[1]) : null;
}

/**
 * Fetch recent headlines for a ticker from Nasdaq's public RSS feed.
 */
export async function fetchTickerHeadlines(ticker: string): Promise<RssArticle[]> {
  const upper = ticker.toUpperCase();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(
      `https://www.nasdaq.com/feed/rssoutbound?symbol=${encodeURIComponent(upper)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Accept: 'application/rss+xml, application/xml, text/xml',
        },
        cache: 'no-store',
        signal: controller.signal,
      },
    );
    clearTimeout(timeout);
    if (!res.ok) return [];

    const xml = await res.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    const articles: RssArticle[] = [];

    for (const item of items.slice(0, 15)) {
      const title = tagContent(item, 'title');
      const url = tagContent(item, 'link');
      if (!title || !url) continue;
      if (JUNK_HEADLINE.test(title)) continue;

      const pubDate = tagContent(item, 'pubDate');
      const published = pubDate ? new Date(pubDate) : new Date();
      const feedTickers = (tagContent(item, 'nasdaq:tickers') || '')
        .split(',')
        .map(t => t.trim().toUpperCase())
        .filter(Boolean);

      articles.push({
        title,
        url,
        // Nasdaq strips HTML tags upstream without inserting spaces, which
        // leaves Motley Fool's "Key Points" heading glued to the first
        // sentence (e.g. "Key PointsApple unveiled..."). Drop the prefix.
        description: scrubBoilerplate(
          (tagContent(item, 'description') || '')
            .replace(/^Key Points\s*/i, '')
            .substring(0, 500),
        ),
        source: tagContent(item, 'dc:creator') || 'Nasdaq',
        publishedAt: isNaN(published.getTime()) ? new Date().toISOString() : published.toISOString(),
        tickers: feedTickers.length > 0 ? [...new Set(feedTickers)] : [upper],
      });
    }
    return articles;
  } catch (error) {
    console.error(`[free-news] RSS fetch failed for ${upper}:`, error);
    return [];
  }
}

/** Display source derived from an article URL's hostname. */
function sourceFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.endsWith('yahoo.com')) return 'Yahoo Finance';
    if (host.endsWith('fool.com')) return 'The Motley Fool';
    return host;
  } catch {
    return 'Yahoo Finance';
  }
}

/**
 * Fetch recent headlines for a ticker from Yahoo Finance's public RSS feed.
 * Broader syndication than Nasdaq's feed, but no source/ticker metadata —
 * source is derived from the article URL, tickers default to the requested one.
 */
export async function fetchYahooHeadlines(ticker: string): Promise<RssArticle[]> {
  const upper = ticker.toUpperCase();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(
      `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(upper)}&region=US&lang=en-US`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Accept: 'application/rss+xml, application/xml, text/xml',
        },
        cache: 'no-store',
        signal: controller.signal,
      },
    );
    clearTimeout(timeout);
    if (!res.ok) return [];

    const xml = await res.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    const articles: RssArticle[] = [];

    for (const item of items.slice(0, 15)) {
      const title = tagContent(item, 'title');
      const rawUrl = tagContent(item, 'link');
      if (!title || !rawUrl) continue;
      if (JUNK_HEADLINE.test(title)) continue;

      // Strip Yahoo's RSS tracking param for cleaner links and dedupe
      const url = rawUrl.replace(/\?\.tsrc=rss$/, '');
      const pubDate = tagContent(item, 'pubDate');
      const published = pubDate ? new Date(pubDate) : new Date();

      articles.push({
        title,
        url,
        // Bloomberg items glue a "Most Read from Bloomberg" link list onto
        // the summary with no separator. Drop it.
        description: scrubBoilerplate(
          (tagContent(item, 'description') || '')
            .replace(/Most Read from Bloomberg[\s\S]*$/, '')
            .substring(0, 500)
            .trim(),
        ),
        source: sourceFromUrl(url),
        publishedAt: isNaN(published.getTime()) ? new Date().toISOString() : published.toISOString(),
        tickers: [upper],
      });
    }
    return articles;
  } catch (error) {
    console.error(`[free-news] Yahoo RSS fetch failed for ${upper}:`, error);
    return [];
  }
}

/**
 * Refresh market_news from per-ticker RSS feeds. Returns inserted count.
 */
export async function refreshRssNews(
  supabase: AnyClient,
  log: string[],
  tickers: string[],
  options?: { classifyMacro?: boolean; classifySubjects?: boolean },
): Promise<number> {
  const unique = [...new Set(tickers.map(t => t.toUpperCase()))]
    .filter(t => !t.includes('-USD'))
    .slice(0, 25); // cap feed fetches per run

  if (unique.length === 0) {
    log.push('[news] No tickers to fetch news for');
    return 0;
  }

  const articles: RssArticle[] = [];
  for (const ticker of unique) {
    const [nasdaq, yahoo] = await Promise.all([
      fetchTickerHeadlines(ticker),
      fetchYahooHeadlines(ticker),
    ]);
    articles.push(...nasdaq, ...yahoo);
    await new Promise(r => setTimeout(r, 300)); // be polite
  }

  // Dedupe within batch by URL and by normalized title — the same article
  // often appears on both feeds under different URLs (Nasdaq republish vs
  // original publisher link via Yahoo).
  const normTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
  const seen = new Set<string>();
  const seenTitles = new Set<string>();
  const batch = articles.filter(a => {
    const nt = normTitle(a.title);
    if (seen.has(a.url) || seenTitles.has(nt)) return false;
    seen.add(a.url);
    seenTitles.add(nt);
    return true;
  });

  if (batch.length === 0) {
    log.push('[news] No articles returned from RSS feeds');
    return 0;
  }

  // Dedupe against existing rows — by URL, and by normalized title over the
  // last 7 days (same story can arrive from the other feed under a new URL)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: existing }, { data: recentRows }] = await Promise.all([
    supabase.from('market_news').select('url').in('url', batch.map(a => a.url)),
    supabase.from('market_news').select('title').gte('published_at', weekAgo),
  ]);

  const existingUrls = new Set((existing || []).map((a: { url: string }) => a.url));
  const existingTitles = new Set(
    (recentRows || []).map((a: { title: string }) => normTitle(a.title || '')),
  );
  const newArticles = batch.filter(
    a => !existingUrls.has(a.url) && !existingTitles.has(normTitle(a.title)),
  );

  if (newArticles.length === 0) {
    log.push(`[news] 0 new articles (${batch.length} duplicates skipped)`);
    return 0;
  }

  // Name/sector lookup for primary-ticker detection and sector tags
  const allTickers = [...new Set(newArticles.flatMap(a => a.tickers))];
  const tickerNameMap = new Map<string, string>();
  const tickerSectorMap = new Map<string, string>();
  if (allTickers.length > 0) {
    const { data: securities } = await supabase
      .from('securities')
      .select('ticker, security_name, sector')
      .in('ticker', allTickers);
    for (const s of (securities || []) as { ticker: string; security_name: string | null; sector: string | null }[]) {
      const upper = s.ticker?.toUpperCase();
      if (!upper) continue;
      if (s.security_name) tickerNameMap.set(upper, s.security_name);
      if (s.sector) tickerSectorMap.set(upper, s.sector);
    }
  }

  const inserts = newArticles.flatMap(article => {
    const sentiment = scoreSentiment(`${article.title} ${article.description}`);
    const sectors = [
      ...new Set(article.tickers.map(t => tickerSectorMap.get(t)).filter(Boolean)),
    ];
    const primaryTicker = detectPrimaryTicker(
      article.title,
      article.description,
      article.tickers,
      tickerNameMap,
    );

    // No clear subject ticker = low-signal filler unless it's a genuine
    // broad-market piece (many tickers). Null primary_ticker rows surface
    // for every user in the intelligence feed, so be strict here.
    if (!primaryTicker && article.tickers.length < 10) return [];

    return {
      title: article.title,
      summary: article.description || null,
      content: null,
      url: article.url,
      image_url: null,
      source: article.source,
      author: null,
      published_at: article.publishedAt,
      tickers: article.tickers,
      primary_ticker: primaryTicker,
      sectors: sectors.length > 0 ? sectors : null,
      sentiment,
    };
  });

  if (inserts.length === 0) {
    log.push(`[news] 0 articles kept (${newArticles.length} dropped as low-signal)`);
    return 0;
  }

  const { error } = await supabase.from('market_news').insert(inserts);
  if (error) {
    log.push(`[news] Insert failed: ${error.message}`);
    return 0;
  }


  // Is each article ABOUT its primary ticker, or does it only mention the
  // company? Cron-only, same posture as the macro classifier below.
  if (options?.classifySubjects) {
    await classifyNewsSubjects(supabase, log, inserts, tickerNameMap);
    // Rows the request-path refresh inserted, or that a classifier outage
    // skipped, would otherwise never get a verdict. Bounded sweep, so the cost
    // of catching up can never run away.
    await sweepUnclassifiedSubjects(supabase, log, 150);
  }

  // LLM classification is cron-only. Request-path callers (POST /api/market/news/refresh) must never trigger it.
  if (options?.classifyMacro) {
    const macroCandidates = inserts
      .filter((ins: { primary_ticker: string | null }) => ins.primary_ticker === null)
      .map((ins: { url: string; title: string }) => ({ url: ins.url, title: ins.title }));
    await classifyMacroMovers(supabase, log, macroCandidates);
  }
  log.push(`[news] Inserted ${inserts.length} new articles (${batch.length - newArticles.length} duplicates, ${newArticles.length - inserts.length} low-signal skipped)`);
  return inserts.length;
}

// ── Subject classifier ──

/**
 * Write an aboutness verdict for the rows just inserted. Free shape rules
 * first (they also save a model call), claude-haiku on the remainder.
 *
 * Everything here is best-effort: an unwritten verdict stays NULL, and NULL is
 * always shown. The worst case is today's behaviour, not an empty feed.
 */
async function classifyNewsSubjects(
  supabase: AnyClient,
  log: string[],
  inserts: { url: string; title: string; summary: string | null; primary_ticker: string | null; tickers: string[] }[],
  nameMap: Map<string, string>,
): Promise<void> {
  const candidates = inserts.filter((r) => r.primary_ticker && r.url);
  if (candidates.length === 0) return;

  // (verdict, decided-by, tone) -> urls. A handful of groups, so a handful of
  // writes. Tone is empty for anything a rule decided, and an empty tone leaves
  // the keyword-scored sentiment alone rather than overwriting it with nothing.
  const groups = new Map<string, string[]>();
  const addTo = (verdict: string, by: string, url: string, tone?: string) => {
    const key = `${verdict}|${by}|${tone ?? ''}`;
    const list = groups.get(key);
    if (list) list.push(url);
    else groups.set(key, [url]);
  };

  const forModel: { key: string; title: string; summary: string | null; ticker: string; companyName: string | null }[] = [];
  for (const r of candidates) {
    const ticker = (r.primary_ticker as string).toUpperCase();
    const companyName = nameMap.get(ticker) ?? null;
    const pre = subjectPrefilter({ title: r.title, ticker, companyName, tickers: r.tickers });
    if (pre) addTo('mention', pre.reason, r.url);
    else forModel.push({ key: r.url, title: r.title, summary: r.summary, ticker, companyName });
  }

  const modelVerdicts = await classifySubjects(forModel, log);
  for (const [url, answer] of modelVerdicts) addTo(answer.verdict, SUBJECT_MODEL, url, answer.tone);

  // A mention is the WRONG reader's news, not nobody's. When the model named
  // the company the article is actually about, validate that ticker against the
  // securities table and store it, so the feed can hand the article to whoever
  // holds that name instead of discarding it. primary_ticker is deliberately
  // left alone: the scorer and the digest keep seeing exactly what they saw.
  const proposed = new Map<string, string>();
  for (const [url, answer] of modelVerdicts) {
    if (answer.verdict === 'mention' && answer.subjectTicker) proposed.set(url, answer.subjectTicker);
  }
  if (proposed.size > 0) {
    const candidates = [...new Set(proposed.values())];
    const { data: real } = await supabase.from('securities').select('ticker').in('ticker', candidates);
    const valid = new Set(((real || []) as { ticker: string }[]).map((r) => r.ticker.toUpperCase()));
    const byTicker = new Map<string, string[]>();
    let dropped = 0;
    for (const [url, ticker] of proposed) {
      if (!valid.has(ticker)) { dropped++; continue; }
      const list = byTicker.get(ticker);
      if (list) list.push(url);
      else byTicker.set(ticker, [url]);
    }
    let reaimed = 0;
    for (const [ticker, urls] of byTicker) {
      const { error } = await supabase.from('market_news').update({ subject_ticker: ticker }).in('url', urls);
      if (!error) reaimed += urls.length;
    }
    if (reaimed > 0 || dropped > 0) {
      log.push(`[news] re-aimed ${reaimed} url(s) to their real subject, dropped ${dropped} unrecognised ticker(s)`);
    }
  }

  let written = 0;
  for (const [key, urls] of groups) {
    const [verdict, by, tone] = key.split('|');
    // The model read the same headline to decide the verdict, so its tone costs
    // nothing extra and replaces a word count that agreed with it 54% of the
    // time. Rows a rule decided keep whatever scoreSentiment produced.
    const payload: Record<string, string> = { subject_verdict: verdict, subject_verdict_by: by };
    if (tone) payload.sentiment = tone;
    const { error } = await supabase
      .from('market_news')
      .update(payload)
      .in('url', urls);
    if (error) {
      // Migration 068 not applied yet, or a transient failure. Either way the
      // rows keep a null verdict and stay visible.
      log.push(`[news] subject verdict not stored (${error.message})`);
      return;
    }
    written += urls.length;
  }
  const mentions = [...groups.entries()]
    .filter(([k]) => k.startsWith('mention|'))
    .reduce((n, [, urls]) => n + urls.length, 0);
  // Counts are URLs, not rows: the table holds several copies of the same
  // article (one per ticker feed it arrived on), and updating by URL cleans
  // every copy from one model call. Measured 2026-09-03: ~3.6 rows per URL.
  log.push(`[news] subject: ${written} urls classified, ${mentions} mentions (${forModel.length} needed the model)`);
}

/**
 * Catch up on recent rows that carry no verdict yet: anything the request-path
 * refresh inserted, or that a classifier outage skipped. Capped per run, and
 * only reaches back three days, because the feed never shows older news.
 */
async function sweepUnclassifiedSubjects(
  supabase: AnyClient,
  log: string[],
  limit: number,
): Promise<void> {
  const { data, error } = await supabase
    .from('market_news')
    .select('url, title, summary, primary_ticker, tickers')
    .is('subject_verdict', null)
    .not('primary_ticker', 'is', null)
    .not('url', 'is', null)
    .gte('published_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
    .order('published_at', { ascending: false })
    .limit(limit);
  // Migration 068 not applied yet: `subject_verdict` does not exist, so the
  // filter errors. Nothing to do, and nothing breaks.
  if (error || !data || data.length === 0) return;

  const tickers = [...new Set((data as { primary_ticker: string }[]).map((r) => r.primary_ticker.toUpperCase()))];
  const nameMap = new Map<string, string>();
  if (tickers.length > 0) {
    const { data: secs } = await supabase.from('securities').select('ticker, security_name').in('ticker', tickers);
    for (const s of (secs || []) as { ticker: string; security_name: string | null }[]) {
      if (s.security_name) nameMap.set(s.ticker.toUpperCase(), s.security_name);
    }
  }
  await classifyNewsSubjects(
    supabase,
    log,
    data as { url: string; title: string; summary: string | null; primary_ticker: string | null; tickers: string[] }[],
    nameMap,
  );
}

// ── Macro-mover classifier ──

async function classifyMacroMovers(
  supabase: AnyClient,
  log: string[],
  candidates: { url: string; title: string }[],
): Promise<void> {
  if (candidates.length === 0) return;

  try {
    const numberedList = candidates
      .map((c, idx) => `${idx}: ${c.title}`)
      .join('\n');

    const response = await getOpenAI().chat.completions.create({
      model: MACRO_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            INJECTION_GUARD +
            'You are a strict macro news classifier. A true market-mover is ONLY one of: ' +
            'a Federal Reserve rate decision or emergency action, a CPI or inflation data release ' +
            'that shocks consensus expectations, an outbreak of war or major geopolitical escalation, ' +
            'or a sovereign default or major-issuer credit event. ' +
            'Almost always the answer is none. ' +
            'Ordinary market commentary, earnings roundups, analyst opinions, stock lists, ' +
            'sector rotations, and corporate news never qualify. ' +
            'Return JSON exactly: { "movers": [indices] } where indices are integers from the list below. ' +
            'If nothing qualifies return { "movers": [] }.',
        },
        {
          role: 'user',
          content: fence(numberedList, 'HEADLINES'),
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? '';
    let parsed: { movers?: unknown };
    try {
      parsed = JSON.parse(raw);
    } catch {
      log.push('[news] Macro classification failed: invalid JSON from model');
      return;
    }

    if (!Array.isArray(parsed.movers)) {
      log.push('[news] Macro classification failed: movers field missing or not array');
      return;
    }

    const validIndices = [...new Set(
      (parsed.movers as unknown[])
        .filter((v): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < candidates.length)
    )].slice(0, 2);

    if (validIndices.length === 0) {
      log.push('[news] Macro scan: 0 movers (expected)');
      return;
    }

    const selectedUrls = validIndices.map(i => candidates[i].url);
    const { error: updateError } = await supabase
      .from('market_news')
      .update({ macro_tier: 'mover' })
      .in('url', selectedUrls);

    if (updateError) {
      log.push(`[news] Macro classification failed: ${updateError.message}`);
      return;
    }

    log.push(`[news] Macro movers flagged: ${validIndices.length}`);
  } catch (err) {
    log.push(`[news] Macro classification failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ── SEC 8-K filing events ──

// 8-K item number → market_events row (event_type must satisfy the DB
// CHECK constraint: earnings/dividend/split/merger/ipo/macro/fed_announcement)
const FILING_EVENT_MAP: Record<string, { type: string; label: string; impact: string }> = {
  '2.02': { type: 'earnings', label: 'reported results (8-K)', impact: 'high' },
  '2.01': { type: 'merger', label: 'completed an acquisition or disposition (8-K)', impact: 'high' },
  '1.01': { type: 'macro', label: 'entered a material agreement (8-K)', impact: 'medium' },
  '5.02': { type: 'macro', label: 'announced a leadership change (8-K)', impact: 'medium' },
};

/**
 * Refresh market_events from recent SEC 8-K filings. Returns inserted count.
 */
export async function refreshFilingEvents(
  supabase: AnyClient,
  log: string[],
  tickers: string[],
): Promise<number> {
  const unique = [...new Set(tickers.map(t => t.toUpperCase()))]
    .filter(t => !t.includes('-USD'))
    .slice(0, 50);

  if (unique.length === 0) return 0;

  const since = new Date();
  since.setDate(since.getDate() - 14);
  const sinceDate = since.toISOString().split('T')[0];

  type EventInsert = {
    event_type: string;
    ticker: string;
    event_date: string;
    title: string;
    description: string;
    metadata: Record<string, unknown>;
    impact_level: string;
  };
  const candidates: EventInsert[] = [];

  for (const ticker of unique) {
    const filings = await getRecentFilings(ticker, sinceDate);
    for (const filing of filings) {
      if (filing.form !== '8-K') continue;
      const mapped = filing.items.map(i => FILING_EVENT_MAP[i]).find(Boolean);
      if (!mapped) continue;

      candidates.push({
        event_type: mapped.type,
        ticker,
        event_date: filing.filingDate,
        title: `${ticker} ${mapped.label}`,
        description: `SEC Form 8-K filed ${filing.filingDate} (items ${filing.items.join(', ')}).`,
        metadata: { form: '8-K', items: filing.items, filing_url: filing.url },
        impact_level: mapped.impact,
      });
    }
    await new Promise(r => setTimeout(r, 120)); // stay under SEC 10 req/s
  }

  if (candidates.length === 0) {
    log.push('[events] No new 8-K filings found');
    return 0;
  }

  const { data: existing } = await supabase
    .from('market_events')
    .select('ticker, event_date, event_type')
    .in('ticker', candidates.map(c => c.ticker))
    .gte('event_date', sinceDate);

  const existingKeys = new Set(
    (existing || []).map(
      (e: { ticker: string; event_date: string; event_type: string }) =>
        `${e.ticker}:${e.event_date}:${e.event_type}`,
    ),
  );

  const inserts = candidates.filter(
    c => !existingKeys.has(`${c.ticker}:${c.event_date}:${c.event_type}`),
  );

  if (inserts.length === 0) {
    log.push('[events] No new 8-K events (all already recorded)');
    return 0;
  }

  const { error } = await supabase.from('market_events').insert(inserts);
  if (error) {
    log.push(`[events] Insert failed: ${error.message}`);
    return 0;
  }

  log.push(`[events] Inserted ${inserts.length} 8-K filing events`);
  return inserts.length;
}
