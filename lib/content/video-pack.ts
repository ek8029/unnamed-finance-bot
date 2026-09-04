/**
 * The daily short-form video, built from what Helm already produces.
 *
 * Same discipline as the digest: code decides WHAT is said, from facts it can
 * point at, and nothing downstream may introduce a number or a quote. The
 * script here is templated rather than written by a model, because a four-beat
 * 60-word script has almost no room for phrasing and every word of it is a
 * public claim about a named company.
 *
 * Two formats, in priority order:
 *   catch   a filing or headline that contradicts a stated house thesis, with
 *           the verbatim sentence, its date and its source. Nobody else can
 *           make this one, because nobody else holds a register of reasons.
 *   filter  what the pipeline read and discarded today. Always available, and
 *           it is honest about the work rather than about any outcome.
 *
 * Deliberately absent: any price move after the fact, any lead-time claim, any
 * verb that tells a viewer what to do.
 */

import { verifyNumbers, describeCheck } from '@/lib/number-verify';
import { hasAdviceLanguage } from '@/lib/investigation-memo';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export type ClipFormat = 'catch' | 'filter';

export interface VideoPack {
  format: ClipFormat;
  date: string;
  /** Every figure the script is allowed to use, as written. */
  facts: string;
  /** Verbatim source sentence, for the catch format. Never paraphrased. */
  quote?: string;
  quoteSource?: string;
  quoteDate?: string;
  ticker?: string;
  pillarClaim?: string;
  counts?: { read: number; mentions: number; kept: number };
}

export interface Beat { label: string; text: string }
export interface VideoScript {
  pack: VideoPack;
  beats: Beat[];
  /** Words a narrator actually says. The quote is shown, not read. */
  spokenWordCount: number;
}

/** Marketing may not say things the product would never say. */
const BANNED = [
  /\bcalled it\b/i, /\bpredicted\b/i, /\bbefore the (drop|crash|fall|move)\b/i,
  /\bwe told you\b/i, /\bguarantee/i, /\bsafe bet\b/i, /\bsure thing\b/i,
  /\bwould have (made|saved)\b/i, /\bbeat the market\b/i, /\breturns?\b/i, /\balpha\b/i,
];

/** The day's catch: a contradiction filed against a pillar, with its receipt. */
async function buildCatchPack(db: AnyClient, sinceIso: string): Promise<VideoPack | null> {
  const { data } = await db
    .from('pillar_evidence')
    .select('excerpt, source_title, source_type, source_published_at, created_at, pillar_id, verdict, materiality')
    .eq('verdict', 'contradicts')
    .eq('materiality', 'material')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(20);

  for (const row of data ?? []) {
    const excerpt = (row.excerpt as string) ?? '';
    // A quote that will not fit on a phone screen is not a quote, it is a wall.
    if (excerpt.length < 40 || excerpt.length > 220) continue;
    const { data: pillar } = await db
      .from('thesis_pillars')
      .select('claim, thesis_id')
      .eq('id', row.pillar_id)
      .maybeSingle();
    if (!pillar?.claim) continue;
    const { data: thesis } = await db.from('theses').select('ticker').eq('id', pillar.thesis_id).maybeSingle();
    if (!thesis?.ticker) continue;

    return {
      format: 'catch',
      date: (row.created_at as string).slice(0, 10),
      ticker: (thesis.ticker as string).toUpperCase(),
      pillarClaim: pillar.claim as string,
      quote: excerpt,
      // The article's own headline is not a source name and is often a
      // paragraph. Say what KIND of document it was; the quote carries the rest.
      quoteSource: (row.source_type as string) === 'filing' ? 'an SEC filing' : 'a report',
      quoteDate: ((row.source_published_at as string) ?? (row.created_at as string)).slice(0, 10),
      facts: [pillar.claim, excerpt, (thesis.ticker as string).toUpperCase()].join('\n'),
    };
  }
  return null;
}

