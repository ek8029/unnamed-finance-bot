/**
 * The model half of the aboutness question (see lib/news-subject.ts).
 *
 * Measured 2026-09-03 against a blind Sonnet arbiter on 160 production rows:
 *   rules alone   78.1% accurate, 84.4% precision
 *   claude-haiku  91.9% accurate, 95.2% precision, 89.8% recall
 * Haiku cost $0.034 for those 160 articles, so roughly $1.40/mo at 213
 * articles a day and $5/mo at 811. It runs once per article at ingest, never
 * on the read path.
 *
 * Fail-open by construction: a missing key, an API error or unparseable JSON
 * returns an empty map, the row keeps a null verdict, and a null verdict is
 * always shown. A classifier outage must never empty the feed.
 */

import { getAnthropic, hasAnthropicKey } from '@/lib/anthropic';
import type { SubjectVerdict } from '@/lib/news-subject';

export const SUBJECT_MODEL = 'claude-haiku-4-5';

/** Batch size. 20 headlines is ~1.5k input tokens, well inside one call. */
const BATCH = 20;

const TASK = `For each numbered item decide ONE thing: is the article ABOUT the named company, or does it only MENTION the company?

ABOUT means the article reports something that happened at, to, or was done by that company: results, guidance, a product, a deal, a lawsuit, a regulatory action, an analyst move on it, a move in its stock, a trial result, an executive change at that company.

MENTION means the company appears as context, provenance or comparison and the article's real subject is something else. These are all MENTION:
- a person or startup described by where they used to work ("ex-Nvidia engineer raises $30M")
- another company's news that names this one as a customer, supplier, rival or partner
- a macro or market-wide story that lists the company as an example
- a market wrap, live blog or "most active stocks" roundup
- an opinion piece comparing several companies

Answer only from the headline and summary. If the headline does not make the company its subject, answer mention.

When the answer is mention AND the headline is clearly about a DIFFERENT public company, add "s" with that company's US ticker symbol in capitals. A story about Costco filed under Amazon gets "s":"COST". Omit "s" when the real subject is a private company, a person, a market-wide event, or anything you are not sure of. A guessed ticker is worse than no ticker.

Also add "t", what the article reports about that company's business:
- "positive": a beat, a raise, a win, an approval, a signed deal, an upgrade, a rise in its stock
- "negative": a miss, a cut, a loss, a lawsuit, a downgrade, a recall, a fall in its stock
- "neutral": neither, a mix, a question rather than an event, or an executive change
Judge the report, never whether the stock is worth owning.

Return ONLY JSON: {"v":[{"i":<item number>,"a":"about"|"mention","s":"TICKER","t":"positive"|"negative"|"neutral"}]}`;

export interface SubjectInput {
  /** Stable key the caller uses to write the verdict back (url or id). */
  key: string;
  title: string;
  summary?: string | null;
  ticker: string;
  companyName?: string | null;
}

export interface SubjectAnswer {
  verdict: SubjectVerdict;
  /** For a mention: the ticker the article is really about, if the model named
   *  one. Unvalidated here; the caller checks it against the securities table. */
  subjectTicker?: string;
  /** What the article reports about the company. Replaces a hardcoded word
   *  count that agreed with a model on 54% of 80 rows (measured 2026-09-04),
   *  where "dividend" and "buy" scored positive and "debt" and "risk" negative. */
  tone?: 'positive' | 'negative' | 'neutral';
}

/**
 * Classify a batch of articles. Returns only the rows the model answered for;
 * anything missing from the map keeps a null verdict upstream.
 */
export async function classifySubjects(
  rows: SubjectInput[],
  log: string[],
): Promise<Map<string, SubjectAnswer>> {
  const out = new Map<string, SubjectAnswer>();
  if (rows.length === 0) return out;
  if (!hasAnthropicKey()) {
    log.push('[news] subject classifier skipped: no ANTHROPIC_API_KEY');
    return out;
  }

  const client = getAnthropic();
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const block = slice
      .map((r, n) =>
        `${n + 1}. COMPANY: ${r.companyName ?? r.ticker} (${r.ticker})\n   HEADLINE: ${r.title}\n   SUMMARY: ${(r.summary ?? '').slice(0, 240)}`)
      .join('\n\n');

    try {
      const res = await client.messages.create({
        model: SUBJECT_MODEL,
        max_tokens: 1500,
        system: TASK,
        messages: [{ role: 'user', content: block }],
      });
      const text = res.content
        .filter((c): c is { type: 'text'; text: string; citations: null } => c.type === 'text')
        .map((c) => c.text)
        .join('');
      const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
      const parsed = JSON.parse(json) as { v?: { i?: number; a?: string; s?: string; t?: string }[] };
      for (const v of parsed.v ?? []) {
        const idx = (v.i ?? 0) - 1;
        if (idx < 0 || idx >= slice.length) continue;
        if (v.a !== 'about' && v.a !== 'mention') continue;
        const proposed = typeof v.s === 'string' ? v.s.trim().toUpperCase() : '';
        const tone = v.t === 'positive' || v.t === 'negative' || v.t === 'neutral' ? v.t : undefined;
        out.set(slice[idx].key, {
          verdict: v.a,
          tone,
          // Shape check only. Whether it is a real listed company is the
          // caller's job, against the securities table.
          subjectTicker: v.a === 'mention' && /^[A-Z][A-Z.-]{0,5}$/.test(proposed) ? proposed : undefined,
        });
      }
    } catch (err) {
      // One bad batch must not lose the others.
      log.push(`[news] subject batch failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return out;
}
