// lib/anthropic-judge.ts
// Anthropic client for the thesis evidence judge's filing lane.
//
// Named -judge rather than -anthropic so it cannot collide with the shared
// client another surface may introduce; nothing outside the scorer imports it.

import Anthropic from '@anthropic-ai/sdk';
import { usageFromAnthropic, type TokenUsage } from '@/lib/ai/pricing';

/**
 * The filing lane's model.
 *
 * Measured offline on 24 theses, two blind arbiter panels, 104 graded cases:
 * gpt-4o-mini files the right row 54.8% of the time, routing [filing] sources
 * here takes that to 76.0% (95% CI 67-83). The mechanism is the verbatim
 * excerpt guard: weak models paraphrase long filings instead of copying them,
 * and every non-verbatim loss in the control was on a filing source.
 */
export const FILING_JUDGE_MODEL = 'claude-sonnet-5';

/**
 * Enough headroom for ~12 candidates x ~5 pillars of evidence rows. A truncated
 * response is unparseable JSON, so it degrades through the same fallback as a
 * malformed one rather than silently filing a partial batch.
 */
const MAX_TOKENS = 8000;

/**
 * The Messages API has no `response_format: json_object`. The shared system
 * prompt already ends with the required JSON shape; this is a formatting
 * instruction only and says nothing about how to judge, so both lanes are
 * scored on identical rules.
 */
export const JSON_ONLY_INSTRUCTION =
  '\nReturn ONLY that JSON object. No preamble, no commentary, no markdown code fence. If nothing bears, return { "evidence": [] }.';

let client: Anthropic | null = null;

/**
 * Whether the filing lane can run at all. Absent key means local dev, CI and
 * any environment that has not been given one keep today's single-call
 * behaviour instead of throwing.
 */
export function anthropicJudgeAvailable(): boolean {
  const key = process.env.ANTHROPIC_API_KEY;
  return typeof key === 'string' && key.length > 0;
}

function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export interface AnthropicJudgeCall {
  text: string;
  /** True when the model ran out of output budget, so `text` is incomplete. */
  truncated: boolean;
  /** Tokens the API reported for this call, so the caller can price it. */
  usage: TokenUsage;
}

/**
 * One judge call. The system prompt is sent as a cached block: it is byte-stable
 * across every thesis in a run, so after the first call it is served at the
 * cache read rate.
 *
 * No temperature parameter: it is rejected on this model, and a classifier must
 * not sample regardless.
 */
export async function judgeWithAnthropic(
  systemPrompt: string,
  userPrompt: string,
): Promise<AnthropicJudgeCall> {
  const res = await getClient().messages.create({
    model: FILING_JUDGE_MODEL,
    max_tokens: MAX_TOKENS,
    output_config: { effort: 'low' },
    system: [
      {
        type: 'text',
        text: `${systemPrompt}${JSON_ONLY_INSTRUCTION}`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = res.content
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('');

  return { text, truncated: res.stop_reason === 'max_tokens', usage: usageFromAnthropic(res.usage) };
}

/**
 * Parse a judge response into the evidence array.
 *
 * Tolerant of a code fence or a leading sentence, because without
 * `response_format` the model may wrap the object. Slicing to the outermost
 * braces is a formatting tolerance only: it never alters a verdict, an excerpt
 * or an index. Anything it cannot parse is reported, never swallowed, so the
 * caller can degrade to the OpenAI path instead of dropping evidence.
 */
export function parseJudgeJson<T>(text: string): { rows: T[]; parseError: string | null } {
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start < 0 || end <= start) return { rows: [], parseError: 'no JSON object in response' };
  try {
    const parsed = JSON.parse(stripped.slice(start, end + 1)) as { evidence?: unknown };
    if (!Array.isArray(parsed.evidence)) return { rows: [], parseError: 'no evidence array' };
    return { rows: parsed.evidence as T[], parseError: null };
  } catch (err) {
    return { rows: [], parseError: err instanceof Error ? err.message : String(err) };
  }
}
