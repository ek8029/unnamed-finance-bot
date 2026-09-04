/**
 * Deterministic number verification for LLM output.
 *
 * Every figure a model writes must trace to a figure in the facts it was given.
 * No model is asked to check another model: this is arithmetic on strings.
 *
 * The digest has enforced this since the P7 rewrite (lib/digest/validate.ts),
 * where it works because code builds the fact pack and the model may only
 * rephrase it. Two surfaces never got the same treatment: the research chat
 * (gpt-4o-mini at temperature 0.4, handed the whole book) and the public
 * /analyze page (temperature 0.7, and its prompt orders a number in every
 * sentence). This module is the shared check for those.
 *
 * Two things the digest's simpler substring test could not do, and this must:
 *   - units: /analyze is told to render 2,150,000,000 as "$2.15B"
 *   - rounding: "19%" is a correct rendering of a 19.32% source figure
 * So tolerance is derived from the precision the model chose to write. A figure
 * quoted to two decimals is checked to two decimals; one written whole is
 * allowed half a unit either way.
 */

/** ISO dates first: 2026-09-04 is three integers to a naive tokenizer. */
const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/g;

/** $1,234.56 | 19% | 2.15B | -0.48 | 3 */
const TOKEN =
  /([-+]?)\$?\s?(\d[\d,]*(?:\.\d+)?)\s*(%|bps|[BMKT]\b|billion|million|thousand|trillion)?/gi;

const MULTIPLIER: Record<string, number> = {
  k: 1e3, thousand: 1e3,
  m: 1e6, million: 1e6,
  b: 1e9, billion: 1e9,
  t: 1e12, trillion: 1e12,
};

export interface Figure {
  /** As written, for the log line. */
  raw: string;
  /** Absolute value in base units. A percent keeps its face value (19% -> 19). */
  value: number;
  /** Percentages only ever match percentages. */
  isPercent: boolean;
  /** Half a unit of the least significant digit the writer chose. */
  tolerance: number;
  /** Whether a +/- was actually written. Prose carries direction in words
   *  ("down 0.50%") far more often than in a sign, so an unsigned figure is
   *  matched on magnitude alone. Measured 2026-09-04: enforcing sign on every
   *  figure produced 3 false positives in 166 on /analyze, and every one was a
   *  correct number whose direction sat in the verb. */
  hasExplicitSign: boolean;
}

function toleranceFor(digits: string, multiplier: number): number {
  const dot = digits.indexOf('.');
  const decimals = dot === -1 ? 0 : digits.length - dot - 1;
  return (0.5 * Math.pow(10, -decimals)) * multiplier;
}

/** Every figure in a block of text. */
export function extractFigures(text: string): Figure[] {
  const clean = (text ?? '').replace(ISO_DATE, ' ');
  const out: Figure[] = [];
  for (const m of clean.matchAll(TOKEN)) {
    const [raw, sign, digits, unitRaw] = m;
    const unit = (unitRaw ?? '').toLowerCase();
    const isPercent = unit === '%' || unit === 'bps';
    const multiplier = MULTIPLIER[unit] ?? 1;
    const n = Number(digits.replace(/,/g, ''));
    if (!Number.isFinite(n)) continue;
    const value = (sign === '-' ? -n : n) * multiplier;
    out.push({
      raw: raw.trim(),
      hasExplicitSign: sign === '-' || sign === '+',
      // bps and percent are the same axis: 50 bps is 0.5%.
      value: unit === 'bps' ? value / 100 : value,
      isPercent,
      tolerance: toleranceFor(digits, unit === 'bps' ? multiplier / 100 : multiplier),
    });
  }
  return out;
}

/** Does `f` trace to any figure in the catalogue, allowing for how it was written? */
function traces(f: Figure, catalogue: Figure[]): boolean {
  for (const c of catalogue) {
    if (c.isPercent !== f.isPercent) continue;
    // The writer's precision sets the band; the catalogue's own precision widens
    // it, since 19.32 written as 19 is correct and so is 19 written as 19.00.
    if (Math.abs(Math.abs(c.value) - Math.abs(f.value)) <= f.tolerance + c.tolerance) {
      // Sign is only binding when the writer actually wrote one. "down 0.50%"
      // against a fact of -0.5045% is correct; "+0.50%" against it is not.
      if (!f.hasExplicitSign) return true;
      if (Math.sign(c.value) === Math.sign(f.value) || f.value === 0) return true;
    }
  }
  return false;
}

export interface NumberCheck {
  ok: boolean;
  /** Figures in the output that trace to nothing in the facts. */
  unverified: Figure[];
  /** How many figures were checked, for a rate in the log. */
  checked: number;
  /** For each unverified figure, the closest thing in the facts. A flag that
   *  says "0.50% traces to nothing, nearest fact is 0.55%" is a diagnosis; one
   *  that only says "traces to nothing" is a chore. */
  nearest: { figure: string; nearest: string | null; delta: number | null }[];
}

/**
 * Check every figure in `output` against the facts the model was given.
 *
 * Unverified does not mean the model lied: it means nothing here can prove the
 * number, which is the signal worth having. Callers decide what to do with it,
 * and none of them should decide "ignore".
 */
export function verifyNumbers(output: string, facts: string): NumberCheck {
  const catalogue = extractFigures(facts);
  const figures = extractFigures(output);
  const unverified = figures.filter((f) => !traces(f, catalogue));
  // Dedupe by how it was written, so one repeated figure is one finding.
  const seen = new Set<string>();
  const unique = unverified.filter((f) => (seen.has(f.raw) ? false : (seen.add(f.raw), true)));
  const nearest = unique.map((f) => {
    let best: Figure | null = null;
    let bestDelta = Infinity;
    for (const c of catalogue) {
      if (c.isPercent !== f.isPercent) continue;
      const d = Math.abs(Math.abs(c.value) - Math.abs(f.value));
      if (d < bestDelta) { bestDelta = d; best = c; }
    }
    return { figure: f.raw, nearest: best?.raw ?? null, delta: best ? bestDelta : null };
  });
  return { ok: unique.length === 0, unverified: unique, checked: figures.length, nearest };
}

/** One-line summary for a log, with the nearest fact so the flag is a diagnosis. */
export function describeCheck(c: NumberCheck): string {
  if (c.ok) return `${c.checked} figures, all traced`;
  const parts = c.nearest.map((n) =>
    n.nearest ? `${n.figure} (nearest fact ${n.nearest})` : `${n.figure} (no comparable fact)`);
  return `${c.unverified.length} of ${c.checked} figures trace to nothing: ${parts.join(', ')}`;
}
