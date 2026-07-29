// The weekly analyst note: once a week the agent writes the user a short memo
// composed from what it actually found on their book — the retention ritual
// the research council picked as the first push surface. Same grounding
// discipline as the chat path: the model cites findings by id, and any
// citation that wasn't retrieved is dropped before the note is stored.

import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NO_ADVICE_GUARDRAIL } from '@/lib/ai-guardrail';
import { INJECTION_GUARD } from '@/lib/prompt-safety';
import { hasAdviceLanguage } from '@/lib/investigation-memo';
import { formatFinding } from './compose';
import { getRecentFindings } from './findings';
import { getPortfolioBrief, getTaxContext, getValueLedger } from './account';
import { computeStanding } from './standing';
import { extractCitedIds, validateCitations } from './grounding';
import type { AnalystNote, Finding } from './types';

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
  return (_client ??= new OpenAI({ apiKey }));
}

/** Monday of the week containing `d`, as YYYY-MM-DD (UTC). */
export function weekStartOf(d: Date = new Date()): string {
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = utc.getUTCDay(); // 0 = Sunday
  utc.setUTCDate(utc.getUTCDate() - ((day + 6) % 7));
  return utc.toISOString().slice(0, 10);
}

const NOTE_SYSTEM_PROMPT = `${INJECTION_GUARD}
${NO_ADVICE_GUARDRAIL}

You are a senior analyst at Helm Intelligence writing the user's WEEKLY NOTE: a short memo about their own portfolio, composed only from the grounded context you are given (their holdings, tax context, and the FINDINGS the Helm agent surfaced, with the ones from this week marked).

Shape of the note, in plain prose (no markdown headings, no bullets unless a list is genuinely clearer):
1. Open with the one thing that mattered most on their book this week.
2. What the agent found this week and what it means for their actual positions — real dollar values, specific findings.
3. Close with what next week holds (earnings on file, pillars under pressure, anything unresolved). If the week was quiet, say so honestly — a quiet week is a finding, not a failure.

GROUNDING RULES (non-negotiable):
1. Write ONLY from the provided context. Never invent a finding, a number, a filing, or a quote.
2. When you rely on a FINDING, cite it inline by its id in square brackets, e.g. [catch:1a2b]. Cite every finding you use.
3. Use the user's real dollar values and the finding quotes over generalities.
4. Describe state and evidence. Do not tell the user to buy, sell, trim, add, or exit. No advisability judgments.
5. The VALUE SURFACED block is dollars Helm FLAGGED (e.g. potential tax savings), not investment returns. Never say Helm "made" or "earned" the user money; say "surfaced" or "flagged". Tax figures are estimates before wash-sale checks, not tax advice.
6. 3 to 5 short paragraphs. Written, not listed. This is a memo someone forwards, not a dashboard.

Respond with valid JSON, no markdown fences:
{
  "title": "specific, calm, under 60 characters — what this week was about",
  "body": "the memo prose with [id] citations inline",
  "citedIds": ["catch:...", "inv:...", "action:..."]
}`;

export interface AnalystNoteDraft {
  weekStart: string;
  title: string;
  body: string;
  citations: Finding[];
  stats: {
    findings: number;
    freshFindings: number;
    surfacedTotal: number;
    adviceFlag: boolean;
  };
}

/**
 * Compose (but do not store) this week's note for a user. Returns null when
 * there is no book to write about.
 */
