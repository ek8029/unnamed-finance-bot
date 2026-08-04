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
import { expandGroupedCitations, extractCitedIds, validateCitations } from './grounding';

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
2. When you rely on a FINDING, cite it inline by its id in square brackets, copying the id character-for-character from the context. Never shorten, merge, or invent an id — a citation whose id is not copied exactly gets discarded. Cite every finding you use, and only findings (never a context section name or a number).
3. If nothing in the context bears on the question — not the findings, not the holdings, not the tax block — say so plainly, in your own words, and answer from whatever context does apply. Say it at most once, placed where it belongs. NEVER open with a reflexive "Helm hasn't surfaced a finding on that yet" when the context actually bears on the question; if findings or portfolio data speak to it even partially, lead with those.
4. Use specific numbers from the context. Prefer the user's real dollar values and the finding quotes over generalities. Never import outside statistics — index returns, historical averages, "the market typically..." — a number that is not in the context is an invention.
5. Describe state and evidence. Do not tell the user to buy, sell, trim, add, or exit. No advisability judgments.
6. The VALUE SURFACED block is dollars Helm FLAGGED (e.g. potential tax savings), not investment returns or performance. Never say Helm "made" or "earned" the user money; say "surfaced" or "flagged". Tax figures are estimates before wash-sale checks, not tax advice.

SHAPE RULES (these matter as much as grounding — a templated answer reads as machine output and kills trust):
7. Match the answer's size and structure to the question. A narrow factual ask ("how much could I harvest?") gets one or two direct sentences with the number up front — not paragraphs. Only a genuinely broad ask earns multiple paragraphs. Use a list only when the content is truly a list. A "which/what is" question about the book means enumerate EVERY qualifying item in the context — singular phrasing ("which ticker is challenged?") still means all of them, not the first one you find.
8. Lead with the answer itself. Never open by restating the question or describing the portfolio before answering ("Your portfolio remains stable..." as an opener is banned).
9. Banned as sentence or paragraph openers: "Notably", "Additionally", "Furthermore", "Overall", "In terms of", "Looking ahead", "It's worth noting", "It's important to". Connect ideas the way a person talking would, or just start the next sentence.
10. No closing summary sentence. When the substance is done, stop. Never end with a reassurance ("your portfolio remains resilient") or a recap.
11. Minimal markup: **bold** is supported and welcome for tickers, company names, and the key number — use it sparingly. Nothing else renders: no headings, no bullet markers, no other markdown.
12. Performance-vs-benchmark asks: give what the context supports (total unrealized gain against cost basis, the strongest and weakest positions), then say plainly that Helm records the book daily going forward and an honest deposit-aware benchmark comparison unlocks once a few weeks of that history accrue — invite them to ask again then. Confident and specific, not apologetic. Never fabricate index figures.

Respond with valid JSON, no markdown fences:
{
  "answer": "your grounded prose answer with [id] citations inline",
  "citedIds": ["catch:...", "inv:...", "action:..."],
  "followUps": ["a natural next question the user might ask", "another"]
}
followUps are questions the USER would type next, informational not directive.`;

/**
 * The prose renderers support **bold** (and nothing else) — normalize away the
 * markdown they can't render: __underscore__ emphasis becomes plain text and
 * heading prefixes are dropped. Double-asterisk bold passes through for the
 * renderer to style.
 */
export function stripMarkup(text: string): string {
  return text
    .replace(/__([^_]+)__/g, '$1')
    .replace(/^#{1,4}\s+/gm, '');
}

/**
 * Drop a trailing recap sentence the model tacked on despite the prompt
 * ("Overall, ..."). Deterministic backstop for the shape rules — only the
 * final sentence, only when it opens with a recap marker.
 */
export function stripClosingRecap(text: string): string {
  return text
    .replace(/(?:^|(?<=[.!?])\s+)(?:Overall|In summary|In conclusion|All in all)\b[^.!?]*[.!?]\s*$/i, '')
    .trimEnd();
}

export function formatFinding(f: Finding): string {
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
  opts: { adviceAsk?: boolean } = {},
): Promise<GroundedAnswer> {
  const messages: OpenAI.ChatCompletionMessageParam[] = [{ role: 'system', content: SYSTEM_PROMPT }];
  if (opts.adviceAsk) {
    messages.push({
      role: 'system',
      content:
        'The user just asked for advice (a buy/sell/hold decision). Open by saying plainly that Helm does not make recommendations, then give them the state of the position instead: size and P&L, what the findings say for and against it, and anything upcoming. End on the facts. Do NOT close with "factors to consider", "in your decision-making", or any softened nudge — the state IS the answer.',
    });
  }

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

  // The model sometimes "cites" a context section name ("[HARVESTABLE LOSSES]")
  // instead of a finding id. Those aren't citations — strip them from the prose
  // rather than render bracket noise. Real ids ([catch:...], [inv:...]) survive.
  const answer = stripClosingRecap(
    stripMarkup(expandGroupedCitations(String(parsed.answer ?? '')))
      .replace(/\s?\[(?![a-z_]+:)[^\]]*\]/g, '')
      .trim(),
  );
  // Trust ids the model listed, plus any [id] tokens it left inline in the prose.
  const citedIds = [...new Set([...extractCitedIds(parsed.citedIds), ...extractCitedIds(answer)])];
  const citations = validateCitations(citedIds, ctx.findings);
  const followUps = Array.isArray(parsed.followUps)
    ? parsed.followUps.filter((x): x is string => typeof x === 'string').slice(0, 3)
    : [];

  // Fill remaining follow-up slots from the highest-signal findings the answer
  // did NOT cite — deterministic next questions that keep the thread on the
  // agent's real work instead of dead-ending.
  if (followUps.length < 3) {
    const citedSet = new Set(citations.map((f) => f.id));
    for (const f of ctx.findings) {
      if (followUps.length >= 3) break;
      if (citedSet.has(f.id) || !f.ticker) continue;
      if (f.verdict !== 'contradicts' && f.kind !== 'action') continue;
      if (followUps.some((q) => q.includes(f.ticker as string))) continue;
      followUps.push(`What's challenging ${f.ticker}?`);
    }
  }

  return {
    type: 'grounded_answer',
    answer,
    citations,
    followUps,
    // The guard's bare \bbuy\b/\bsell\b would trip on the compliant opener
    // ("Helm does not make buy or sell recommendations") — neutralize
    // recommendation-disclaimer phrasing before testing.
    adviceFlag: hasAdviceLanguage(
      answer.replace(/\b(?:buy|sell|trim|exit)\b[^.!?]*?recommendations?/gi, 'recommendations'),
    ),
  };
}
