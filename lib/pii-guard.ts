/**
 * What may leave for a model endpoint.
 *
 * Helm sends a named person's positions, dollar values and unrealized P&L into
 * an OpenAI prompt every time the research chat answers. For a retail user that
 * is their own data. For the advisor product it is someone else's client data
 * crossing a fiduciary perimeter, and "we prompt carefully" is not an answer to
 * give a compliance officer.
 *
 * This is deliberately high precision rather than high recall. A guard that
 * mangles a legitimate figure breaks answers and gets switched off, and the
 * numbers in a portfolio prompt are the whole point of the prompt. So it catches
 * structured identifiers that have no business in a prompt at all, and leaves
 * money alone. Names are not attempted: no regex knows a person from a company.
 *
 * Order matters below. Longer, more specific patterns run first so a phone
 * number is not half-eaten by the account-number rule.
 */

export type PiiKind = 'email' | 'ssn' | 'phone' | 'account_number' | 'card_number';

interface Rule {
  kind: PiiKind;
  re: RegExp;
  token: string;
}

const RULES: Rule[] = [
  { kind: 'email', re: /\b[\w.%+-]+@[\w.-]+\.[a-z]{2,}\b/gi, token: '[email]' },
  { kind: 'ssn', re: /\b\d{3}-\d{2}-\d{4}\b/g, token: '[ssn]' },
  // 13-19 digits, optionally grouped: card-shaped. Runs before the account rule.
  { kind: 'card_number', re: /\b(?:\d[ -]?){13,19}\b/g, token: '[card]' },
  { kind: 'phone', re: /\b(?:\+1[ -.]?)?\(?\d{3}\)?[ -.]\d{3}[ -.]\d{4}\b/g, token: '[phone]' },
  // An account number only when something says it is one. A bare 8-digit run is
  // far more likely to be a price, a share count or a market cap.
  {
    kind: 'account_number',
    re: /\b(?:acct|account|acc)\.?\s*(?:no\.?|number|#)?\s*[:#]?\s*(?!\.)([A-Z]{0,3}[-]?\d{6,})\b/gi,
    token: '[account]',
  },
];

export interface Scrubbed {
  text: string;
  /** kind -> how many were removed. Empty when the text was already clean. */
  removed: Partial<Record<PiiKind, number>>;
}

/**
 * Redact structured identifiers from anything about to be sent to a model.
 * Returns counts rather than the values, so a log of what happened never
 * becomes a second copy of the thing being protected.
 */
export function scrubOutbound(text: string): Scrubbed {
  let out = text ?? '';
  const removed: Partial<Record<PiiKind, number>> = {};
  for (const rule of RULES) {
    let n = 0;
    out = out.replace(rule.re, () => {
      n++;
      return rule.token;
    });
    if (n > 0) removed[rule.kind] = n;
  }
  return { text: out, removed };
}

/** True when anything was redacted. */
export function wasScrubbed(s: Scrubbed): boolean {
  return Object.keys(s.removed).length > 0;
}

/** One line for a log: kinds and counts, never values. */
export function describeScrub(s: Scrubbed): string {
  return Object.entries(s.removed)
    .map(([k, n]) => `${k}x${n}`)
    .join(' ');
}
