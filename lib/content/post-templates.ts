// Pure templating for the daily content studio (/admin/studio). Turns the real catch +
// thesis data into copy-paste-ready posts in the research-backed franchises:
// "what my agent caught", thesis teardowns, and a thesis scoreboard.
//
// Honesty rules: verdict drives the framing (supports -> "held/confirmed", contradicts ->
// "broke", never claim a break that did not happen). Verbatim cites are quoted as-is. No
// fabricated numbers. No em dashes (brand).

export interface StudioCatch {
  ticker: string;
  company: string | null;
  pillar_claim: string | null;
  verdict: string;
  verbatim_cite: string;
  cite_date: string | null;
  run_date: string | null;
  source_type: string | null;
  source_url: string | null;
}

export interface StudioThesis {
  ticker: string;
  company: string;
  pillars: { claim: string; breaks_if: string }[];
}

export interface StudioScoreRow {
  ticker: string;
  healthLabel: string;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function sourceLabel(t: string | null): string {
  if (t === 'filing') return 'the SEC filing';
  return 'the news';
}

function verdictVerb(verdict: string): string {
  if (verdict === 'contradicts') return 'just cracked';
  if (verdict === 'supports') return 'just held up';
  return 'was just tested';
}

function trimCite(cite: string, max = 220): string {
  const c = cite.trim();
  return c.length <= max ? c : `${c.slice(0, max - 1).trim()}...`;
}

/** The flagship X franchise: "what my agent caught". One real catch, one post. */
export function catchToXPost(c: StudioCatch): string {
  const name = c.company && c.company !== c.ticker ? `${c.company} ($${c.ticker})` : `$${c.ticker}`;
  const when = fmtDate(c.cite_date ?? c.run_date);
  const reason = c.pillar_claim ? `\n\nThe reason on the line: ${c.pillar_claim}` : '';
  return [
    `${name}: a reason to own it ${verdictVerb(c.verdict)}, and the agent caught it in ${sourceLabel(c.source_type)}.`,
    `"${trimCite(c.verbatim_cite)}"`,
    `${when ? when + ' · ' : ''}Helm watches the thesis, not the ticker.${reason}`,
  ].join('\n\n');
}

/** Longer-form for LinkedIn / a thread lead. */
export function catchToLongPost(c: StudioCatch): string {
  const name = c.company && c.company !== c.ticker ? `${c.company} (${c.ticker})` : c.ticker;
  const when = fmtDate(c.cite_date ?? c.run_date);
  return [
    `Most investors track the price. Almost nobody tracks the reasons they bought.`,
    `Here is one the agent caught on ${name}${when ? `, ${when}` : ''}.`,
    c.pillar_claim ? `The pillar under test: ${c.pillar_claim}` : '',
    `Straight from ${sourceLabel(c.source_type)}:`,
    `"${trimCite(c.verbatim_cite, 400)}"`,
    `That is thesis monitoring: you write the reasons you own a stock, the single fact that would break each one, and let the agent watch the primary sources so you find out in days, not quarters.`,
    `Research, not investment advice.`,
  ].filter(Boolean).join('\n\n');
}

/** Thesis teardown thread: the pillars + the breaks-if falsifiers. Pure house-thesis data. */
export function thesisTeardownX(t: StudioThesis): string {
  const lines = t.pillars
    .map((p, i) => `${i + 1}. ${p.claim}\n   Breaks if: ${p.breaks_if}`)
    .join('\n\n');
  return [
    `Why people own ${t.company} ($${t.ticker}), and the single fact that would break each reason:`,
    lines,
    `Write the reasons. Write what kills them. Then watch the filings against them. That is the whole game.`,
  ].join('\n\n');
}

/** The always-on shareable number: thesis intactness across watched names. */
export function scoreboardPost(rows: StudioScoreRow[], todayISO: string): string {
  const body = rows.map((r) => `${r.ticker}: ${r.healthLabel}`).join('\n');
  return [
    `Thesis intactness across the most-watched names, ${fmtDate(todayISO)}:`,
    body,
    `Each status is computed from dated SEC-filing and news evidence tested against the reasons to own the stock. Not vibes.`,
  ].join('\n\n');
}