export async function composeWeeklyNote(
  db: SupabaseClient,
  userId: string,
): Promise<AnalystNoteDraft | null> {
  const brief = await getPortfolioBrief(db, userId);
  if (!brief || brief.positionCount === 0) return null;

  const [findings, ledger] = await Promise.all([
    getRecentFindings(db, userId, 40),
    getValueLedger(db, userId, brief),
  ]);
  const tax = await getTaxContext(db, userId, brief, new Date().getFullYear());
  const standing = computeStanding(brief, findings, ledger);

  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const fresh = findings.filter((f) => (f.date ?? '') >= weekAgo);
  // The note leans on this week; older findings ride along as background so a
  // quiet week can still reference the standing picture.
  const background = findings.filter((f) => (f.date ?? '') < weekAgo).slice(0, 8);
  const given = [...fresh, ...background];

  const parts: string[] = [];
  const holdings = brief.holdings
    .map(
      (h) =>
        `  ${h.ticker}: $${Math.round(h.value).toLocaleString()} (${h.pct.toFixed(1)}%${
          h.unrealizedGainLoss != null
            ? `, unrealized ${h.unrealizedGainLoss >= 0 ? '+' : ''}$${Math.round(h.unrealizedGainLoss).toLocaleString()}`
            : ''
        })`,
    )
    .join('\n');
  parts.push(
    `=== PORTFOLIO (real book) ===\nTotal value $${Math.round(brief.totalValue).toLocaleString()} · unrealized ${brief.totalUnrealized >= 0 ? '+' : ''}$${Math.round(brief.totalUnrealized).toLocaleString()} · ${brief.positionCount} positions\n${holdings}`,
  );
  if (tax) parts.push(tax);
  if (ledger.surfacedTotal > 0) {
    parts.push(
      `=== VALUE SURFACED (flagged, not returns) ===\n${ledger.lines
        .map((l) => `  ${l.label}: $${Math.round(l.amount).toLocaleString()}`)
        .join('\n')}`,
    );
  }
  parts.push(`=== WHERE THEY STAND (deterministic) ===\n${standing.headline}\n${standing.checks.map((c) => `  [${c.status}] ${c.detail}`).join('\n')}`);
  parts.push(
    fresh.length > 0
      ? `=== FINDINGS THIS WEEK (cite by id) ===\n${fresh.map(formatFinding).join('\n\n')}`
      : '=== FINDINGS THIS WEEK ===\n(none — a quiet week on this book)',
  );
  if (background.length > 0) {
    parts.push(`=== STANDING FINDINGS (older, cite by id only if needed) ===\n${background.map(formatFinding).join('\n\n')}`);
  }

  const completion = await getClient().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: NOTE_SYSTEM_PROMPT },
      { role: 'user', content: `${parts.join('\n\n')}\n\nWrite this week's note.` },
    ],
    temperature: 0.4,
    max_tokens: 1100,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content ?? '';
  let parsed: { title?: string; body?: string; citedIds?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const body = String(parsed.body ?? '')
    .replace(/\s?\[(?![a-z_]+:)[^\]]*\]/g, '')
    .trim();
  if (!body) return null;

  const citedIds = [...new Set([...extractCitedIds(parsed.citedIds), ...extractCitedIds(body)])];
  const citations = validateCitations(citedIds, given);

  return {
    weekStart: weekStartOf(),
    title: String(parsed.title ?? '').trim().slice(0, 120) || 'This week on your book',
    body,
    citations,
    stats: {
      findings: findings.length,
      freshFindings: fresh.length,
      surfacedTotal: Math.round(ledger.surfacedTotal),
      adviceFlag: hasAdviceLanguage(body),
    },
  };
}

/** Upsert the note for its week (service-role writes only). */
export async function saveAnalystNote(
  db: SupabaseClient,
  userId: string,
  draft: AnalystNoteDraft,
): Promise<{ error: { message: string } | null }> {
  const { error } = await db.from('analyst_notes').upsert(
    {
      user_id: userId,
      week_start: draft.weekStart,
      title: draft.title,
      body: draft.body,
      citations: draft.citations,
      stats: draft.stats,
    },
    { onConflict: 'user_id,week_start' },
  );
  return { error };
}

/** Latest stored note for a user, or null (including when the table is missing). */
export async function getLatestNote(db: SupabaseClient, userId: string): Promise<AnalystNote | null> {
  try {
    const { data, error } = await db
      .from('analyst_notes')
      .select('id, week_start, title, body, citations, stats, created_at')
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: String(data.id),
      weekStart: String(data.week_start),
      title: String(data.title),
      body: String(data.body),
      citations: Array.isArray(data.citations) ? (data.citations as Finding[]) : [],
      createdAt: String(data.created_at),
      adviceFlag: Boolean((data.stats as { adviceFlag?: boolean } | null)?.adviceFlag),
    };
  } catch {
    return null; // table not migrated yet — the note simply doesn't exist
  }
}
