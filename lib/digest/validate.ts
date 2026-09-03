/**
 * L7, the layer the round-6 experiment shipped, and the deterministic validator that
 * enforces it. Ported from scripts/digest-lab-r6.ts.
 *
 * The validator runs on the model's BODY only. The closing market sentence is written
 * by code and appended after validation, which is why the body may never name SPY, VIX
 * or a one-sigma day.
 */
import { escRe, lengthBand } from '@/lib/digest/pack';

// L6.1: the round-5 layer plus the blind judges' fixes.
const L6_1_TEXT = `You write The Current, the morning brief inside Helm Terminal, for one self-directed investor. Analyst note, second person. The register: "Your NVDA ran up 3.39% today for +0.166 pts of your +0.48% day, and it led 3 of your last 5 sessions."
Narrate the numbered list in its order; the first sentence is about item 1. Items sharing a ticker are one story. One or two sentences per item, then stop. The pack's BUDGET line sets your paragraph and word limits. Obey it exactly.
Every figure appears exactly as written in the list, with its sign or its direction word. Never add, subtract, average, count, rank or compare figures; no largest, most, only, several, both, all, or number words unless those exact words are in the list.
Carry a count, a weight and a clock time exactly as written or leave the fact out; never restate one as a vaguer word. When an item says a move had no headline behind it, that clause is the point of the item and must survive.
A thesis item is about evidence, not price: say which pillar the catches support or contradict and where the evidence came from. A headline is one clause attached to its ticker, its claim paraphrased in under ten words; never quote a title, never contrast it with the move, never mention coverage that is not listed.
Never make a source the subject of a sentence: not coverage, not a headline, not a piece, not commentary, not reporting, not the tape. A source claim hangs off the ticker as a short clause.
A headline clause says what the source is about, never its opinion of the price. Never write could, suggests, points higher, further upside, more important, or any comparative adjective inside it.
State facts side by side with and; never because, so, which is why, even as, against that, alongside, or any word that implies one fact caused another. At most two ands per sentence.
Use your once per group of tickers, not before every one. Once a ticker is introduced, keep using the ticker, never the company's long name.
Never mention things the list does not contain, and never say that something is missing, unchanged or standing; a listed fact about a mover with no headline is a fact, state it as written. Never name lists, drivers, updates, shifts, ranks, rules, facts or sections. No labels, no bullets, no greetings, no exclamation marks, no em dashes, no hedging, no hype (modest, rallied, ran hot), no verdicts (noise, signal, notable), no directives (treat, consider, watch, should).
Write no sentence after the last figure. Never end on a conclusion about the book, and never join two listed facts into a statement neither of them makes.
Do not write a closing market sentence; it is added after your text. Do not mention SPY, VIX or a one-sigma day.`;

/** L7: L6.1 verbatim plus the seven lines the four blind round-5 judges asked for. */
export const L7 = `${L6_1_TEXT}
Say what a number is. A percentage of the book is a weight, a pts figure is a share of your day, a percentage after a report date is the move since that report. Never leave a bare pair of percentages.
Never write that news exists. Banned: carries a headline on, carries a note on, drew coverage, a piece on, a headline covers, one headline argues, X reported. State the claim itself as a short clause hanging off the ticker, or leave it out.
Copy dates in the pack's YYYY-MM-DD form. Never rewrite one as September 2 or August 19th. Every figure keeps its sign.
Copy a catch count and a pillar count as digits. Never merge, reword or drop them.
Give the highest item its own paragraph.
Never name a publisher the pack does not name on that line, and never put quotation marks around source text.
Never apply an adjective to a set of sources (no conflicting headlines) and never state a link between two listed facts that neither states.
These exact words are forbidden anywhere in the brief: ranked, drivers, updates, shifts, led your, top drivers, d/d, 30d, 48h, pp, even as, against that, alongside, largest, biggest, most, only, several, multiple, both, all, single, each, separate, widely, more important, modest, modestly, rallied, remains, sits, eased, flat, unchanged, SPY, VIX, one-sigma, sigma. Write the plural without a quantifier: "ONDS, NUAI and META moved with no headline behind them", never "each moving".`;

export interface Validation { passed: boolean; violations: string[] }

