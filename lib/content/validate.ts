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
  // Advice-word scan runs on Helm's OWN words. A source quoted verbatim that happens
  // to say "should"/"must" is the source speaking, not Helm advising, so strip the
  // cite before scanning.
  const adviceText = normalize(allText).replace(normalize(event.verbatimCite), ' ');
  if (ADVICE_WORDS.test(adviceText)) reasons.push('advice-language word detected');
  if (c.xThread.length < 4) reasons.push('x thread too short');

  return { ok: reasons.length === 0, reasons };
}
