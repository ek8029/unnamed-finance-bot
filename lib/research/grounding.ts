// The grounding gate. The model is handed findings tagged with ids and told to
// cite by id. Everything it returns passes through here so that a hallucinated
// citation — an id that was never retrieved — is dropped before the answer
// reaches the user. This is the difference between "grounded" and "plausible".

import type { Finding } from './types';

/**
 * Models sometimes group citations into one bracket ("[catch:a, catch:b]").
 * Expand those into adjacent single-id brackets so extraction and rendering
 * treat each citation on its own; a grouped token would otherwise fail the id
 * lookup and silently drop every citation in it.
 */
export function expandGroupedCitations(text: string): string {
  return text.replace(/\[([a-z_]+:[^\]]+)\]/gi, (m, inner: string) => {
    if (!inner.includes(',')) return m;
    return inner
      .split(/\s*,\s*/)
      .filter(Boolean)
      .map((id) => `[${id.trim()}]`)
      .join('');
  });
}

/** Pull `[id]`-style tokens out of a model's raw citation list or prose. */
export function extractCitedIds(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === 'string').map((s) => s.trim());
  }
  if (typeof raw === 'string') {
    return [...raw.matchAll(/\[([a-z_]+:[0-9a-f-]+|[a-z_]+:[^\]]+)\]/gi)].map((m) => m[1].trim());
  }
  return [];
}

/**
 * Keep only the findings the model actually cited AND that were really in the
 * retrieved set. Order follows the retrieved findings, not the model's list, so
 * the citation block reads in a stable, source-first order. Unknown ids are
 * silently dropped — they are the hallucinations we are guarding against.
 */
export function validateCitations(citedIds: string[], findings: Finding[]): Finding[] {
  const cited = new Set(citedIds.map((s) => s.trim()));
  return findings.filter((f) => cited.has(f.id));
}
