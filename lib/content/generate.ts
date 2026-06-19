// lib/content/generate.ts
// Turn a scored ContentEvent into company social copy across 4 platform formats.
// Descriptive and analytical only, never investment advice. Mirrors the lazy
// OpenAI init + json_object response_format pattern from score-helper.ts.

import OpenAI from 'openai';
import type { ContentEvent, GeneratedContent } from './types';
import { fence, INJECTION_GUARD } from '@/lib/prompt-safety';

const GENERATE_MODEL = 'gpt-4o-mini';

const DISCLAIMER = 'Not investment advice. Helm surfaces the evidence; you decide.';

const VOICE_GUIDE = `Voice: cool, plain, confident. Short declarative sentences. NO em dashes (use periods or commas). No hype words (revolutionary, game-changer, unleash), no emoji spam, no rhetorical questions, no "in today's fast-paced world." Lead with the fact. Sound like a sharp trader who respects the reader's time, not a marketing bot.`;

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
You write Helm Terminal's company social posts. Descriptive and analytical, NEVER investment advice. Never use the words buy, sell, should, must, or recommend. Use the provided quote VERBATIM; never invent quotes or numbers.`;

  const user = `Event:
${fence(JSON.stringify(event), 'EVENT')}
Voice guide:
${fence(VOICE_GUIDE, 'VOICE')}
Return JSON exactly: {"xThread":string[],"linkedinPost":string,"caption":string}. xThread 5-8 items. The X thread must end with: Run any ticker free at helmterminal.dev/analyze`;

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
