// Mechanism clustering + the corroboration ladder (thesis-v2 spec §5).
//
// The problem this solves: one story reported by five outlets is currently five
// pieces of evidence, so three minor news items outweigh one SEC filing. That is
// alert fatigue and a scoring bug at the same time.
//
// A *mechanism* is the causal story ("rival silicon substitution"), not the
// headline. Repetition inside one source class adds recency, never weight; only
// an independent class counts as a fresh confirmation.
//
// Pure functions, no I/O — the ladder is the part that must be provably right.

/** Independent ways a claim can be corroborated. Repetition within one adds nothing. */
export type SourceClass = 'company_filing' | 'primary_news' | 'analyst_opinion' | 'insider' | 'xbrl' | 'price';

export const SOURCE_CLASS_LABEL: Record<SourceClass, string> = {
  company_filing: 'Company filing',
  primary_news: 'Primary news',
  analyst_opinion: 'Analyst opinion',
  insider: 'Insider activity',
  xbrl: 'Reported financials',
  price: 'Price action',
};

/** Classes that can carry a claim on their own. The ladder requires one to escalate. */
const PRIMARY_CLASSES = new Set<SourceClass>(['company_filing', 'xbrl', 'primary_news']);

/**
 * The company's own words about its own business. Nobody has to corroborate a
 * 10-Q; an outlet's read of one always does. A price move is deliberately NOT
 * here: the price is the thing a thesis is supposed to explain, not evidence
 * about it.
 */
const SELF_DISCLOSURE = new Set<SourceClass>(['company_filing', 'xbrl']);

export type EvidenceClass = 'realized' | 'emerging' | 'speculative';
export type LadderStatus = 'watch' | 'weakening' | 'broken';

export interface ClusterItem {
  id: string;
  /** Text the mechanism is inferred from: title + excerpt works best. */
  text: string;
  sourceClass: SourceClass;
  evidenceClass: EvidenceClass;
  /** YYYY-MM-DD */
  dateISO: string;
  /** Large enough to stand on its own, e.g. a >=20% adverse move or withdrawn
   *  guidance. Matches the severity rule the shipped status engine already has. */
  severe?: boolean;
}

export interface Mechanism<T extends ClusterItem = ClusterItem> {
  label: string;
  items: T[];
  /** Distinct source classes present, ordered by first appearance. */
  sourceClasses: SourceClass[];
  /** Independent confirmations = distinct source classes, NOT article count. */
  confirmations: number;
  /** Total pieces of evidence, including same-class repetition. */
  mentions: number;
  firstSeen: string;
  lastSeen: string;
  /** Ceiling this mechanism may push a pillar to, per the ladder below. */
  maxStatus: LadderStatus;
  ladderReason: string;
}

/* ── entity extraction ─────────────────────────────────────────────────── */

const STOP = new Set([
  'The', 'This', 'That', 'These', 'Those', 'As', 'For', 'And', 'But', 'Our', 'We', 'In', 'On', 'At', 'It', 'A', 'An',
  'Of', 'To', 'Its', 'Company', 'Inc', 'Corp', 'Corporation', 'Ltd', 'LLC', 'Co', 'If', 'Is', 'Are', 'Was', 'Were',
  'Will', 'Would', 'Could', 'May', 'Q1', 'Q2', 'Q3', 'Q4', 'FY', 'US', 'U.S', 'CEO', 'CFO', 'New', 'More', 'Most',
  'Reuters', 'Bloomberg', 'CNBC', 'AP', 'Zacks', 'Barrons', 'Benzinga', 'Motley', 'Fool', 'GlobeNewswire', 'PRNewswire',
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  // Market furniture and headline verbs: present everywhere, mechanism nowhere.
  'Nasdaq', 'NASDAQ', 'NYSE', 'Dow', 'Jones', 'SP', 'Wall', 'Street', 'Stock', 'Stocks', 'Shares', 'Share',
  'Market', 'Markets', 'Buy', 'Sell', 'Hold', 'Rating', 'Price', 'Target', 'Best', 'Top', 'Than', 'You', 'Your',
  'Why', 'How', 'What', 'When', 'Where', 'Who', 'Here', 'Should', 'Now', 'Still', 'Just', 'One', 'Two', 'Three',
  'January', 'February', 'March', 'April', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
]);

/**
 * Capitalised tokens that survive the stoplist, plus the multi-word phrases they
 * form. "Data Center" and "Artificial Intelligence" are single ideas; splitting
 * them produced mechanism labels like "Center + Data". Both the phrase and its
 * parts are emitted so overlap counting is unaffected and only the label improves.
 */
