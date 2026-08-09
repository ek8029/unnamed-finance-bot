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
const NEWS_JUNK: { re: RegExp; name: string; maxStart?: number }[] = [
  // A columnist writing in the first person is not evidence about a company.
  // "we" is dropped on purpose. It is how a columnist writes AND how a CFO
  // speaks, and quoted management commentary is the most valuable news evidence
  // there is: "We have been seeing unprecedented demand for MI300 accelerators,
  // CEO Lisa Su said" was being deleted as somebody's opinion. "I" and "my"
  // carry the rule on their own.
  { re: /\b(?:I|my)\s+(?:keep|kept|bought|sold|own|owned|love|like|think|believe|would|am|have been)\b/, name: 'first-person-opinion' },
  { re: /\b(?:here(?:'|’)?s why|why I\b|my take\b|I(?:'|’)(?:m|ve)\b)/i, name: 'first-person-opinion' },
  // A rating change and a price target are facts about an analyst, not about
  // the underlying business. They can move the stock, but they are not evidence
  // for or against somebody's reasoning about the company.
  { re: /\b(?:upgraded?|downgraded?|reiterated?|initiated coverage)\b[^.]{0,60}\b(?:to|from)\s+(?:buy|sell|hold|neutral|overweight|underweight|outperform|market perform)\b/i, name: 'analyst-rating' },
  // Deliberately UNANCHORED, and it was briefly anchored by mistake. Anchoring
  // at 40 characters was meant to spare one row whose subject was a competitive
  // threat and whose last four words happened to be "$1,550 price target". Run
  // against the real backup it also let back "BofA Securities analyst Wamsi
  // Mohan reiterated a Buy rating on the stock with a $380.00 price target" and
  // seven more of that shape, which open with the analyst and put the number at
  // the end too. One debatable deletion beats eight certain ones.
  { re: /\bprice targets?\b/i, name: 'analyst-rating' },
  { re: /\banalysts?\s+(?:expect|estimate|forecast|predict|say|see)\b/i, name: 'analyst-opinion', maxStart: 12 },
  // Ranked listicles and promotional roundups.
  //
  // The rank has to bind to a stock noun. `\d+\s+(best|top|worst)` on its own
  // deleted "Full-year 2026 top-line revenue rose 14%" and "Nvidia's 3 top
  // customers accounted for 39% of revenue" — a top-line result and a customer
  // concentration fact, both of which are exactly what a pillar is made of.
  { re: /\b\d+\s+(?:best|top|worst)\s+(?:[\w-]+\s+){0,3}stocks?\b/i, name: 'listicle' },
  { re: /\b(?:best\s+stocks?\s+to\s+buy|top\s+\d+\s+stocks?)\b/i, name: 'listicle' },
];

/** Corporate self-description with no content. True of every company on every
 *  day, so it can neither support nor contradict anybody's reasoning. */
const PUFFERY: { re: RegExp; name: string }[] = [
  { re: /\bwell[-\s]positioned\b/i, name: 'puffery' },
  { re: /\bpoised (?:for|to)\b/i, name: 'puffery' },
  { re: /\bremains? (?:confident|optimistic) (?:about|in|that)\b/i, name: 'puffery' },
  { re: /\bcommitted to (?:delivering|driving|creating|building)\b/i, name: 'puffery' },
];

/** A filing describing its own structure or accounting policy. Real MD&A, not
 *  boilerplate, but it reports no event and no change, so it is not evidence.
 *
 *  This replaced a heuristic that demanded a figure or a date in any filing
 *  citation. That rule read as reasonable and was wrong: on the real corpus it
 *  killed "we are reaffirming our fiscal year revenue guidance range and
 *  raising our full year guidance ranges", "Broadcom to develop and supply a
 *  range of custom ASIC silicon products for use in multiple generations of
 *  Apple products", and "the increase in costs and expenses was primarily due
 *  to increases in employee compensation, including severance expenses" —
 *  6 of the 12 rows it touched were genuine findings. An explicit list of junk
 *  shapes is checkable against the corpus; "has a number in it" is not. */
const FILING_DESCRIPTIVE: { re: RegExp; name: string }[] = [
  { re: /\bwe have (?:two|three|four|five|six|\d+) (?:operating|reportable) segments\b/i, name: 'segment-description' },
  { re: /\bour (?:operating|reportable) segments are\b/i, name: 'segment-description' },
  { re: /\brevenue is (?:generally )?recognized\b/i, name: 'accounting-policy' },
  { re: /\bare unsecured and unsubordinated obligations\b/i, name: 'prospectus-terms' },
  { re: /\bwhich we refer to as\b/i, name: 'defined-term' },
];

/**
 * Something a person could go and check: money, a percentage, or a magnitude.
 *
 * Deliberately NOT `/\d/`. Any-digit counted a year as evidence, so "Nvidia
 * looks poised to have strong growth in 2027" read as checkable and survived
 * the puffery rule on the strength of "2027".
 */
const HAS_FIGURE = /[$€£]\s?[\d,.]+|\b\d+(?:\.\d+)?\s?%|\b\d{1,3}(?:,\d{3})+\b|\b\d+(?:\.\d+)?\s?(?:billion|million|trillion|bn|mn)\b/i;

