/**
 * READ ONLY. Counts only, never emails or row content.
 *
 * Backs three claims made by the insight prominence change (lib/insight-prominence.ts):
 *
 *  1. Chained .or() calls are ANDed by PostgREST. The reader relies on this to
 *     add the expiry arm next to the existing snooze arm, and the second or()
 *     here narrows the same query, which is the discriminating check.
 *  2. How many open rows the new "gone" filters would drop today (expired, or
 *     acted on through is_useful).
 *  3. How many open rows would still be ANNOUNCED for someone with no
 *     watermark, i.e. how loud the first visit is after this change.
 *
 * Run: npx tsx scripts/probe-insight-prominence.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

/** The insight types readInsights surfaces. Spending, credit and subscription
 *  detections never reach a surface, so they are not counted here. */
const TYPES = ['portfolio', 'market', 'tax', 'concentration', 'performance'];

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const now = new Date().toISOString();
  const graceCutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

  const open = () =>
    sb.from('insights').select('id', { count: 'exact', head: true })
      .in('insight_type', TYPES)
      .eq('is_dismissed', false)
      .eq('is_archived', false)
      .or(`snoozed_until.is.null,snoozed_until.lte.${now}`);

  const show = async (label: string, q: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
    const { count, error } = await q;
    console.log(`${label}: ${count ?? '-'}${error ? ` (${error.message})` : ''}`);
  };

  await show('open, as the reader saw it before this change', open());
  await show('open AND expired', open().lte('expires_at', now));
  await show('open AND acted on (is_useful true)', open().eq('is_useful', true));
  await show(
    'open after the new gone filters',
    open().or(`expires_at.is.null,expires_at.gt.${now}`).not('is_useful', 'is', true),
  );
  await show(
    'of those, ANNOUNCED with no watermark (created in the last 72h)',
    open().or(`expires_at.is.null,expires_at.gt.${now}`).not('is_useful', 'is', true).gt('created_at', graceCutoff),
  );
  await show(
    'two .or() calls, the second narrowing to 72h: proves PostgREST ANDs them',
    open().or(`created_at.gt.${graceCutoff},created_at.gt.${graceCutoff}`),
  );
  await show(
    'people who already carry a watermark',
    sb.from('user_preferences').select('user_id', { count: 'exact', head: true }).not('updates_seen_at', 'is', null),
  );
}

main();
