// lib/investigation-memo.ts
// E1 (spec 2026-07-16): the bounded investigation agent. When a scan moves a
// pillar to weakening/broken, the agent digs deeper on its own — fixed playbook
// per trigger kind, one escalated-model read, receipts-or-drop validation —
// and writes a one-page memo. Never fires on schedule or neutral flow.
//
// Invariants shared with the scorer: injection-guarded fenced input, every
// timeline quote must exist verbatim in the gathered corpus or the entry is
// dropped, advice verbs discard the whole memo (RIA posture), hard daily caps.

import type { SupabaseClient } from '@supabase/supabase-js';
import type OpenAI from 'openai';
import { fence, INJECTION_GUARD } from '@/lib/prompt-safety';
import { excerptFoundInSource } from '@/lib/thesis-evidence';
import { ESCALATION_MODEL } from '@/lib/judge-escalation';
import { stripFilingHtml, extractFilingSection } from '@/lib/filing-extract';
import type { TriggerKind } from '@/lib/thesis-investigation';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient | any;

export const MAX_INVESTIGATIONS_PER_USER_PER_DAY = 3;
export const MAX_INVESTIGATIONS_PER_THESIS_PER_DAY = 1;
const CORPUS_CHAR_CAP = 48_000; // ~12k tokens

export interface MemoTimelineEntry {
  date: string;
  event: string;
  quote: string;
  sourceTitle?: string;
  sourceUrl?: string | null;
}

export interface InvestigationMemo {
  headline: string;
  timeline: MemoTimelineEntry[];
  breaks_if_test: { condition: string; result: 'met' | 'not_met' | 'partial' | 'no_condition'; reasoning: string };
  watch_next: string[];
}

export interface InvestigationTrigger {
  userId: string;
  thesisId: string;
  pillarId: string;
  ticker: string;
  pillarClaim: string;
  breaksIf: string | null;
  newStatus: 'weakening' | 'broken';
  triggerKind: TriggerKind;
}

/** Advice-language lint: memos describe state, never action. */
export function hasAdviceLanguage(text: string): boolean {
  return /\b(?:buy|sell(?!-)|trim|exit the position|add to the position|consider (?:selling|buying|trimming|adding|exiting))\b/i.test(text);
}

interface EvidenceRow {
  verdict: string;
  materiality: string;
  source_type: string;
  source_title: string;
  source_url: string | null;
  source_published_at: string | null;
  created_at: string;
  excerpt: string;
  why: string;
}

/** Classify the trigger from the freshest contradicting evidence (mirrors thesis-investigation's kinds). */
export function classifyTrigger(rows: Pick<EvidenceRow, 'source_type' | 'verdict'>[]): TriggerKind {
  const contra = rows.filter((r) => r.verdict === 'contradicts');
  if (contra.some((r) => r.source_type === 'price_move')) return 'severe_move';
  if (contra.some((r) => r.source_type === 'filing')) return 'new_filing';
  if (contra.length >= 2) return 'pressure';
  return 'breach';
}

// Local filing fetch (same UA + section extraction as the scorer, duplicated
// here to avoid an import cycle with score-theses).
async function fetchFilingSectionText(url: string, form: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Helm Terminal hello@helmterminal.dev' } });
    if (!res.ok) return '';
    return extractFilingSection(stripFilingHtml(await res.text()), form, 8000);
  } catch {
    return '';
  }
}

// Migration-056 tolerance: table probe, cached per process.
let investigationsTableKnown: boolean | null = null;
async function hasInvestigationsTable(db: AnyClient): Promise<boolean> {
  if (investigationsTableKnown !== null) return investigationsTableKnown;
  const { error } = await db.from('thesis_investigations').select('id').limit(1);
  investigationsTableKnown = !error;
  return investigationsTableKnown;
}

