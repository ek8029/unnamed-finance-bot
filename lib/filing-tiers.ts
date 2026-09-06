// lib/filing-tiers.ts
// Which filings Helm reads, and how fast.
//
// Measured 2026-09-05 on a live page of 100 8-Ks: a third are director and
// officer changes (5.02), a quarter are financing agreements (1.01, 2.03), a
// fifth are vote results, bylaw amendments and exhibit-only filings, and about
// one in ten is the kind that breaks a thesis. The evidence table agrees on
// the forms: 10-Qs yield 4.5 rows a document and 59% material, 8-Ks 2.9 and
// 35%.
//
//   now     read within minutes: the periodic reports, and 8-K items that
//           change the business on their own
//   hourly  read at the hourly scan, batched with whatever else landed: the
//           agreements, leadership changes, Reg FD decks and "other events"
//           where product news hides
//   never   recorded, never judged, and dropped from the scan's candidates:
//           votes, bylaws, rights tweaks, exhibit-only filings
//
// The tiers are priors. filing_events stores every filing's items and
// judge_jobs stores what each read found, so the yield per item is measurable
// after a couple of weeks live; tune here from that, not from opinion.

export type FilingTier = 'now' | 'hourly' | 'never';

/** 8-K items that move a thesis on their own. */
export const TIER_NOW_ITEMS = new Set([
  '1.02', // termination of a material agreement
  '1.03', // bankruptcy or receivership
  '2.01', // completed acquisition or disposition
  '2.02', // results of operations
  '2.04', // triggering events that accelerate an obligation
  '2.05', // exit or disposal costs
  '2.06', // material impairments
  '3.01', // delisting notice
  '4.01', // change in accountant
  '4.02', // non-reliance on previously issued financials
  '5.01', // change in control
]);

/** 8-K items that never bear on a pillar. */
export const TIER_NEVER_ITEMS = new Set([
  '3.03', // material modification to rights of security holders
  '5.03', // amendments to articles or bylaws, fiscal year change
  '5.07', // submission of matters to a vote
  '5.08', // shareholder director nominations
  '9.01', // financial statements and exhibits (meaningless alone)
]);

/**
 * 8-K items whose primary document is usually a stub pointing at an EX-99
 * press release. The scorer attaches the exhibit for these.
 */
export const EXHIBIT_ITEMS = new Set(['2.02', '7.01', '8.01']);

export function filingTier(form: string, items: readonly string[]): FilingTier {
  const base = form.toUpperCase().replace(/\s+/g, '').split('/')[0];
  if (base === '10-Q' || base === '10-K') return 'now';
  if (base === '8-K') {
    const its = items.map((i) => i.trim()).filter(Boolean);
    if (its.some((i) => TIER_NOW_ITEMS.has(i))) return 'now';
    // No items parsed: read it, at the hour, rather than guess it away.
    if (its.length === 0) return 'hourly';
    if (its.every((i) => TIER_NEVER_ITEMS.has(i))) return 'never';
    return 'hourly';
  }
  // 6-K, 20-F, 40-F, Form 4 and anything else: the hourly scan decides.
  return 'hourly';
}
