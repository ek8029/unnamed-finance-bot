// Standing questions: the minimal memory + obligation loop. A watched question
// is re-run by retrieving its context fresh and diffing the finding ids
// against the snapshot from the last run — new ids are new evidence, and those
// findings (with their receipts) are what the weekly note reports. No LLM call
// happens here; the note composer does the writing.

import type { SupabaseClient } from '@supabase/supabase-js';
import { retrieveContext } from './retrieve';
import type { Finding } from './types';

export const MAX_STANDING_QUESTIONS = 10;

export interface StandingQuestion {
  id: string;
  question: string;
  active: boolean;
  lastRunAt: string | null;
  lastFindingIds: string[];
  createdAt: string;
}

export interface StandingDelta {
  question: StandingQuestion;
  /** Findings retrieved this run that were not present last run. */
  newFindings: Finding[];
}

function rowToQuestion(r: Record<string, unknown>): StandingQuestion {
  return {
    id: String(r.id),
    question: String(r.question),
    active: Boolean(r.active),
    lastRunAt: r.last_run_at ? String(r.last_run_at) : null,
    lastFindingIds: Array.isArray(r.last_finding_ids) ? (r.last_finding_ids as string[]).map(String) : [],
    createdAt: String(r.created_at),
  };
}

/** Active watched questions, oldest first (including when the table is missing → []). */
export async function getStandingQuestions(db: SupabaseClient, userId: string): Promise<StandingQuestion[]> {
  try {
    const { data, error } = await db
      .from('standing_questions')
      .select('id, question, active, last_run_at, last_finding_ids, created_at')
      .eq('user_id', userId)
      .eq('active', true)
      .order('created_at', { ascending: true });
    if (error || !data) return [];
    return data.map(rowToQuestion);
  } catch {
    return [];
  }
}

/**
 * Re-run one standing question: fresh retrieval, diff against the last
 * snapshot, persist the new snapshot (service-role write), return the delta.
 */
export async function runStandingQuestion(
  db: SupabaseClient,
  userId: string,
  sq: StandingQuestion,
): Promise<StandingDelta> {
  const ctx = await retrieveContext(db, userId, sq.question);
  const seen = new Set(sq.lastFindingIds);
  const newFindings = ctx.findings.filter((f) => !seen.has(f.id));

  await db
    .from('standing_questions')
    .update({
      last_run_at: new Date().toISOString(),
      last_finding_ids: ctx.findings.map((f) => f.id),
    })
    .eq('id', sq.id);

  // First run has no baseline — everything retrieved would read as "new".
  // Record the snapshot, report no delta.
  if (sq.lastRunAt == null) return { question: sq, newFindings: [] };

  return { question: sq, newFindings };
}
