// lib/notify/preferences.ts
//
// Who has agreed to be interrupted, answered once for every sender.
//
// The columns live on `user_preferences`, keyed by `user_id`. They have never
// lived on `user_profiles`, and a sender that reads the wrong table gets an
// error plus a null row, which reads as "never answered" and therefore opted
// in. That is how an opt-out gets silently overridden, so the read belongs in
// one function rather than copied into each cron.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface AlertPreferences {
  notification_email?: boolean | null;
  notification_market_alerts?: boolean | null;
}

/** A missing row or a null column means never answered, which is not the same
 *  as declined: the defaults in app/api/user/preferences treat these as on, and
 *  so does this. `notification_email` is the master switch that one-click
 *  unsubscribe sets, and it wins over the specific one. */
export function wantsAlerts(prefs: AlertPreferences | null): boolean {
  if (!prefs) return true;
  if (prefs.notification_email === false) return false;
  return prefs.notification_market_alerts !== false;
}

export type PreferenceRead =
  | { ok: true; wants: boolean }
  | { ok: false; reason: string };

/** Reads the preference, keeping "they said no" and "the read failed" apart.
 *
 *  A failed read is not consent. Skipping a send costs a day of lateness and
 *  the next run picks it up; mailing somebody who opted out cannot be undone. */
export async function alertPreference(
  db: SupabaseClient,
  userId: string,
): Promise<PreferenceRead> {
  const { data, error } = await db
    .from('user_preferences')
    .select('notification_email, notification_market_alerts')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return { ok: false, reason: error.message };
  return { ok: true, wants: wantsAlerts(data as AlertPreferences | null) };
}
