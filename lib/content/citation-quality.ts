// Is this citation actually evidence, or is it a sentence that happened to be
// near the subject?
//
// The judge scores relevance, and relevance is not the same test. A 10-Q's
// safe-harbor paragraph mentions "fluctuations in the price of Bitcoin", so
// against a pillar about tracking a BTC stack it looks profoundly on-topic —
// and it was filed as CONTRADICTING evidence. It appears verbatim in every
// filing the company has ever made and says nothing about anything.
//
// Real rows this was written against (MSTR, August 2026):
//   contradicts  "Actual results may differ materially from these
//                 forward-looking statements due to various important factors,
//                 including fluctuations in the price of Bitcoin and the risk
//                 factors discussed under the caption Risk Factors…"
//   supports     "net proceeds are presented net of sales commission."
//   supports     "$21.0 billion offering of MSTR Stock (the "MSTR Increase")."
//   supports     "Strategy announced a new $21.0 billion offering of MSTR
//                 Stock (the "MSTR Increase")."
// Only the last is a finding. The first is boilerplate, the second is a table
// footnote, the third is the same event as the fourth with the subject and verb
// cut off.
//
// This is the sentence-level version of a fix already made at the form level:
// 297 of 347 filing rows were once 424B2/FWP prospectus boilerplate and were
// purged with a form allowlist. Same disease, finer grain.
//
// It runs AFTER the judge and BEFORE the row is written, alongside the existing
// hedged-connection and excerpt-found-in-source guards.

/** Language that appears in a filing because the lawyers require it, not
 *  because anything happened. Matched on the phrasing, not on single words:
 *  "risk factors" alone is a legitimate thing to write about. */
const BOILERPLATE: { re: RegExp; name: string }[] = [
  { re: /actual results\s+(?:may|could|might)\s+differ\s+materially/i, name: 'safe-harbor' },
  { re: /forward[-\s]looking statements?\b(?![^.]*\b(?:withdrew|withdrawn|revised|lowered|raised)\b)/i, name: 'forward-looking-statements' },
  { re: /private securities litigation reform act/i, name: 'PSLRA' },
  { re: /undertakes?\s+no\s+obligation\s+to\s+(?:publicly\s+)?update/i, name: 'no-obligation-to-update' },
  { re: /risk factors\s+(?:discussed|described|set forth|included|contained)\s+(?:under|in|elsewhere)/i, name: 'risk-factors-pointer' },
  { re: /incorporated\s+(?:herein\s+)?by\s+reference/i, name: 'incorporation-by-reference' },
  { re: /should be read in conjunction with/i, name: 'read-in-conjunction' },
  { re: /see\s+(?:note|item)\s+\d+/i, name: 'cross-reference' },
  { re: /the accompanying (?:unaudited )?(?:condensed )?consolidated financial statements/i, name: 'financial-statement-preamble' },
  { re: /prepared in accordance with (?:u\.?s\.?\s+)?gaap/i, name: 'gaap-preamble' },
];


/** News-only defects. The corpus is 96% news, and its junk has a different
 *  shape from a filing's: not boilerplate, but somebody's opinion or a broker's
 *  rating dressed as a finding about the business. */
const NEWS_JUNK: { re: RegExp; name: string }[] = [
  // A columnist writing in the first person is not evidence about a company.
  { re: /(?:I|we|my|me)\s+(?:keep|kept|bought|sold|own|love|like|think|believe|would|am|have been)/i, name: 'first-person-opinion' },
  { re: /(?:here(?:'|’)?s why|why I|my take|I(?:'|’)?(?:m|ve))/i, name: 'first-person-opinion' },
  // A rating change is a fact about an analyst, not about the underlying.
  { re: /(?:upgraded?|downgraded?|reiterated?|initiated coverage)[^.]{0,60}(?:to|from)\s+(?:buy|sell|hold|neutral|overweight|underweight|outperform)/i, name: 'analyst-rating' },
  { re: /price target/i, name: 'analyst-rating' },
  { re: /analysts?\s+(?:expect|estimate|forecast|predict|say|see)/i, name: 'analyst-opinion' },
  // Ranked listicles and promotional roundups.
  { re: /(?:\d+\s+(?:best|top|worst)|best\s+stocks?\s+to\s+buy|top\s+\d+\s+stocks?)/i, name: 'listicle' },
];

/** Something checkable: a figure, a percentage, or a date. */
const HAS_FIGURE = /\d/;
const HAS_MONTH = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/i;

export interface CitationDefect { code: string; detail: string }

/**
 * Returns the reason this citation is not evidence, or null if it passes.
 *
 * `verdict` matters because the bar is different: a citation that merely adds
 * context can be a quiet sentence, but one that claims to SUPPORT or CONTRADICT
 * somebody's investment reasoning has to contain something a person could go
 * and check.
 */
export function citationDefect(
  excerpt: string | null | undefined,
  verdict: 'supports' | 'contradicts' | 'neutral',
  sourceType?: string,
): CitationDefect | null {
  const raw = (excerpt ?? '').replace(/\s+/g, ' ').trim();
  if (!raw) return { code: 'empty', detail: 'no excerpt' };

  // price_move and xbrl rows are system-generated strings, not prose lifted from
  // a document. They are exempt: they would fail the verb test by design.
  if (sourceType === 'price_move' || sourceType === 'xbrl') return null;

  for (const b of BOILERPLATE) {
    if (b.re.test(raw)) return { code: 'boilerplate', detail: b.name };
  }

  if (sourceType === 'news') {
    for (const n of NEWS_JUNK) {
      if (n.re.test(raw)) return { code: 'news-noise', detail: n.name };
    }
  }

  const words = raw.split(/\s+/).filter(Boolean);

  // A caption, a table footnote, or an event with its subject cut off.
  if (words.length < 10) {
    return { code: 'fragment', detail: `${words.length} words` };
  }
  // A short noun phrase that exists only to introduce a defined term. The same
  // event written properly ("Strategy announced a new $21.0 billion offering of
  // MSTR Stock (the "MSTR Increase")") is longer and survives; the headless
  // version does not. A verb-list test caught this too, but it mis-dropped 252
  // real findings on verbs that were simply not in the list.
  if (words.length < 12 && /\((?:the|collectively)[^)]*["“”][^)]*\)\.?$/.test(raw)) {
    return { code: 'fragment', detail: 'defined-term stub' };
  }
  // Mid-sentence starts are almost always a chopped clause. A leading figure is
  // fine ("$21.0 billion of notes were issued"), a leading lowercase word is not.
  if (/^[a-z]/.test(raw)) {
    return { code: 'fragment', detail: 'starts mid-sentence' };
  }

  // A material claim drawn from a FILING with nothing checkable in it is an
  // assertion, not evidence. Scoped to filings on purpose: a news headline
  // ("Services segment hits record revenues") is a legitimate finding without a
  // figure in the sentence, and an earlier cut of this rule dropped 353 of them.
  if (sourceType === 'filing' && verdict !== 'neutral' && !HAS_FIGURE.test(raw) && !HAS_MONTH.test(raw)) {
    return { code: 'unfalsifiable', detail: 'filing claim with no figure or date' };
  }

  return null;
}