/** What the pipeline read and threw away. Always available. */
async function buildFilterPack(db: AnyClient, sinceIso: string): Promise<VideoPack> {
  const count = async (apply: (q: unknown) => unknown) => {
    let q = db.from('market_news').select('*', { count: 'exact', head: true }).gte('published_at', sinceIso);
    q = apply(q);
    const { count: n } = await q;
    return n ?? 0;
  };
  const read = await count((q) => q);
  const mentions = await count((q) => (q as { eq: (a: string, b: string) => unknown }).eq('subject_verdict', 'mention'));
  const kept = await count((q) => (q as { eq: (a: string, b: string) => unknown }).eq('subject_verdict', 'about'));
  const date = new Date().toISOString().slice(0, 10);
  return {
    format: 'filter',
    date,
    counts: { read, mentions, kept },
    facts: `read ${read}\nmentions ${mentions}\nkept ${kept}`,
  };
}

/** Pick the day's story. A catch beats the filter whenever one exists. */
export async function buildVideoPack(db: AnyClient, hoursBack = 24): Promise<VideoPack> {
  const since = new Date(Date.now() - hoursBack * 3600_000).toISOString();
  return (await buildCatchPack(db, since)) ?? (await buildFilterPack(db, since));
}

/**
 * Four beats, templated. The quote appears on screen and is never spoken, so a
 * narrator can never paraphrase a source document.
 */
export function scriptFromPack(pack: VideoPack): VideoScript {
  const beats: Beat[] =
    pack.format === 'catch'
      ? [
          { label: 'hook', text: `Someone owns ${pack.ticker} for this reason.` },
          { label: 'claim', text: pack.pillarClaim ?? '' },
          { label: 'turn', text: `Then this appeared in ${pack.quoteSource ?? 'a filing'} on ${pack.quoteDate}.` },
          { label: 'quote', text: pack.quote ?? '' },
          { label: 'close', text: 'Helm reads the filings against the reasons you wrote down.' },
        ]
      : [
          { label: 'hook', text: `Helm read ${pack.counts?.read} sources in the last day.` },
          { label: 'turn', text: `${pack.counts?.mentions} only mentioned the company they were filed under.` },
          { label: 'consequence', text: `${pack.counts?.kept} were actually about it. Those are the ones you see.` },
          { label: 'close', text: 'Helm reads the filings against the reasons you wrote down.' },
        ];

  // The quote beat is shown on screen, not narrated.
  const spoken = beats.filter((b) => b.label !== 'quote').map((b) => b.text).join(' ');
  return { pack, beats, spokenWordCount: spoken.split(/\s+/).filter(Boolean).length };
}

export interface ScriptCheck { ok: boolean; problems: string[] }

/**
 * Nothing renders unless this passes. Every figure must trace to the pack, the
 * quote must be the stored sentence character for character, no advice verb, no
 * marketing claim the product would never make, and it has to fit in 30 seconds.
 */
export function verifyScript(script: VideoScript, opts: { maxSpokenWords?: number } = {}): ScriptCheck {
  const problems: string[] = [];
  const spoken = script.beats.filter((b) => b.label !== 'quote').map((b) => b.text).join(' ');

  const figures = verifyNumbers(spoken, script.pack.facts);
  if (!figures.ok) problems.push(describeCheck(figures));

  if (script.pack.quote) {
    const shown = script.beats.find((b) => b.label === 'quote')?.text ?? '';
    if (shown !== script.pack.quote) problems.push('quote beat is not the stored sentence');
  }

  if (hasAdviceLanguage(spoken)) problems.push('advice language');
  for (const re of BANNED) if (re.test(spoken)) problems.push(`banned claim: ${re.source}`);

  const max = opts.maxSpokenWords ?? 70;
  if (script.spokenWordCount > max) problems.push(`${script.spokenWordCount} spoken words, over ${max}`);
  if (script.beats.some((b) => !b.text.trim())) problems.push('empty beat');

  return { ok: problems.length === 0, problems };
}