export function salientEntities(text: string): string[] {
  const out: string[] = [];
  const runs = text.match(/\b[A-Z][A-Za-z0-9.&-]{1,}(?:\s+[A-Z][A-Za-z0-9.&-]{1,}){0,2}\b/g) ?? [];
  for (const run of runs) {
    // Dedupe inside the run so "Google Google" never becomes a phrase.
    const words = [...new Set(run.split(/\s+/).filter((w) => !STOP.has(w) && w.length > 1))];
    if (words.length > 1) out.push(words.join(' '));
    out.push(...words);
  }
  return [...new Set(out)];
}

/* ── the ladder ────────────────────────────────────────────────────────── */

/**
 * The ceiling a body of evidence may push a pillar to (spec §5).
 *
 *   realized (the breaks_if metric actually moved)      -> broken
 *   >=2 independent classes, at least one primary       -> weakening
 *   anything else, including ten repeats of one story   -> watch
 */
export function ladderCeiling(
  classes: SourceClass[],
  evidenceClasses: EvidenceClass[],
  severe = false,
): { maxStatus: LadderStatus; reason: string } {
  const distinct = [...new Set(classes)];
  // Severity outranks corroboration. A 38% single-day fall against a pillar that
  // says the share price holds up does not need a second opinion, and an early
  // version of this ladder capping that at watch is why the shipped engine and
  // this one are run side by side.
  if (severe) {
    return { maxStatus: 'broken', reason: 'a severe move that needs no corroboration' };
  }
  if (evidenceClasses.includes('realized')) {
    return { maxStatus: 'broken', reason: 'a realized change is in the reported numbers' };
  }
  const hasPrimary = distinct.some((c) => PRIMARY_CLASSES.has(c));
  if (distinct.length >= 2 && hasPrimary) {
    return { maxStatus: 'weakening', reason: `${distinct.length} independent source classes, one of them primary` };
  }
  if (distinct.length >= 2) {
    return { maxStatus: 'watch', reason: 'corroborated, but no primary source yet' };
  }
  // The company contradicting its own thesis in its own disclosure needs nobody
  // to corroborate it. Capping that at watch was the one place this ladder was
  // less accurate than the engine it is meant to correct, which is exactly the
  // kind of thing running both over the same evidence is for.
  if (SELF_DISCLOSURE.has(distinct[0])) {
    return { maxStatus: 'weakening', reason: 'the company disclosed this itself' };
  }
  return { maxStatus: 'watch', reason: 'a single source class, however many times it was repeated' };
}

/* ── clustering ────────────────────────────────────────────────────────── */

/**
 * Name a cluster after what its members actually have in common: entities every
 * member mentions, phrases before bare tokens, dropping anything already
 * contained in a name we picked ("SK Hynix + Hynix" says one thing twice).
 */
export function nameMechanism(seen: Map<string, number>, memberCount: number, sampleText = ''): string {
  const universal = [...seen.entries()].filter(([, n]) => n === memberCount).map(([e]) => e);
  const ranked = (universal.length ? universal : [...seen.keys()]).sort(
    (a, b) =>
      Number(b.includes(' ')) - Number(a.includes(' ')) ||
      (seen.get(b) ?? 0) - (seen.get(a) ?? 0) ||
      b.length - a.length ||
      a.localeCompare(b),
  );

  const picked: string[] = [];
  for (const e of ranked) {
    if (picked.length === 2) break;
    if (!picked.some((p) => p.includes(e) || e.includes(p))) picked.push(e);
  }

  // Two tokens that sit next to each other in the source are one idea, not two.
  // Plurals keep "Data Centers" out of the universal set while "Data" and
  // "Center" both stay in it, which is how "Center + Data" happens.
  if (picked.length === 2 && sampleText) {
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
    const [a, b] = picked;
    for (const [x, y] of [[a, b], [b, a]]) {
      if (new RegExp(`\\b${esc(x)}\\w*\\s+${esc(y)}\\b`, 'i').test(sampleText)) return `${x} ${y}`;
    }
  }
  return picked.join(' + ');
}

/** How many entities an item must share with a cluster's core to join it. */
const SHARED_ENTITY_THRESHOLD = 2;

/**
 * An entity appearing in more than this share of a pillar's findings carries no
 * discriminating information — it is the company, its main product, its
 * segment. Matching on it groups by subject rather than by mechanism, which is
 * how AMZN produced a 60-finding cluster labelled "Amazon + AWS". Tuned against
 * real evidence for six tickers: 0.6 was the point where blobs broke up without
 * shattering everything into singletons.
 */
const GENERIC_ENTITY_DF = 0.6;

/** Below this many findings, document frequency is too noisy to filter on. */
const MIN_CORPUS_FOR_DF = 8;