async function underDailyCaps(db: AnyClient, userId: string, thesisId: string): Promise<boolean> {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const iso = dayStart.toISOString();
  const [{ count: userCount }, { count: thesisCount }] = await Promise.all([
    db.from('thesis_investigations').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', iso),
    db.from('thesis_investigations').select('id', { count: 'exact', head: true }).eq('thesis_id', thesisId).gte('created_at', iso),
  ]);
  return (userCount ?? 0) < MAX_INVESTIGATIONS_PER_USER_PER_DAY && (thesisCount ?? 0) < MAX_INVESTIGATIONS_PER_THESIS_PER_DAY;
}

const MEMO_PROMPT = `You are a senior equity analyst writing a one-page investigation memo after new evidence moved a client's thesis pillar.
You receive the pillar (the client's stated reason for holding), its break condition, the trigger, and a corpus of dated evidence.
Write JSON exactly in this shape:
{
  "headline": "<one sentence, max 110 chars, states what happened to the pillar — state only, never advice>",
  "timeline": [ { "date": "YYYY-MM-DD", "event": "<one sentence>", "quote": "<verbatim quote copied exactly from the corpus>" } ],
  "breaks_if_test": { "result": "met" | "not_met" | "partial" | "no_condition", "reasoning": "<2-3 sentences applying the break condition to the evidence>" },
  "watch_next": [ "<up to 3 concrete, checkable future facts that would confirm or refute the move>" ]
}
Rules:
- Every timeline quote must be copied VERBATIM from the corpus. Never paraphrase inside "quote".
- 2 to 5 timeline entries, oldest first, only events that bear on this pillar's mechanism.
- If no break condition was provided, use result "no_condition" and reason about severity instead.
- Describe state, never recommend action: no buy, sell, trim, add, or consider phrasing.
- No invented numbers. No em dashes.`;

/**
 * Run one bounded investigation. Returns the memo id, or null when skipped
 * (caps, missing table, empty corpus) or discarded (no valid receipts, advice
 * language, model failure). Never throws — the scan must not fail on memos.
 */