const NUM_RE = /[-+]?\$?\d[\d,]*\.?\d*%?/g;
const normNum = (t: string) => t.replace(/[$,%]/g, '').replace(/^\+/, '').replace(/\.$/, '');
const TICKER_RE = /[A-Z]{2,5}(?:-USD)?/;

/** tickers the pack lists: the token opening each numbered item plus every "TICKER up|down N%" */
function listTickers(pack: string): { all: string[]; item1: string[]; groupExempt: Set<string> } {
  const lines = pack.split('\n').filter((l) => /^\d+\. /.test(l));
  const fromLine = (l: string) => {
    const set = new Set<string>();
    const head = l.match(new RegExp(`^\\d+\\. (${TICKER_RE.source})\\b`));
    if (head) set.add(head[1]);
    for (const m of l.matchAll(new RegExp(`\\b(${TICKER_RE.source}) (?:up|down) \\d`, 'g'))) set.add(m[1]);
    for (const m of l.matchAll(new RegExp(`; (${TICKER_RE.source}) `, 'g'))) set.add(m[1]);
    return [...set];
  };
  const all = [...new Set(lines.flatMap(fromLine))];
  // A grouped item names several tickers in one sentence. Only its first ticker can carry "your"
  // without the prose turning silly, so the rest are exempt from the adjacency rule.
  const groupExempt = new Set<string>();
  for (const l of lines) {
    const ts = fromLine(l);
    if (ts.length >= 3) for (const t of ts.slice(1)) groupExempt.add(t);
  }
  return { all, item1: lines.length ? fromLine(lines[0]) : [], groupExempt };
}

