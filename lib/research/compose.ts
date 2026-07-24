// Compose a grounded answer from retrieved context. The model is handed the
// user's book, live market data, and the agent's own findings (each tagged with
// a citation id) and asked to answer the question in prose while citing the
// findings it stood on. Whatever it cites is validated against the retrieved set
// before it leaves this function, so a hallucinated citation cannot survive.

import OpenAI from 'openai';
import { NO_ADVICE_GUARDRAIL } from '@/lib/ai-guardrail';
import { fence, INJECTION_GUARD } from '@/lib/prompt-safety';
import { hasAdviceLanguage } from '@/lib/investigation-memo';
import { FINDING_KIND_LABEL, type Finding, type GroundedAnswer, type ResearchContext } from './types';
import { extractCitedIds, validateCitations } from './grounding';

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
  return (_client ??= new OpenAI({ apiKey }));
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = `${INJECTION_GUARD}
${NO_ADVICE_GUARDRAIL}

You are a senior analyst at Helm Intelligence. You answer the user's question about their own portfolio by composing from the grounded context you are given: their holdings, live market data, and FINDINGS the Helm agent has already surfaced against their positions.

GROUNDING RULES (non-negotiable):
1. Answer ONLY from the provided context. Never invent a finding, a number, a filing, or a quote.
2. When you rely on a FINDING, cite it inline by its id in square brackets, e.g. [catch:1a2b]. Cite every finding you use.
3. If the findings do not cover the question, say so plainly ("Helm hasn't surfaced a finding on that yet") and answer only from the holdings and market data you were given, clearly as general context.
4. Use specific numbers from the context. Prefer the user's real dollar values and the finding quotes over generalities.
5. Describe state and evidence. Do not tell the user to buy, sell, trim, add, or exit. No advisability judgments.
6. The VALUE SURFACED block is dollars Helm FLAGGED (e.g. potential tax savings), not investment returns or performance. Never say Helm "made" or "earned" the user money; say "surfaced" or "flagged". Tax figures are estimates before wash-sale checks, not tax advice.
7. Be concise and direct, like a research note. 2 to 5 short paragraphs or tight bullets.

Respond with valid JSON, no markdown fences:
{
  "answer": "your grounded prose answer with [id] citations inline",
  "citedIds": ["catch:...", "inv:...", "action:..."],
  "followUps": ["a natural next question the user might ask", "another"]
}
followUps are questions the USER would type next, informational not directive.`;

function formatFinding(f: Finding): string {
  const bits = [`[${f.id}]`, `(${FINDING_KIND_LABEL[f.kind]}`];
  if (f.ticker) bits.push(`· ${f.ticker}`);
  if (f.verdict) bits.push(`· ${f.verdict}`);
  bits.push(`· ${f.date ?? 'n/a'})`);
  let line = `${bits.join(' ')} ${f.summary}`;
  if (f.claim) line += `\n    pillar: ${f.claim}`;
  if (f.quote) line += `\n    quote: "${f.quote.slice(0, 240)}"`;
  line += `\n    source: ${f.source}`;
  return line;
}

function formatContext(ctx: ResearchContext): string {
  const parts: string[] = [];

  if (ctx.portfolio) {
    const p = ctx.portfolio;
    const rows = p.holdings
      .map(
        (h) =>
          `  ${h.ticker}: $${Math.round(h.value).toLocaleString()} (${h.pct.toFixed(1)}%${
            h.unrealizedGainLoss != null
              ? `, unrealized ${h.unrealizedGainLoss >= 0 ? '+' : ''}$${Math.round(h.unrealizedGainLoss).toLocaleString()}`
              : ''
          }${h.sector ? `, ${h.sector}` : ''})`,
      )
      .join('\n');
    const sectors = p.sectorAllocation
      .filter((s) => s.pct >= 1)
      .map((s) => `${s.sector} ${s.pct.toFixed(0)}%`)
      .join(' · ');
    parts.push(
      `=== PORTFOLIO (real book) ===\nTotal value $${Math.round(p.totalValue).toLocaleString()} · cost basis $${Math.round(p.totalCostBasis).toLocaleString()} · unrealized ${p.totalUnrealized >= 0 ? '+' : ''}$${Math.round(p.totalUnrealized).toLocaleString()} · ${p.positionCount} positions\nSector allocation: ${sectors || 'n/a'}\nHoldings (richest first):\n${rows}`,
    );
  }

  if (ctx.tax) parts.push(ctx.tax);

  if (ctx.ledger.lines.length > 0) {
    const l = ctx.ledger.lines
      .map((x) => `  ${x.label}: $${x.amount.toLocaleString()}${x.detail ? ` (${x.detail})` : ''}`)
      .join('\n');
    parts.push(
      `=== VALUE SURFACED BY HELM (dollars flagged, NOT a performance/return claim) ===\nTotal surfaced: $${ctx.ledger.surfacedTotal.toLocaleString()}\n${l}`,
    );
  }

  if (ctx.marketData) parts.push(`=== LIVE MARKET DATA ===\n${ctx.marketData}`);

  if (ctx.findings.length > 0) {
    parts.push(`=== AGENT FINDINGS (cite by id) ===\n${ctx.findings.map(formatFinding).join('\n\n')}`);
  } else {
    parts.push('=== AGENT FINDINGS ===\n(none surfaced for this question)');
  }

  return parts.join('\n\n');
}

export async function composeAnswer(
  ctx: ResearchContext,
  history: ConversationTurn[] = [],
): Promise<GroundedAnswer> {
  const messages: OpenAI.ChatCompletionMessageParam[] = [{ role: 'system', content: SYSTEM_PROMPT }];

  for (const turn of history.slice(-4)) {
    if ((turn.role === 'user' || turn.role === 'assistant') && typeof turn.content === 'string') {
      messages.push({ role: turn.role, content: fence(turn.content, 'HISTORY') });
    }
  }

  messages.push({
    role: 'user',
    content: `${formatContext(ctx)}\n\nUSER QUESTION: ${fence(ctx.query, 'USER_QUESTION')}`,
  });

  const completion = await getClient().chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    temperature: 0.4,
    max_tokens: 1200,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content ?? '';
  let parsed: { answer?: string; citedIds?: unknown; followUps?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { answer: raw };
  }

  const answer = String(parsed.answer ?? '').trim();
  // Trust ids the model listed, plus any [id] tokens it left inline in the prose.
  const citedIds = [...new Set([...extractCitedIds(parsed.citedIds), ...extractCitedIds(answer)])];
  const citations = validateCitations(citedIds, ctx.findings);
  const followUps = Array.isArray(parsed.followUps)
    ? parsed.followUps.filter((x): x is string => typeof x === 'string').slice(0, 3)
    : [];

  return {
    type: 'grounded_answer',
    answer,
    citations,
    followUps,
    adviceFlag: hasAdviceLanguage(answer),
  };
}