export async function runInvestigation(
  db: AnyClient,
  openai: OpenAI,
  trigger: InvestigationTrigger,
  log: string[],
): Promise<string | null> {
  try {
    if (!(await hasInvestigationsTable(db))) {
      log.push(`[${trigger.ticker}] investigation skipped: migration 056 not applied`);
      return null;
    }
    if (!(await underDailyCaps(db, trigger.userId, trigger.thesisId))) {
      log.push(`[${trigger.ticker}] investigation skipped: daily cap`);
      return null;
    }

    // --- Gather corpus (playbook by trigger kind, all grounded in stored evidence) ---
    const sinceISO = new Date(Date.now() - 45 * 86400_000).toISOString();
    const { data: evRaw } = await db
      .from('pillar_evidence')
      .select('verdict, materiality, source_type, source_title, source_url, source_published_at, created_at, excerpt, why')
      .eq('pillar_id', trigger.pillarId)
      .gte('created_at', sinceISO)
      .order('created_at', { ascending: true });
    const rows = (evRaw ?? []) as EvidenceRow[];
    if (rows.length === 0) {
      log.push(`[${trigger.ticker}] investigation skipped: no evidence in window`);
      return null;
    }

    let corpus = rows
      .map((r) => `[${(r.source_published_at ?? r.created_at).slice(0, 10)}] (${r.source_type}, ${r.verdict}/${r.materiality}) ${r.source_title}\n"${r.excerpt}"`)
      .join('\n\n');

    // new_filing / breach playbook: refetch the newest contradicting filing's
    // substantive section so the memo reads the document, not just the slice.
    if (trigger.triggerKind === 'new_filing' || trigger.triggerKind === 'breach') {
      const filing = [...rows].reverse().find((r) => r.source_type === 'filing' && r.verdict === 'contradicts' && r.source_url);
      if (filing?.source_url) {
        const fullText = await fetchFilingSectionText(filing.source_url, filing.source_title.split(' ')[0] ?? '');
        if (fullText) corpus += `\n\nFULL FILING SECTION (${filing.source_title}):\n${fullText}`;
      }
    }
    if (corpus.length > CORPUS_CHAR_CAP) corpus = corpus.slice(0, CORPUS_CHAR_CAP);

    // --- One escalated-model read ---
    const userPrompt = [
      `Ticker: ${trigger.ticker}`,
      `Pillar (client's reason for holding): ${fence(trigger.pillarClaim, 'PILLAR')}`,
      `Break condition: ${fence(trigger.breaksIf ?? 'none provided', 'BREAKS_IF')}`,
      `Trigger: pillar moved to ${trigger.newStatus} (${trigger.triggerKind})`,
      `Evidence corpus:\n${fence(corpus, 'CORPUS')}`,
    ].join('\n\n');

    const response = await openai.chat.completions.create({
      model: ESCALATION_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${INJECTION_GUARD}\n${MEMO_PROMPT}` },
        { role: 'user', content: userPrompt },
      ],
    });
    const parsed = JSON.parse(response.choices[0]?.message?.content ?? '{}') as Partial<InvestigationMemo>;

    // --- Receipts-or-drop validation ---
    const timelineRaw = Array.isArray(parsed.timeline) ? parsed.timeline : [];
    const timeline: MemoTimelineEntry[] = [];
    for (const t of timelineRaw) {
      if (!t || typeof t.quote !== 'string' || typeof t.event !== 'string' || typeof t.date !== 'string') continue;
      if (!excerptFoundInSource(t.quote, corpus)) continue; // paraphrased or invented → drop entry
      const src = rows.find((r) => r.excerpt.includes(t.quote.slice(0, 60)) || t.quote.includes(r.excerpt.slice(0, 60)));
      timeline.push({ date: t.date, event: t.event, quote: t.quote, sourceTitle: src?.source_title, sourceUrl: src?.source_url ?? null });
    }
    if (timeline.length === 0) {
      log.push(`[${trigger.ticker}] investigation discarded: no receipt-backed timeline entries`);
      return null;
    }

    const memo: InvestigationMemo = {
      headline: typeof parsed.headline === 'string' ? parsed.headline.slice(0, 140) : `${trigger.ticker} pillar moved to ${trigger.newStatus}`,
      timeline,
      breaks_if_test: {
        condition: trigger.breaksIf ?? '',
        result: (['met', 'not_met', 'partial', 'no_condition'] as const).includes(
          parsed.breaks_if_test?.result as 'met',
        ) ? (parsed.breaks_if_test!.result as InvestigationMemo['breaks_if_test']['result'])
          : trigger.breaksIf ? 'partial' : 'no_condition',
        reasoning: typeof parsed.breaks_if_test?.reasoning === 'string' ? parsed.breaks_if_test.reasoning : '',
      },
      watch_next: (Array.isArray(parsed.watch_next) ? parsed.watch_next : []).filter((w): w is string => typeof w === 'string').slice(0, 3),
    };

    const linted = [memo.headline, memo.breaks_if_test.reasoning, ...memo.watch_next].join(' ');
    if (hasAdviceLanguage(linted)) {
      log.push(`[${trigger.ticker}] investigation discarded: advice language`);
      return null;
    }

    // --- Supersede + insert ---
    await db
      .from('thesis_investigations')
      .update({ status: 'superseded' })
      .eq('pillar_id', trigger.pillarId)
      .eq('status', 'ready');

    const { data: inserted, error: insErr } = await db
      .from('thesis_investigations')
      .insert({
        user_id: trigger.userId,
        thesis_id: trigger.thesisId,
        pillar_id: trigger.pillarId,
        trigger_kind: trigger.triggerKind,
        memo,
        model: ESCALATION_MODEL,
      })
      .select('id')
      .maybeSingle();

    if (insErr || !inserted) {
      log.push(`[${trigger.ticker}] investigation insert error: ${insErr?.message ?? 'no row'}`);
      return null;
    }
    log.push(`[${trigger.ticker}] investigation memo written (${trigger.triggerKind}, ${timeline.length} receipts)`);
    return inserted.id as string;
  } catch (err) {
    log.push(`[${trigger.ticker}] investigation error: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
