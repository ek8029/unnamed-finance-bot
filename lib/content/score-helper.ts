// lib/content/score-helper.ts
// Pure scoring core lifted from lib/score-theses.ts: classify source items
// against thesis pillars with an LLM judge, returning verbatim-cited verdicts.
// No DB reads or writes. The caller gathers sources and persists results.

import OpenAI from 'openai';
import type { Pillar } from './types';
import { fence, INJECTION_GUARD } from '@/lib/prompt-safety';

const SCORE_MODEL = 'gpt-4o-mini';

// Lazy-init: a module-scope `new OpenAI()` throws at import time when
// OPENAI_API_KEY is unset (breaks any non-LLM import of this module).
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

export interface SourceDoc {
  text: string;
  date: string;
  url: string;
  sourceType: 'filing' | 'major_news' | 'minor_news';
}

export interface ScoredHit {
  pillarId: string;
  verdict: 'supports' | 'contradicts' | 'neutral';
  excerpt: string;
  date: string;
  url: string;
  sourceType: SourceDoc['sourceType'];
  sourceText: string;
  summary: string;
}

interface LLMEvidenceRow {
  pillar_index: number;
  source_index: number;
  verdict: string;
  excerpt: string;
  summary: string;
}

interface LLMResponse {
  evidence: LLMEvidenceRow[];
}

/**
 * Classify each source against each pillar with the LLM judge. Returns one
 * ScoredHit per (pillar, source) the model genuinely relates. `excerpt` is the
 * model's verbatim quote from the source; `sourceText` is carried through so
 * the caller can run the no-fabrication verbatim guard.
 */
export async function scoreItemsForPillars(
  ticker: string,
  pillars: Pillar[],
  sources: SourceDoc[],
): Promise<ScoredHit[]> {
  if (pillars.length === 0 || sources.length === 0) return [];

  const pillarLines = pillars
    .map((p, i) => `Pillar ${i + 1}: ${p.claim}`)
    .join('\n');

  const sourceLines = sources
    .map((s, i) => `Source ${i + 1} [${s.sourceType}]: ${s.text}`)
    .join('\n\n');

  const systemPrompt = `${INJECTION_GUARD}
You are a senior equity analyst judging whether each source bears on each thesis pillar for ${ticker}.
A single source can bear on more than one pillar. For each pillar a source genuinely relates to, produce a separate evidence row.
Rules:
- Only emit rows where the source clearly bears on the pillar.
- Assign each source to the pillar it most DIRECTLY affects. A change to a specific contract, customer, segment, or revenue stream bears on the pillar about THAT revenue, not merely a downstream "margin" or "valuation" pillar. Only also tag a downstream pillar when the source genuinely speaks to it too.
- Filings are authoritative primary sources. When a filing supports or contradicts a pillar, cite the filing, even if a news item makes a similar point. Sources are tagged [filing], [major_news], [minor_news].
- excerpt must be copied verbatim from the source text. Do not paraphrase or invent.
- No invented numbers. No em dashes.
- verdict: "supports", "contradicts", or "neutral" (neutral only if clearly relevant context).
- summary: one concise sentence explaining what the source means for the pillar.
Respond with JSON exactly in this shape:
{ "evidence": [ { "pillar_index": <1-based pillar number>, "source_index": <1-based source number>, "verdict": "...", "excerpt": "...", "summary": "..." } ] }`;

  const userPrompt = `Thesis pillars:\n${fence(pillarLines, 'PILLARS')}\n\nSources:\n${fence(sourceLines, 'SOURCES')}`;

  let llmRows: LLMEvidenceRow[] = [];
  try {
    const response = await getOpenAI().chat.completions.create({
      model: SCORE_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });
    const raw = response.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as LLMResponse;
    llmRows = Array.isArray(parsed.evidence) ? parsed.evidence : [];
  } catch {
    return [];
  }

  const validVerdicts = new Set(['supports', 'contradicts', 'neutral']);
  const hits: ScoredHit[] = [];

  for (const row of llmRows) {
    const pi = row.pillar_index;
    const si = row.source_index;
    if (
      typeof pi !== 'number' ||
      typeof si !== 'number' ||
      pi < 1 || pi > pillars.length ||
      si < 1 || si > sources.length
    ) {
      continue;
    }
    if (!validVerdicts.has(row.verdict)) continue;
    if (!row.excerpt) continue;

    const pillar = pillars[pi - 1];
    const source = sources[si - 1];

    hits.push({
      pillarId: pillar.id,
      verdict: row.verdict as 'supports' | 'contradicts' | 'neutral',
      excerpt: row.excerpt,
      date: source.date,
      url: source.url,
      sourceType: source.sourceType,
      sourceText: source.text,
      summary: row.summary ?? '',
    });
  }

  return hits;
}
