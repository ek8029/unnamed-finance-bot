// lib/agent/monitored.ts
// Which theses the watch may judge: exactly the set the hourly scorer scans.
//
// Entitled owners keep every tracked thesis; a free owner keeps their oldest
// tracked one (lib/thesis-entitlement selectMonitored). "Oldest" cannot be
// decided from the theses on a single ticker, so this reads every tracked
// thesis of each owner in question and returns the kept ids. Gating the queue
// on entitlement alone left free users' one monitored thesis to the hour, so
// the watch and the hour would have disagreed about what Helm reads.

import type { SupabaseClient } from '@supabase/supabase-js';
import { entitledToMonitoring, selectMonitored } from '@/lib/thesis-entitlement';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export async function monitoredThesisIds(db: Db, userIds: string[]): Promise<Set<string>> {
  const owners = [...new Set(userIds)];
  if (owners.length === 0) return new Set();
  const { data } = await db
    .from('theses')
    .select('id, user_id, created_at')
    .in('user_id', owners)
    .eq('tracked', true)
    .limit(2000);
  const rows = (data ?? []) as { id: string; user_id: string; created_at: string | null }[];
  const entitled = await entitledToMonitoring(db, owners);
  return new Set(selectMonitored(rows, entitled).kept.map((t) => t.id));
}
