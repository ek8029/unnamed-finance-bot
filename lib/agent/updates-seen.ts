// The Updates card's per-user watermark: when this person last read the card.
//
// Migration 078 adds user_preferences.updates_seen_at and Evan applies
// migrations by hand, so every path here has to work while the column does not
// exist. The read answers null on the unapplied-migration error shape, which
// the card treats as "no mark" and renders exactly as it did before. A HEAD
// probe is no help: in this codebase a supabase HEAD probe against a missing
// table returns no error at all, so the error shape is what we key on.

import type { SupabaseClient } from '@supabase/supabase-js';

/** The two shapes PostgREST and Postgres use for a column that is not there.
 *  Anything else is a real failure and must not be read as "never visited". */
export function isMissingUpdatesSeenColumn(e: { code?: string; message?: string }): boolean {
  return e.code === 'PGRST204'
    || e.code === '42703'
    || (/updates_seen_at/.test(e.message ?? '') && /column|does not exist/i.test(e.message ?? ''));
}

/** The person's watermark, or null: never read, no preferences row yet, or the
 *  migration is still unapplied. Never throws and never costs the caller its log. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function readUpdatesSeenAt(supabase: SupabaseClient<any, any, any>, uid: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('updates_seen_at')
    .eq('user_id', uid)
    .maybeSingle();
  if (error) {
    if (!isMissingUpdatesSeenColumn(error)) {
      console.error('[worklog] updates_seen_at read failed', { user: uid, code: error.code, message: error.message });
    }
    return null;
  }
  const at = (data as { updates_seen_at?: string | null } | null)?.updates_seen_at;
  return typeof at === 'string' && at ? at : null;
}

/** Validate a client-supplied watermark for PATCH /api/user/preferences.
 *  Null means reject with a 400. A future stamp is clamped to the server clock,
 *  because a client that stamped next year would never see a new line again. */
export function parseUpdatesSeenAt(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = Date.parse(value);
  if (Number.isNaN(t)) return null;
  return new Date(Math.min(t, Date.now())).toISOString();
}
