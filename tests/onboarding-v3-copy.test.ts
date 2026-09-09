// tests/onboarding-v3-copy.test.ts
import { describe, it, expect } from 'vitest';
import { V3_COPY } from '@/lib/onboarding/v3-copy';
import { hasAdviceLanguage } from '@/lib/investigation-memo';

function strings(o: unknown, path = 'V3_COPY'): [string, string][] {
  if (typeof o === 'string') return [[path, o]];
  if (Array.isArray(o)) return o.flatMap((v, i) => strings(v, `${path}[${i}]`));
  if (o && typeof o === 'object') return Object.entries(o).flatMap(([k, v]) => strings(v, `${path}.${k}`));
  return [];
}

const lint = (path: string, s: string) => {
  expect(s.includes('—'), `${path}: em dash`).toBe(false);
  expect(s.includes('!'), `${path}: exclamation`).toBe(false);
  expect(hasAdviceLanguage(s), `${path}: advice`).toBe(false);
};

describe('onboarding v3 copy', () => {
  const all = strings(V3_COPY);
  it('has copy', () => { expect(all.length).toBeGreaterThan(20); });
  for (const [path, s] of all) {
    it(`${path} passes the copy rules`, () => lint(path, s));
  }
  it('templated lines pass the copy rules with sample values', () => {
    lint('step', V3_COPY.step(2));
    lint('loop.many', V3_COPY.loop.many(2, 14, '$120,400'));
    lint('loop.syncing', V3_COPY.loop.syncing('Fidelity'));
    lint('loop.already', V3_COPY.loop.already('Schwab'));
    lint('reveal.stillSyncing', V3_COPY.reveal.stillSyncing('Fidelity'));
    lint('reveal.receiptHeading', V3_COPY.reveal.receiptHeading('NVDA'));
    lint('reveal.receiptFallback', V3_COPY.reveal.receiptFallback('NVDA'));
  });
});
