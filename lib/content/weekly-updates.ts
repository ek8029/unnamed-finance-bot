/**
 * "This Week at Helm" data layer. Weekly founder-voice updates, DB-backed and
 * editable from admin. Public reads published entries; the market section is
 * auto-drafted from real thesis activity, then edited by hand. No fabrication.
 */
import { createServiceClient } from '@/lib/supabase/server';
import { HOUSE_THESES } from './house-theses';
import { getTickerThesisData } from './public-thesis';

export interface WeeklyUpdate {
  id: string;
  week_of: string;              // YYYY-MM-DD
  title: string;
  intro: string;
  body_helm: string;
  body_market: string | null;
  status: 'draft' | 'published';
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function getPublishedUpdates(limit = 50): Promise<WeeklyUpdate[]> {
  const db = await createServiceClient();
  const { data } = await db
    .from('weekly_updates')
    .select('*')
    .eq('status', 'published')
    .order('week_of', { ascending: false })
    .limit(limit);
  return (data ?? []) as WeeklyUpdate[];
}

export async function getLatestPublished(): Promise<WeeklyUpdate | null> {
  return (await getPublishedUpdates(1))[0] ?? null;
}

export async function getPublishedByWeek(week: string): Promise<WeeklyUpdate | null> {
  const db = await createServiceClient();
  const { data } = await db
    .from('weekly_updates')
    .select('*')
    .eq('week_of', week)
    .eq('status', 'published')
    .maybeSingle();
  return (data as WeeklyUpdate) ?? null;
}

/** Admin: everything, drafts included. */
export async function getAllUpdates(): Promise<WeeklyUpdate[]> {
  const db = await createServiceClient();
  const { data } = await db
    .from('weekly_updates')
    .select('*')
    .order('week_of', { ascending: false })
    .limit(100);
  return (data ?? []) as WeeklyUpdate[];
}

/**
 * Auto-draft the "Broader market update" from the week's real thesis activity.
 * Honest framing: contradicts = a reason challenged, supports = held, and an
 * explicit "nothing broke" line when there are no contradicts. Edited by hand after.
 */
export async function draftMarketSection(): Promise<string> {
  const db = await createServiceClient();
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { data: ev } = await db
    .from('content_events')
    .select('ticker, company, verdict, pillar_claim, cite_date')
    .gte('created_at', since)
    .order('created_at', { ascending: false });
  const events = ev ?? [];
  const moved = events.filter((e) => e.verdict === 'contradicts');
  const held = events.filter((e) => e.verdict === 'supports');

  const health = (await Promise.all(HOUSE_THESES.slice(0, 6).map((t) => getTickerThesisData(t.ticker))))
    .filter(Boolean)
    .map((h) => ({ ticker: h!.ticker, healthLabel: h!.healthLabel }));

  const lines: string[] = [];
  lines.push('**What moved**');
  if (moved.length) {
    for (const e of moved.slice(0, 5)) lines.push(`- ${e.ticker}: a reason to own it was challenged this week.`);
  } else {
    lines.push('- Nothing broke this week. Every tracked thesis still holds on the evidence.');
  }
  lines.push('');
  lines.push('**What held up**');
  if (held.length) {
    for (const e of held.slice(0, 5)) lines.push(`- ${e.ticker}: a fresh filing or headline supported the thesis.`);
  } else {
    lines.push('- Quiet week for new filings on the tracked names.');
  }
  lines.push('');
  lines.push('**What we are watching**');
  for (const h of health.slice(0, 5)) lines.push(`- ${h.ticker}: ${h.healthLabel}`);

  return lines.join('\n');
}
