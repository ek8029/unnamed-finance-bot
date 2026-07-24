// Graft the judged mechanism grouping into the SHIPPED thesis pages, quietly.
//
// The v2 lab rendered mechanisms as their own drawer hierarchy and lost to the
// shipped page (2026-07-24 verdict: internal-tool tone, worse than current). So
// the graft is the opposite shape: the existing evidence list stays exactly as
// it is, and a row that belongs to a multi-report story gains one muted line —
// "One of 3 reports on the same story: <label>". Human words, no ladder terms.
//
// The mechanism cache is keyed by TICKER|normalised-claim and its member ids
// are the cross-user deduped representative evidence rows, so mapping to THIS
// user's rows goes through source_key (same article = same story), not row id.

import { createStaticServiceClient } from '@/lib/supabase/server';
import { readMechanismCache, scopeKey } from './mechanism-cache';

// Mirrors scoring-thesis's pillar fold key. Same claim text = same scope.
const normClaim = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

export interface StoryNote {
  label: string;
  reports: number;
}

/**
 * source_key -> note, for every evidence row that belongs to a judged story
 * with 2+ members. Rows outside any story (or single-member stories) get
 * nothing — a group of one is not a story. Every failure returns an empty map;
 * the page renders unannotated, never broken.
 */
export async function getStoryNotes(
  ticker: string,
  pillarClaims: string[],
): Promise<Map<string, StoryNote>> {
  const out = new Map<string, StoryNote>();
  try {
    const db = createStaticServiceClient();
    const keys = [...new Set(pillarClaims.map((c) => scopeKey(ticker.toUpperCase(), normClaim(c))))];
    const cache = await readMechanismCache(db, keys);
    if (cache.size === 0) return out;

    const memberIds = [...cache.values()].flatMap((c) => c.groups.flatMap((g) => g.memberIds));
    if (memberIds.length === 0) return out;

    // Representative rows -> source_key (the article identity shared across users).
    const { data } = await db
      .from('pillar_evidence')
      .select('id, source_key')
      .in('id', [...new Set(memberIds)]);
    const keyOfId = new Map((data ?? []).map((r) => [String(r.id), String(r.source_key)]));

    for (const c of cache.values()) {
      for (const g of c.groups) {
        if (g.memberIds.length < 2) continue;
        const note: StoryNote = { label: g.label, reports: g.memberIds.length };
        for (const id of g.memberIds) {
          const sk = keyOfId.get(id);
          if (sk && !out.has(sk)) out.set(sk, note);
        }
      }
    }
  } catch {
    /* derived annotation only — the page never depends on it */
  }
  return out;
}
