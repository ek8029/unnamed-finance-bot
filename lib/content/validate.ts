// lib/content/validate.ts
// Cite-integrity + advice-language gate for generated content. Deterministic,
// no LLM. Run before anything is queued for posting.

import type { ContentEvent, GeneratedContent } from './types';

const ADVICE_WORDS = /\b(buy|sell|should|must|recommend|recommended|strong buy|price target)\b/i;

export interface ValidationResult {
  ok: boolean;
  reasons: string[];
}

export function validateContent(event: ContentEvent, c: GeneratedContent): ValidationResult {
  const reasons: string[] = [];
  const allText = [
    c.xThread.join('\n'),
    c.linkedinPost,
    c.caption,
  ].join('\n');
  const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

  if (!normalize(allText).includes(normalize(event.verbatimCite))) {
    reasons.push('verbatim cite missing from generated content');
  }
  if (ADVICE_WORDS.test(allText)) reasons.push('advice-language word detected');
  if (c.xThread.length < 4) reasons.push('x thread too short');

  return { ok: reasons.length === 0, reasons };
}
