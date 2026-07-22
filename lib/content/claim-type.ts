// Is this excerpt REPORTING something that happened, or is it somebody's VIEW
// about what might happen?
//
// The corroboration ladder counts independent confirmations, and it was getting
// that wrong because source class was inferred from the DOMAIN. Yahoo and Nasdaq
// are 741 of 1,000 sampled rows and they syndicate both kinds, so "France ended
// Palantir's contract with its intelligence agency" was filed as analyst
// opinion and discounted. We were discounting facts.
//
// Where a claim was printed says little. What the claim IS says everything, and
// that is legible in the text itself. Going forward the judge answers this
// directly at scoring time, where it has the whole source and gets it right;
// this classifier is the fallback for the 2,208 rows scored before the field
// existed. Measured on a blind sample, it is good, not perfect, which is the
// argument for the judge owning it rather than a regex.

export type ClaimType = 'reported_event' | 'opinion';

/**
 * Sell-side furniture. A price target or a rating IS an opinion however
 * factually it is written up, so this wins over everything else.
 */
const RATING_LANGUAGE =
  new RegExp(
    [
      '\\b(?:price target|target price)\\b',
      // A rating change, not "upgraded its membership tier".
      '\\b(?:down|up)grad(?:e|es|ed)\\b(?:\\W+\\w+){0,3}\\W+(?:stock|shares|rating|to\\s+(?:buy|sell|hold|neutral|overweight|underweight))\\b',
      '\\binitiat(?:e|es|ed) coverage\\b',
      '\\b(?:buy|sell|hold) rating\\b',
      '\\b(?:overweight|underweight|outperform|underperform)\\b',
      "\\banalysts?[’']? (?:say|says|said|note|expect|see)\\b",
      '\\bin a (?:research )?note\\b',
      '\\btold clients\\b',
      '\\bbeat[- ]and[- ]raise\\b',
      '\\bestimates? (?:are|is) too\\b',
      '\\b(?:raise|raises|raised|cut|cuts|lift|lifts|lifted|trim|trims|trimmed) (?:its )?(?:price )?target\\b',
    ].join('|'),
    'i',
  );

/**
 * Something that has already occurred, with an actor doing it. Stemmed, because
 * headlines are written in the present tense ("Amazon Launches Leo Broadband")
 * while excerpts are written in the past.
 */
const REPORTED_ACTION = new RegExp(
  '\\b(?:' +
    [
      // stems that take -s/-ed/-ing
      // The plain -s form matters most: headlines are present tense
      // ("Meta Expands Louisiana Data Center", "Amazon Launches Leo Broadband").
      '(?:announc|disclos|launch|unveil|expand|acquir|terminat|cancel|cancell|scrap|ditch|block|replac|sign|award|approv|reject|recall|resign|appoint|halt|suspend|settl|sue|fine|fil|report|open|issu|add|remov|rais|slash|hik|end|dump|hit)(?:e|es|s|ed|ing)?',
      // irregular / fixed forms
      "won(?![’']t)", 'lost', 'bought', 'sold', 'shut', 'cut', 'cuts',
      'rose', 'fell', 'dropped', 'jumped', 'slid', 'sank', 'surged', 'plunged', 'climbed', 'soared',
      'grew', 'shrank', 'missed', 'posted', 'delivered', 'stepped down', 'laid off',
      'increased', 'decreased', 'declined',
    ].join('|') +
    ')\\b',
  'i',
);

/**
 * A price or volume move with a number attached. Quantified is the whole point:
 * "Sell-In Drops 19%" is a measurement, "Might Keep Rising" is a hope, and only
 * the first can corroborate anything.
 */
const QUANTIFIED_MOVE =
  /\b(?:drop|slide|plunge|surge|sink|climb|jump|rise|fall|gain|slip|tumble|rall(?:y|ie)|sag|spike)(?:s|es|ed|d)?\s+(?:by\s+)?\d+(?:\.\d+)?\s?%/i;

/**
 * Commentary and listicle framing. The piece exists to argue a view, whatever
 * facts it cites along the way.
 */
const COMMENTARY =
  /\b(stocks? to buy|should investors|is a buy|here'?s why|here is why|what'?s driving|price prediction|worth this much|best .{0,20}stocks|hypergrowth|why this|can .{0,25}(?:double|hold|keep)|looks? (?:beaten|cheap|expensive)|valuation is)\b/i;

/** Somebody's read of the world rather than an account of it. */
const ATTRIBUTED_VIEW =
  /\b(expects?|expected|anticipat(?:e|es|ed)|forecasts?|projects?|predicts?|predicted|sees|warns?|warned|cautious|bullish|bearish|optimistic|pessimistic|believes?|argues?|suggests?|could|may|might|would|poised to|set to|on track to|likely to)\b/i;

/**
 * Classify a piece of news by what it claims.
 *
 * Order matters. Sell-side framing wins outright. Then a concrete past event
 * beats hedged language, because real reports routinely carry both ("Apple
 * raised prices, which could weigh on demand") and the raised price is the fact.
 * Anything with no signal at all defaults to opinion, so an unrecognised item
 * can never escalate a pillar on its own.
 */
export function classifyClaim(text: string): ClaimType {
  if (RATING_LANGUAGE.test(text)) return 'opinion';
  if (QUANTIFIED_MOVE.test(text) || REPORTED_ACTION.test(text)) return 'reported_event';
  if (COMMENTARY.test(text) || ATTRIBUTED_VIEW.test(text)) return 'opinion';
  return 'opinion';
}
