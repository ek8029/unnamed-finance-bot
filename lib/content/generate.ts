// lib/content/generate.ts
// Turn a scored ContentEvent into company social copy across 4 platform formats.
// Descriptive and analytical only, never investment advice. Mirrors the lazy
// OpenAI init + json_object response_format pattern from score-helper.ts.

import OpenAI from 'openai';
import type { ContentEvent, GeneratedContent } from './types';
import { fence, INJECTION_GUARD } from '@/lib/prompt-safety';

const GENERATE_MODEL = 'gpt-4o';

const DISCLAIMER = 'Not investment advice. Helm surfaces the evidence; you decide.';

const VOICE_GUIDE = `Voice: a tenured market professional with decades on the desk. Measured, precise, understated authority. Plain declarative sentences. Lead with the fact and let it carry the weight. No hype or superlatives (no huge, massive, soaring, surging, game-changer, breakthrough, exciting). No emoji, no exclamation points, no rhetorical questions, no hashtags. NO em dashes (use periods or commas). Use financial terms precisely and only when they earn their place. Comfortable with nuance and caveats. Never breathless, never salesy, nothing to prove. Write the way a seasoned analyst briefs a smart colleague who is short on time.`;

// Lazy-init: a module-scope `new OpenAI()` throws at import time when
// OPENAI_API_KEY is unset (breaks any non-LLM import of this module).
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

interface LLMContent {
  xThread?: unknown;
  linkedinPost?: unknown;
  caption?: unknown;
}

export async function generateContent(event: ContentEvent): Promise<GeneratedContent> {
  const system = `${INJECTION_GUARD}
You are the voice of Helm Terminal on its company social accounts: a tenured market professional, not a marketer. Descriptive and analytical only, NEVER investment advice. Never use the words buy, sell, should, must, or recommend. BANNED words, never use any of them: game-changer, breakthrough, revolutionary, huge, massive, soaring, surging, exciting, unleash, supercharge. Use the provided quote VERBATIM; never invent quotes, numbers, or events. State only what the evidence supports; if something is uncertain, say so plainly.`;

  const user = `Event:
${fence(JSON.stringify(event), 'EVENT')}
Voice guide:
${fence(VOICE_GUIDE, 'VOICE')}
Every line must carry a specific fact or a precise judgment. Cut hedging and filler: no "may view", "could influence", "indicates", "reflects", or vague "developments". Do not pad to hit a count. Five sharp lines beat eight soft ones.
Return JSON exactly: {"xThread":string[],"linkedinPost":string,"caption":string}. xThread 5-8 items, each a complete thought (no numbering, no "1/"). The X thread must end with this exact line: Full analysis at helmterminal.dev/analyze`;

  let parsed: LLMContent = {};
  const response = await getOpenAI().chat.completions.create({
    model: GENERATE_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
  const raw = response.choices[0]?.message?.content ?? '{}';
  parsed = JSON.parse(raw) as LLMContent;

  const xThread = Array.isArray(parsed.xThread)
    ? (parsed.xThread as unknown[]).map((s) => String(s))
    : [];
  const linkedinPost = typeof parsed.linkedinPost === 'string' ? parsed.linkedinPost : '';
  const caption = typeof parsed.caption === 'string' ? parsed.caption : '';

  return { xThread, linkedinPost, caption, disclaimer: DISCLAIMER };
}
