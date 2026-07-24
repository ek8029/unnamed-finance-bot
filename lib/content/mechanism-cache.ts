// Read/write for the cached LLM mechanism grouping (migration 058).
//
// The judge's output depends only on the SET of findings on a pillar, so the
// cache key is a stable hash of the sorted member ids. A stale hash simply
// misses and the reader falls back to the heuristic — the page never waits on
// a model call and works before the migration is applied (42P01 probe, same
// deploy-before-migration pattern as hasSourceClassColumn).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { JudgedMechanism } from './mechanism-judge';

/** Stable content hash of a finding-id set (order-independent). */
export function evidenceHash(ids: string[]): string {
  const s = [...ids].sort().join('|');
  // FNV-1a, 32-bit, hex — collision risk irrelevant at this cardinality.
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0') + ':' + ids.length;
}

export const scopeKey = (ticker: string, pillarKey: string) => `${ticker}|${pillarKey}`;

let tableKnown: boolean | null = null;

async function hasCacheTable(db: SupabaseClient): Promise<boolean> {
  if (tableKnown !== null) return tableKnown;
  const { error } = await db.from('mechanism_cache').select('scope_key').limit(1);
  if (!error) tableKnown = true;
  else if (error.code === '42P01') tableKnown = false; // undefined_table
  return tableKnown ?? false;
}

export interface CachedMechanisms {
  evidenceHash: string;
  groups: JudgedMechanism[];
  model: string;
}

/** Batch read; returns only rows that exist. Missing table = empty map. */
export async function readMechanismCache(
  db: SupabaseClient,
  scopeKeys: string[],
): Promise<Map<string, CachedMechanisms>> {
  const out = new Map<string, CachedMechanisms>();
  if (scopeKeys.length === 0 || !(await hasCacheTable(db))) return out;
  const { data } = await db
    .from('mechanism_cache')
    .select('scope_key, evidence_hash, groups, model')
    .in('scope_key', scopeKeys);
  for (const r of data ?? []) {
    out.set(String(r.scope_key), {
      evidenceHash: String(r.evidence_hash),
      groups: (r.groups as JudgedMechanism[]) ?? [],
      model: String(r.model),
    });
  }
  return out;
}

export async function writeMechanismCache(
  db: SupabaseClient,
  key: string,
  hash: string,
  groups: JudgedMechanism[],
  model: string,
): Promise<boolean> {
  if (!(await hasCacheTable(db))) return false;
  const { error } = await db.from('mechanism_cache').upsert(
    { scope_key: key, evidence_hash: hash, groups, model, generated_at: new Date().toISOString() },
    { onConflict: 'scope_key' },
  );
  return !error;
}
