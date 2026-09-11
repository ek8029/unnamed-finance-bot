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

function functions(o: unknown, path = 'V3_COPY'): string[] {
  if (typeof o === 'function') return [path];
  if (Array.isArray(o)) return o.flatMap((v, i) => functions(v, `${path}[${i}]`));
  if (o && typeof o === 'object') return Object.entries(o).flatMap(([k, v]) => functions(v, `${path}.${k}`));
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
    lint('loop.many', V3_COPY.loop.many(1, 1, '$500'));
    lint('loop.syncing', V3_COPY.loop.syncing('Fidelity'));
    lint('loop.positions', V3_COPY.loop.positions(1));
    lint('loop.positions', V3_COPY.loop.positions(3));
    lint('loop.already', V3_COPY.loop.already('Schwab'));
    lint('loop.andMore', V3_COPY.loop.andMore(3));
    lint('loop.shares', V3_COPY.loop.shares('1'));
    lint('loop.shares', V3_COPY.loop.shares('0.5'));
    lint('firstLook.sharedNames', V3_COPY.firstLook.sharedNames(1));
    lint('firstLook.sharedNames', V3_COPY.firstLook.sharedNames(4));
    lint('firstLook.moverUp', V3_COPY.firstLook.moverUp('NVDA', '2.10%'));
    lint('firstLook.moverDown', V3_COPY.firstLook.moverDown('NVDA', '2.10%'));
    lint('reveal.stillSyncing', V3_COPY.reveal.stillSyncing('Fidelity'));
    lint('reveal.receiptHeading', V3_COPY.reveal.receiptHeading('NVDA'));
    lint('reveal.receiptFallback', V3_COPY.reveal.receiptFallback('NVDA'));
  });
  it('every function leaf in V3_COPY is exercised by the templated-lines test', () => {
    const covered = [
      'V3_COPY.step',
      'V3_COPY.loop.many',
      'V3_COPY.loop.syncing',
      'V3_COPY.loop.already',
      'V3_COPY.loop.positions',
      'V3_COPY.loop.andMore',
      'V3_COPY.loop.shares',
      'V3_COPY.firstLook.sharedNames',
      'V3_COPY.firstLook.moverUp',
      'V3_COPY.firstLook.moverDown',
      'V3_COPY.reveal.stillSyncing',
      'V3_COPY.reveal.receiptHeading',
      'V3_COPY.reveal.receiptFallback',
    ];
    const actual = functions(V3_COPY);
    const missing = covered.filter((p) => !actual.includes(p));
    const untested = actual.filter((p) => !covered.includes(p));
    expect(missing, `templated-lines test no longer calls: ${missing.join(', ')}`).toEqual([]);
    expect(untested, `V3_COPY has function(s) not exercised by the templated-lines test: ${untested.join(', ')}`).toEqual([]);
  });
});