/**
 * Group evidence into mechanisms by shared salient entities.
 *
 * A candidate joins a cluster only if it overlaps the cluster's CORE — the
 * entities every existing member has in common — never merely one member.
 * Transitive matching (A~B, B~C, therefore A~C) is what makes naive union-find
 * collapse a whole ticker into one blob; measured on AMZN it put 86 of 196
 * findings in a single cluster. Intersecting the core on every join makes the
 * membership test strictly harder as a cluster grows, so drift terminates.
 *
 * Items are sorted before assignment, so the result never depends on the order
 * they arrived from the database.
 *
 * This stands in for the real design: a per-pillar mechanism enum derived from
 * `breaks_if` plus the company's 10-K Item 1A risk factors, with the judge
 * picking one. Entity overlap approximates it well enough to evaluate the UI
 * and to prove the ladder.
 */
export function clusterByMechanism<T extends ClusterItem>(items: T[]): Mechanism<T>[] {
  if (items.length === 0) return [];

  const ordered = [...items].sort((a, b) => a.dateISO.localeCompare(b.dateISO) || a.id.localeCompare(b.id));

  // Match on a case-folded key: "Nvidia" and "NVIDIA" are one company, and
  // treating them as two entities split one mechanism into two rows. The most
  // frequent original spelling is kept for display.
  const display = new Map<string, string>();
  const spelling = new Map<string, Map<string, number>>();
  const entsOf = new Map<string, string[]>();
  for (const i of ordered) {
    const keys: string[] = [];
    for (const e of salientEntities(i.text)) {
      const k = e.toLowerCase();
      keys.push(k);
      const forms = spelling.get(k) ?? new Map<string, number>();
      forms.set(e, (forms.get(e) ?? 0) + 1);
      spelling.set(k, forms);
    }
    entsOf.set(i.id, [...new Set(keys)]);
  }
  for (const [k, forms] of spelling) {
    display.set(k, [...forms.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]);
  }

  // Drop the entities that everything mentions: they name the subject, not a mechanism.
  const generic = new Set<string>();
  if (ordered.length >= MIN_CORPUS_FOR_DF) {
    const df = new Map<string, number>();
    for (const i of ordered) for (const e of entsOf.get(i.id)!) df.set(e, (df.get(e) ?? 0) + 1);
    for (const [e, n] of df) if (n / ordered.length > GENERIC_ENTITY_DF) generic.add(e);
  }

  const clusters: { core: Set<string>; seen: Map<string, number>; members: T[] }[] = [];

  for (const it of ordered) {
    const ents = entsOf.get(it.id)!.filter((e) => !generic.has(e));
    const entSet = new Set(ents);

    let best: { c: (typeof clusters)[number]; overlap: number } | null = null;
    for (const c of clusters) {
      if (c.core.size < SHARED_ENTITY_THRESHOLD) continue; // core exhausted, cluster is closed
      let overlap = 0;
      for (const e of c.core) if (entSet.has(e)) overlap++;
      if (overlap >= SHARED_ENTITY_THRESHOLD && (!best || overlap > best.overlap)) best = { c, overlap };
    }

    if (best) {
      best.c.members.push(it);
      for (const e of [...best.c.core]) if (!entSet.has(e)) best.c.core.delete(e);
      for (const e of ents) best.c.seen.set(e, (best.c.seen.get(e) ?? 0) + 1);
    } else {
      clusters.push({ core: new Set(ents), seen: new Map(ents.map((e) => [e, 1])), members: [it] });
    }
  }

  const out: Mechanism<T>[] = [];
  for (const c of clusters) {
    const members = [...c.members].sort((a, b) => b.dateISO.localeCompare(a.dateISO));
    const classes = members.map((m) => m.sourceClass);
    const distinct = [...new Set(classes)];
    const { maxStatus, reason } = ladderCeiling(
      classes,
      members.map((m) => m.evidenceClass),
      members.some((m) => m.severe),
    );

    const shown = new Map([...c.seen].map(([k, n]) => [display.get(k) ?? k, n]));
    const label =
      nameMechanism(shown, members.length, members[0].text) || salientEntities(members[0].text)[0] || 'Unlabelled';

    const dates = members.map((m) => m.dateISO).filter(Boolean).sort();
    out.push({
      label,
      items: members,
      sourceClasses: distinct,
      confirmations: distinct.length,
      mentions: members.length,
      firstSeen: dates[0] ?? '',
      lastSeen: dates[dates.length - 1] ?? '',
      maxStatus,
      ladderReason: reason,
    });
  }

  // What can actually move the pillar first, then best-corroborated, then most
  // discussed, then most recent. A collapsed list is only useful if the top of
  // it is the part that matters.
  const rank: Record<LadderStatus, number> = { broken: 2, weakening: 1, watch: 0 };
  return out.sort(
    (a, b) =>
      rank[b.maxStatus] - rank[a.maxStatus] ||
      b.confirmations - a.confirmations ||
      b.mentions - a.mentions ||
      b.lastSeen.localeCompare(a.lastSeen),
  );
}
