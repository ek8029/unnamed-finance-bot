// lib/judge-escalation.ts
// E2 (spec 2026-07-16): two-speed judge. gpt-4o-mini does bulk reads; rows it
// grades MATERIAL (or self-reports low confidence) are re-reviewed by a stronger
// model before they can touch status math. The frontier model acts as a senior
// analyst reviewing a junior's finding: confirm, downgrade to context, or reject.
// On any escalation failure the original verdict is kept — an API blip must
// never lose evidence.

import type OpenAI from 'openai';
import { fence, INJECTION_GUARD } from '@/lib/prompt-safety';

export const ESCALATION_MODEL = 'gpt-4o';
/** Hard per-run cap: escalation exists to sharpen the few rows that matter. */
export const ESCALATION_CAP = 20;

export type EscalationAction = 'keep' | 'downgrade' | 'reject';

export interface EscalationInput {
  pillarClaim: string;
  verdict: 'supports' | 'contradicts' | 'neutral';
  materiality: 'material' | 'context';
  excerpt: string;
  why: string;
}

/** Pure: does this row's verdict warrant a second, stronger read? */
export function needsEscalation(row: { materiality: string; confidence?: string | null }): boolean {
  return row.materiality === 'material' || row.confidence === 'low';
}

const REVIEW_PROMPT = `You are a senior equity analyst reviewing a junior analyst's evidence findings before they reach a client.
Each finding links a verbatim source excerpt to a thesis pillar with a verdict and materiality grade.
For each finding decide ONE action:
- "keep": the connection is direct and the materiality grade is right.
- "downgrade": genuinely relevant, but graded material when it is only informative background; demote to context.
- "reject": the connection is indirect, hedged, thematic, or the excerpt does not actually bear on the pillar's causal claim.
Judge only what is in front of you. Do not invent facts. No em dashes.
Respond with JSON exactly: { "reviews": [ { "index": <1-based finding number>, "action": "keep" | "downgrade" | "reject", "reason": "<one sentence>" } ] }`;

/**
 * Review a batch of escalation candidates in one call.
 * Returns one action per input row (aligned by index) plus `reviewed`: whether
 * the senior model actually ran. On API/parse failure `reviewed` is false and
 * all actions are "keep" (evidence is never lost) — the caller must NOT attribute
 * those rows to the escalation model when reviewed is false.
 */
export async function reviewEscalations(
  openai: OpenAI,
  rows: EscalationInput[],
  log: string[],
  model: string = ESCALATION_MODEL,
): Promise<{ actions: EscalationAction[]; reviewed: boolean }> {
  const actions: EscalationAction[] = rows.map(() => 'keep');
  if (rows.length === 0) return { actions, reviewed: true };
  let reviewed = true;

  const findings = rows
    .map((r, i) =>
      `Finding ${i + 1}\nPillar: ${r.pillarClaim}\nVerdict: ${r.verdict} (${r.materiality})\nExcerpt: "${r.excerpt}"\nJunior analyst's reasoning: ${r.why}`)
    .join('\n\n');

  try {
    const response = await openai.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${INJECTION_GUARD}\n${REVIEW_PROMPT}` },
        { role: 'user', content: fence(findings, 'FINDINGS') },
      ],
    });
    const parsed = JSON.parse(response.choices[0]?.message?.content ?? '{}') as {
      reviews?: { index?: number; action?: string; reason?: string }[];
    };
    for (const r of parsed.reviews ?? []) {
      const i = (r.index ?? 0) - 1;
      if (i < 0 || i >= rows.length) continue;
      if (r.action === 'keep' || r.action === 'downgrade' || r.action === 'reject') {
        actions[i] = r.action;
        if (r.action !== 'keep') log.push(`[escalation] ${r.action}: ${r.reason ?? 'no reason'}`);
      }
    }
  } catch (err) {
    reviewed = false;
    log.push(`[escalation] review failed, keeping original verdicts: ${err instanceof Error ? err.message : String(err)}`);
  }
  return { actions, reviewed };
}
