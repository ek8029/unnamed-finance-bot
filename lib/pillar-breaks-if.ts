// The kill criterion is the only thing that makes a pillar falsifiable.
//
// lib/score-theses.ts pastes `breaks_if` straight into the judge prompt, and the
// judge is instructed to return `contradicts` only when a source advances that
// condition. So a pillar with no breaks_if, or one whose breaks_if names nothing
// observable, can never be contradicted however well the claim reads. Measured
// on live data: of 297 confirmed pillars only 57 carry one, and 0 of the 164
// user-authored ones do. Those 164 are decoration to the scorer.
//
// The rule below is deliberately loose. A false reject costs a real person their
// own words at the moment they are writing down why they own something; a soft
// pass costs one weak kill criterion that the judge will simply rarely fire on.
// Err toward accepting.

/** Matches the claim limit in POST /api/thesis/[ticker]. */
export const BREAKS_IF_MAX = 500;

const MIN_WORDS = 4;

/**
 * Whole-string restatements of "the claim turns out to be wrong". These name no
 * new observable, so the judge has nothing to match a source against. Anchored
 * at both ends on purpose: "if the thesis is wrong about pricing power because
 * gross margin falls" must pass.
 */
const CONTENTLESS: RegExp[] = [
  /^(if )?(i am|im|it|this|that|the (claim|thesis|pillar|idea|story|case))( is| turns out| proves)?( to be)? (wrong|false|untrue|incorrect|not true|mistaken)$/,
  /^(if )?(it|this|that|the (claim|thesis|pillar|company|business|stock)) (does not|doesnt|dont|do not|fails to) (work|hold|hold up|pan out|play out|deliver|happen)$/,
  /^(if )?(it|this|that|they|the (company|business|stock)) (fails|failed|stops working|breaks|breaks down|underperforms|disappoints)$/,
  /^(if )?(things|circumstances|conditions|the (market|situation|environment)) change[sd]?$/,
  /^(if )?(bad|good) news$/,
  /^(if )?i (am|m) (proven )?wrong$/,
  /^(if )?(new|different) information (comes out|emerges|appears)$/,
  /^(if )?(the )?(fundamentals|numbers|results) (get )?(worse|deteriorate|decline|weaken)$/,
];

/**
 * Something a filing, a headline or a print can actually be matched against: a
 * number, a metric noun, or a named corporate/regulatory event. One hit is
 * enough — requiring a direction verb as well (the offline classifier's stricter
 * rule) rejects usable criteria like "a 10-K disclosing loss of a top customer".
 */
const ANCHOR =
  /(\d|%|\b(revenue|revenues|sales|margin|margins|earnings|eps|profit|profits|income|guidance|forecast|outlook|growth|share|shares|shipment|shipments|unit|units|volume|volumes|subscriber|subscribers|user|users|customer|customers|churn|retention|backlog|booking|bookings|order|orders|contract|contracts|renewal|renewals|price|prices|pricing|cost|costs|capex|opex|spend|spending|cash flow|fcf|debt|leverage|dividend|buyback|buybacks|repurchase|repurchases|inventory|headcount|layoff|layoffs|filing|filings|10-k|10-q|8-k|proxy|segment|segments|product|products|launch|launches|recall|lawsuit|litigation|settlement|regulator|regulators|regulatory|antitrust|approval|approvals|licence|license|patent|patents|competitor|competitors|rival|rivals|acquisition|acquisitions|merger|divestiture|divest|spinoff|spin-off|ceo|cfo|coo|founder|management|board|resigns|resignation|plant|plants|fab|fabs|factory|store|stores|capacity|utilization|utilisation|yield|yields|occupancy|aum|deposits|loans|arpu|take rate|traffic|downloads|installs|partnership|partner|partners|supplier|suppliers|tariff|tariffs|subsidy|subsidies|market share|basis points|bps|percent|quarter|quarters|quarterly|annual|year-over-year|yoy|guidance cut|impairment|writedown|write-down|bankruptcy|default|covenant|dilution|offering)\b)/i;

export type BreaksIfResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

/**
 * Validate a user-authored kill criterion. Server-side is the part that must be
 * right; the forms import this so the rule is the same one in both places.
 */
export function validateBreaksIf(raw: unknown): BreaksIfResult {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return {
      ok: false,
      error:
        'Add what would break this. Name the metric, filing or event you would check and which way it has to move.',
    };
  }

  const value = raw.trim().replace(/\s+/g, ' ');

  if (value.length > BREAKS_IF_MAX) {
    return { ok: false, error: `Keep this to ${BREAKS_IF_MAX} characters or fewer.` };
  }

  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9%\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized.split(' ').filter(Boolean).length < MIN_WORDS) {
    return {
      ok: false,
      error:
        'Too short to check against anything. Name the metric, filing or event and which way it has to move.',
    };
  }

  if (CONTENTLESS.some((re) => re.test(normalized))) {
    return {
      ok: false,
      error:
        'That only says the claim turns out to be wrong. Name what you would check: a metric, a direction, a threshold or a named event.',
    };
  }

  if (!ANCHOR.test(value)) {
    return {
      ok: false,
      error:
        'Nothing here is checkable against a filing or a headline. Name a metric, a threshold or a named event (a guidance cut, a margin print, a lost contract).',
    };
  }

  return { ok: true, value };
}