/** A preamble preceded by a negation is a finding, not boilerplate. "Not
 *  prepared in accordance with GAAP" is an accounting failure and differs from
 *  the boilerplate it matches by a single word. */
const NEGATED = /\b(?:not|never|failed to|were not|was not|does not|did not)\s+(?:\w+\s+){0,3}(?:prepared|incorporated|recognized|recognised|audited|read)\b/i;

export interface CitationDefect {
  code: string;
  detail: string;
  /** `hard` means the citation says nothing and is safe to delete outright.
   *  `soft` means the text is real but presented badly — reject it at ingest,
   *  where a better sentence from the same source is one retry away, but do
   *  not purge it from rows already written. The chopped-clause rule is the
   *  reason this distinction exists: "the UK government has formally launched
   *  a comprehensive review of its £330 million NHS contract with Palantir"
   *  starts mid-sentence and is still one of the most material findings in
   *  the corpus. */
  severity: 'hard' | 'soft';
}

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
  if (!raw) return { code: 'empty', detail: 'no excerpt', severity: 'hard' };

  // price_move and xbrl rows are system-generated strings, not prose lifted from
  // a document. They are exempt: they would fail the verb test by design.
  if (sourceType === 'price_move' || sourceType === 'xbrl') return null;

  // A preamble rule matches its own negation: "not prepared in accordance with
  // GAAP" is an accounting failure and close to the strongest contradicting
  // evidence obtainable, and it differs from the boilerplate by one word.
  for (const b of BOILERPLATE) {
    if (b.re.test(raw) && !NEGATED.test(raw)) return { code: 'boilerplate', detail: b.name, severity: 'hard' };
  }

  // Puffery only DELETES when it is the whole predicate. "Nvidia remains well
  // positioned in the AI infrastructure market" says nothing; "Intel is poised
  // to receive $8.5 billion in direct CHIPS Act funding, the Commerce
  // Department said" is a dated event with a figure that happens to contain a
  // journalistic idiom. Anything carrying something checkable drops to soft.
  for (const p of PUFFERY) {
    if (p.re.test(raw)) {
      return { code: 'boilerplate', detail: p.name, severity: HAS_FIGURE.test(raw) ? 'soft' : 'hard' };
    }
  }

  if (sourceType === 'filing') {
    for (const f of FILING_DESCRIPTIVE) {
      if (f.re.test(raw)) return { code: 'unfalsifiable', detail: f.name, severity: 'hard' };
    }
  }

  if (sourceType === 'news') {
    for (const n of NEWS_JUNK) {
      // An analyst's outlook quoted as a trailing clause does not make the
      // sentence about the analyst. "Broadcom's Tomahawk 6 ASIC, 102.4Tbps
      // across 64 ports of 1.6Tbps - which industry analysts expect to make up
      // the majority of new AI ports by 2027" is evidence about a product;
      // "Analysts expect tariff refunds to offset the discounts" is not. The
      // difference is whether the analyst is the subject, so this rule only
      // fires near the start of the excerpt.
      if (n.maxStart != null) {
        const m = n.re.exec(raw);
        if (m && m.index <= n.maxStart) return { code: 'news-noise', detail: n.name, severity: 'hard' };
        continue;
      }
      if (n.re.test(raw)) return { code: 'news-noise', detail: n.name, severity: 'hard' };
    }
  }

  const words = raw.split(/\s+/).filter(Boolean);

  // A caption, a table footnote, or an event with its subject cut off.
  //
  // Length alone is the wrong test and a purge proved it: "North America
  // revenue declined 3% while China grew 30%." and "Apple China iPhone Sell-In
  // Drops 19%" are nine and six words, and both are material contradicting
  // evidence. A short line that carries a figure is a headline, not a caption.
  // So the bar is length AND whether there is anything checkable in it, and
  // the ambiguous middle is soft: rejected at ingest, where a better sentence
  // from the same article is one retry away, but not deleted retroactively.
  // The figure test runs at EVERY length under ten, not just from six up. It
  // was gated at six, so "Meta up to $145 billion" (five words, carries a
  // figure) was hard-deleted while "Apple China iPhone Sell-In Drops 19%" (six)
  // was protected. One word of difference on lines of identical character.
  if (words.length < 10 && !HAS_FIGURE.test(raw)) {
    return {
      code: 'fragment',
      detail: words.length < 6 ? `${words.length} words` : `${words.length} words, nothing checkable`,
      severity: words.length < 6 ? 'hard' : 'soft',
    };
  }
  // A short noun phrase that exists only to introduce a defined term. The same
  // event written properly ("Strategy announced a new $21.0 billion offering of
  // MSTR Stock (the "MSTR Increase")") is longer and survives; the headless
  // version does not. A verb-list test caught this too, but it mis-dropped 252
  // real findings on verbs that were simply not in the list.
  if (words.length < 12 && /\((?:the|collectively)[^)]*["“”][^)]*\)\.?$/.test(raw)) {
    return { code: 'fragment', detail: 'defined-term stub', severity: 'hard' };
  }
  // Mid-sentence starts are a chopped clause: reject at ingest, but soft,
  // because the words that are there are usually true and sometimes material.
  if (/^[a-z]/.test(raw)) {
    return { code: 'fragment', detail: 'starts mid-sentence', severity: 'soft' };
  }

  return null;
}
