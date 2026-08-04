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

export interface StandingSnapshot {
  questionId: string;
  findingIds: string[];
  runAt: string;
}

export interface StandingDelta {
  question: StandingQuestion;
  /** Findings retrieved this run that were not present last run. */
  newFindings: Finding[];
  /** The snapshot this run WOULD advance to. Deliberately not written here:
   *  see commitStandingSnapshots. */
  snapshot: StandingSnapshot;
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
 * Evaluate one standing question: fresh retrieval, diff against the last
 * snapshot. PURE with respect to `standing_questions` — nothing is persisted.
 *
 * The snapshot must NOT advance here. It used to, and everything downstream of
 * it could still fail: the note composer has several return-null paths, the
 * OpenAI call can throw, and saveAnalystNote can fail on its own. Any of those
 * left the snapshot advanced with no note written, so the new findings were
 * marked seen and could never surface in a future note. Silent, permanent, and
 * invisible — the user just never hears about evidence the agent did find.
 *
 * Call commitStandingSnapshots only once the note is durably stored.
 */
export async function evaluateStandingQuestion(
  db: SupabaseClient,
  userId: string,
  sq: StandingQuestion,
): Promise<StandingDelta> {
  const ctx = await retrieveContext(db, userId, sq.question);
  const seen = new Set(sq.lastFindingIds);
  const snapshot: StandingSnapshot = {
    questionId: sq.id,
    findingIds: ctx.findings.map((f) => f.id),
    runAt: new Date().toISOString(),
  };

  // First run has no baseline — everything retrieved would read as "new".
  // Establish the baseline, report no delta.
  if (sq.lastRunAt == null) return { question: sq, newFindings: [], snapshot };

  return { question: sq, newFindings: ctx.findings.filter((f) => !seen.has(f.id)), snapshot };
}

/**
 * Advance the snapshots for questions whose delta has actually been reported.
 *
 * Call this AFTER the note is stored, never before. Best-effort per question:
 * one failed write must not roll back a note that is already saved, and a
 * snapshot that fails to advance simply re-reports the same findings next week,
 * which is the harmless direction to fail in.
 */
export async function commitStandingSnapshots(
  db: SupabaseClient,
  snapshots: StandingSnapshot[],
): Promise<number> {
  let committed = 0;
  for (const snap of snapshots) {
    try {
      const { error } = await db
        .from('standing_questions')
        .update({ last_run_at: snap.runAt, last_finding_ids: snap.findingIds })
        .eq('id', snap.questionId);
      if (!error) committed++;
    } catch {
      /* re-reporting next week beats losing the delta */
    }
  }
  return committed;
}