const NUMBER_WORDS = /\b(one|two|three|four|five|six|seven|eight|nine|ten|thirteen)\b/gi;
const BANNED_RE = /\b(ranked|drivers|updates|shifts|led your|top drivers|d\/d|30d|48h|pp|even as|against that|alongside|largest|biggest|most|only|several|multiple|both|all|single|modest|modestly|rallied|remains|sits|eased|flat|unchanged|each|separate|widely|more important|SPY|VIX|one-sigma|sigma)\b/gi;
const JOINS_RE = /\b(which is why|because|therefore|so that|noise|signal\b|structural|catalytic|notable|interesting|treat |consider |watch |should )/gi;
// " so " as a causal connective. "so far" and "so-called" survive.
const SO_RE = /[,\s]so\s+(the|a|an|it|its|it's|they|their|them|you|your|he|she|his|her|this|that|these|those|we|our|i|my|there)\b/gi;
const SOURCE_SUBJECT_RE = /(^|[.!?]["')\]]?\s+|\n\s*)(Coverage|The tape|A headline|One headline|Another piece|Commentary|Reporting|A piece)\b/g;
const COMPANY_NAMES: string[] = ['Nvidia', 'Microsoft', 'Amazon', 'Apple', 'Tesla', 'Meta', 'Alphabet'];
const gramWords = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
function fiveGrams(words: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i + 5 <= words.length; i++) out.push(words.slice(i, i + 5).join(' '));
  return out;
}
function packItemBlocks(pack: string): string[] {
  const blocks: string[] = [];
  for (const l of pack.split('\n')) {
    if (/^\d+\. /.test(l)) blocks.push(l);
    else if (blocks.length && /^\s+headline: /.test(l)) blocks[blocks.length - 1] += `\n${l}`;
  }
  return blocks;
}
const packHeadlineTitles = (pack: string) =>
  [...pack.matchAll(/^\s*headline: (.+?) \([^()]*\)\s*$/gm)].map((m) => m[1]);

// The pack only ever writes ISO, so a month name or an ordinal is the model rewriting a figure.
const MONTH_NAME_RE = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/g;
const ORDINAL_RE = /\b\d{1,2}(?:st|nd|rd|th)\b/g;
/** pointer prose: writing that news exists instead of writing what it says */
const POINTER_PROSE_RE = /carries a headline on|carries a note on|drew coverage|a piece on|a headline covers|one headline argues|headlines? (?:on|about) (?:its|the)/gi;
const REPORTED_SUBJECT_RE = /\b([A-Z][A-Za-z.'’&-]+)\s+reported\b/g;
// Two % figures in one clause with nothing saying what either is. The anchors are the layer's own
// nouns; "pts" counts because the layer defines a pts figure as a share of your day.
const PCT_IN_CLAUSE_RE = /[-+]?\d[\d,]*(?:\.\d+)?%/g;
// "your book" (not only "of your book") because the clean-series item reads
// "your book -1.93% against the market's -0.09%": that phrasing does say what the
// figures are, and without it every spread item tripped the pair check.
const PCT_ANCHOR_RE = /\bweight\b|your book|\bsince\b|\bpts\b|the market's/i;
function barePercentPairs(body: string): string[] {
  const out: string[] = [];
  for (const clause of body.split(/[;,.]\s+|\n+/)) {
    const pcts = clause.match(PCT_IN_CLAUSE_RE) ?? [];
    if (pcts.length < 2) continue;
    const words = clause.trim().split(/\s+/);
    const i = words.findIndex((w) => /\d%/.test(w));
    const window = words.slice(Math.max(0, i - 6), i + 7).join(' ');
    if (!PCT_ANCHOR_RE.test(window)) out.push(clause.trim());
  }
  return out;
}
const SOURCE_ADJECTIVE_RE = /\bconflicting\b|\bin the same move\b/gi;
const PUBLISHERS = [
  'Reuters', 'Bloomberg', 'CNBC', 'Barron’s', "Barron's", 'Barrons', 'The Motley Fool', 'Motley Fool', 'Zacks', 'Benzinga',
  'Seeking Alpha', 'MarketWatch', 'Yahoo Finance', "Investor's Business Daily", 'Investopedia', 'Financial Times', 'The Wall Street Journal',
  'Wall Street Journal', 'Forbes', 'TheStreet', 'Insider Monkey', 'Simply Wall St', 'GuruFocus', 'Business Insider', 'Fortune', 'Axios',
  'The Information', 'Associated Press', 'Stocktwits', 'stocktwits.com', '247wallst.com', '24/7 Wall St', 'Piper Sandler', 'Morgan Stanley',
  'Goldman Sachs', 'JPMorgan', 'JP Morgan', 'Wedbush', 'Jefferies', 'Citigroup', 'Bank of America', 'Deutsche Bank', 'Evercore',
  'Raymond James', 'Truist', 'Mizuho', 'Needham', 'Oppenheimer', 'Stifel', 'Bernstein', 'KeyBanc', 'Susquehanna', 'Canaccord',
  'William Blair', 'Loop Capital', 'Rosenblatt', 'Argus', 'CFRA', 'Moody’s', "Moody's", 'S&P Global', 'Fitch',
];
/** Pillar claims are the reader's own thesis and stay quotable; source titles are not. */
function packSourceText(pack: string): string[] {
  return [
    ...packHeadlineTitles(pack),
    ...[...pack.matchAll(/from "(.+?)" \(\d{4}-\d{2}-\d{2}\)/g)].map((m) => m[1]),
    ...[...pack.matchAll(/via "(.+?)" \(\d{4}-\d{2}-\d{2}\)/g)].map((m) => m[1]),
  ];
}
const normQuote = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
function quotedSourceText(body: string, pack: string): string[] {
  const titles = packSourceText(pack).map(normQuote).filter(Boolean);
  if (!titles.length) return [];
  const out: string[] = [];
  for (const m of body.matchAll(/["“]([^"“”]{4,})["”]/g)) {
    const q = normQuote(m[1]);
    if (q.split(' ').length < 2) continue;
    if (titles.some((t) => t.includes(q) || q.includes(t))) out.push(m[1]);
  }
  return out;
}

export function validate(body: string, pack: string): Validation {
  const v: string[] = [];
  const items = (pack.match(/^\d+\. /gm) ?? []).length;
  // numbers: every numeric token must appear (normalized) inside the normalized pack
  const normPack = pack.replace(/[$,%]/g, '').replace(/\+/g, '');
  const tokens = (body.match(NUM_RE) ?? []).map(normNum).filter((t) => /\d/.test(t));
  const missing = [...new Set(tokens.filter((t) => !normPack.includes(t)))];
  if (missing.length) v.push(`numbers not in facts: ${missing.join(', ')}`);
  for (const w of [...new Set((body.match(NUMBER_WORDS) ?? []).map((t) => t.toLowerCase()))]) {
    if (!new RegExp(`\\b${w}\\b`, 'i').test(pack)) v.push(`counted: ${w}`);
  }
  // person
  const you = (body.match(/\b(you|your|yours)\b/gi) ?? []).length;
  if (you < 2) v.push(`second person appears ${you} time(s), need at least 2`);
  const third = body.match(/\bthe (portfolio|account|investor|book)\b/gi);
  if (third) v.push(`third person: ${[...new Set(third.map((t) => t.toLowerCase()))].join(', ')}`);
  // tickers: the first one mentioned must belong to item 1; the FIRST mention of each needs "your"
  // within the three words before it
  const { all: tickers, item1, groupExempt } = listTickers(pack);
  if (tickers.length) {
    const re = new RegExp(`(^|[^A-Za-z-])(${tickers.map(escRe).join('|')})(?![A-Za-z-])`, 'g');
    const offenders: string[] = [];
    const seen = new Set<string>();
    let first: string | null = null;
    for (const m of body.matchAll(re)) {
      const t = m[2];
      first = first ?? t;
      if (seen.has(t)) continue;
      seen.add(t);
      if (groupExempt.has(t)) continue;
      const before = body.slice(0, (m.index ?? 0) + m[1].length).trim().split(/\s+/).slice(-3);
      if (!before.some((w) => /^your$/i.test(w.replace(/[^A-Za-z]/g, '')))) offenders.push(t);
    }
    if (offenders.length) v.push(`ticker without your before its first mention: ${offenders.join(', ')}`);
    if (first && item1.length && !item1.includes(first)) v.push(`first ticker ${first} is not from item 1 (${item1.join(', ')})`);
  }
  // structure leaks
  const labels = body.match(/^[A-Z][A-Za-z ,'-]{0,40}:/gm);
  if (labels) v.push(`line opens with a label: ${labels.join(' | ')}`);
  const leaks = [...(body.match(/cross-slice|\bpack\b|\bblock\b/gi) ?? []), ...(body.match(/\bFACTS\b|\bDATA\b/g) ?? [])];
  if (leaks.length) v.push(`structure words: ${[...new Set(leaks)].join(', ')}`);
  const verdicts = body.match(/\b(SUPPORTS|CONTRADICTS|INTACT|WEAKENING|BROKEN)\b/g);
  if (verdicts) v.push(`uppercase verdicts: ${[...new Set(verdicts)].join(', ')}`);
  // joins / verdict words / directives, and the extended banned list
  const joins = body.match(JOINS_RE);
  if (joins) v.push(`banned words: ${[...new Set(joins.map((t) => t.trim().toLowerCase()))].join(', ')}`);
  const banned = body.match(BANNED_RE);
  if (banned) v.push(`banned words: ${[...new Set(banned.map((t) => t.toLowerCase()))].join(', ')}`);
  const so = body.match(SO_RE);
  if (so) v.push(`so as a connective: ${[...new Set(so.map((t) => t.trim().toLowerCase()))].join(', ')}`);
  const subjects = [...body.matchAll(SOURCE_SUBJECT_RE)].map((m) => m[2]);
  if (subjects.length) v.push(`source as sentence subject: ${[...new Set(subjects)].join(', ')}`);
  // a date the pack wrote in ISO may not come back as a month name or an ordinal
  if (/\d{4}-\d{2}-\d{2}/.test(pack)) {
    const months = body.match(MONTH_NAME_RE);
    if (months) v.push(`date reformatted: ${[...new Set(months)].join(', ')}`);
    const ordinals = body.match(ORDINAL_RE);
    if (ordinals) v.push(`date reformatted as an ordinal: ${[...new Set(ordinals)].join(', ')}`);
  }
  const pointers = body.match(POINTER_PROSE_RE);
  if (pointers) v.push(`pointer prose: ${[...new Set(pointers.map((t) => t.toLowerCase()))].join(', ')}`);
  const packTickerSet = new Set(tickers);
  const reportedBy = [...body.matchAll(REPORTED_SUBJECT_RE)].map((m) => m[1]).filter((w) => !packTickerSet.has(w));
  if (reportedBy.length) v.push(`pointer prose: ${[...new Set(reportedBy)].map((w) => `${w} reported`).join(', ')}`);
  const bare = barePercentPairs(body);
  if (bare.length) v.push(`bare percentage pair: ${bare.map((c) => `"${c}"`).join(' | ')}`);
  const srcAdj = body.match(SOURCE_ADJECTIVE_RE);
  if (srcAdj) v.push(`adjective on a set of sources: ${[...new Set(srcAdj.map((t) => t.toLowerCase()))].join(', ')}`);
  const pubs = PUBLISHERS.filter((p) => {
    const re = new RegExp(`\\b${escRe(p)}\\b`, 'i');
    return re.test(body) && !re.test(pack);
  });
  if (pubs.length) v.push(`publisher not in the pack: ${pubs.join(', ')}`);
  const quoted = quotedSourceText(body, pack);
  if (quoted.length) v.push(`quoted source text: ${quoted.map((q) => `"${q}"`).join(' | ')}`);
  // count and clock-time fidelity: a figure the pack states is carried exactly or the fact is left out
  for (const block of packItemBlocks(pack)) {
    const blockTickers = new Set<string>();
    const head = block.match(new RegExp(`^\\d+\\. (${TICKER_RE.source})\\b`));
    if (head) blockTickers.add(head[1]);
    for (const m of block.matchAll(new RegExp(`\\b(${TICKER_RE.source}) (?:up|down) \\d`, 'g'))) blockTickers.add(m[1]);
    for (const m of block.matchAll(new RegExp(`; (${TICKER_RE.source}) `, 'g'))) blockTickers.add(m[1]);
    const mentioned = [...blockTickers].some((t) => new RegExp(`(^|[^A-Za-z-])${escRe(t)}(?![A-Za-z-])`).test(body));
    if (!mentioned) continue;
    for (const m of block.matchAll(/(\d+) new catch(?:es)?/g)) {
      if (/\bcatch(es)?\b/i.test(body) && !new RegExp(`\\b${m[1]}\\b`).test(body)) {
        v.push(`softened count/time: pack says "${m[0]}", body has no ${m[1]}`);
      }
    }
    for (const m of block.matchAll(/\b\d{1,2}:\d{2} [AP]M ET\b/g)) {
      if (/\bcalls?\b/i.test(body) && !body.includes(m[0])) {
        v.push(`softened count/time: pack says "${m[0]}", body does not carry it`);
      }
    }
  }
  // the grouped no-headline item is the point of that item; it may not be dropped
  if (/^\d+\. .*moved with no headline behind/m.test(pack) && !/no headline/i.test(body)) {
    v.push('dropped the no-headline fact');
  }
  // no run of 5+ consecutive words shared with a headline title
  const bodyGrams = new Set(fiveGrams(gramWords(body)));
  const runs = [...new Set(packHeadlineTitles(pack).flatMap((t) => fiveGrams(gramWords(t))).filter((g) => bodyGrams.has(g)))];
  if (runs.length) v.push(`headline overlap: ${runs.join(' | ')}`);
  // the company's long name where the pack only gave a ticker.
  // case-sensitive on purpose: the all-caps ticker META must not count as the name Meta
  for (const name of COMPANY_NAMES) {
    const re = new RegExp(`\\b${name}\\b`);
    if (re.test(body) && !re.test(pack)) v.push(`company name instead of ticker: ${name}`);
  }
  // style
  if (/—/.test(body)) v.push('em dash');
  if (/(^|\D)–|–(\D|$)/.test(body)) v.push('en dash used as em dash');
  if (body.includes('!')) v.push('exclamation mark');
  if (/^[-*•] /m.test(body)) v.push('bullet line');
  if (body.includes('·')) v.push('middle dot');
  // "no headline" is a listed fact and passes; not available / unavailable / nothing changed fail
  const absent = (body.match(/\bnot available\b|\bno .{0,30} available\b|\bunavailable\b|\bnothing changed\b/gi) ?? []).filter(
    (m) => !/headline/i.test(m),
  );
  if (absent.length) v.push(`describes absence: ${[...new Set(absent)].join(' | ')}`);
  // length and paragraphs follow the list size, from the same lengthBand() the pack prints
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  const { lo, hi, paraCap } = lengthBand(items);
  if (words < lo || words > hi) v.push(`${words} words, need ${lo}-${hi} for ${items} items`);
  const paras = body.trim().split(/\n\s*\n/).length;
  if (paras > paraCap) v.push(`${paras} paragraphs, at most ${paraCap} for ${items} items`);
  return { passed: v.length === 0, violations: v };
}

export const retryLine = (violations: string[]) =>
  `Your draft failed these checks: ${violations.join('; ')}. Rewrite the whole brief so every check passes.`;
