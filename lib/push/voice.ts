// lib/push/voice.ts
// What a push says. Its own voice: short, the dollar on THEIR position, first
// person only where Helm did the thing, never a bare ticker move, never advice.
// Pure, capped, tested.

import type { PositionMove } from '@/lib/push/policy';

export const TITLE_MAX = 40;
export const BODY_MAX = 110;

export type PushRoute = 'brief' | 'thesis' | 'inbox' | 'book';

export interface PushMessage {
  title: string;
  body: string;
  route: PushRoute;
  /** A thesis id for the thesis route, a ticker for the book route. */
  id?: string;
}

/** Cut at a word, inside the cap, without leaving a dangling comma. */
export function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const at = cut.lastIndexOf(' ');
  return (at > max / 2 ? cut.slice(0, at) : cut).replace(/[,;:]$/, '') + '.';
}

/** The first sentence of a paragraph, for a body that has to end on a full stop. */
export function firstSentence(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  const m = t.match(/^.+?[.!?](?=\s|$)/);
  return m ? m[0] : t;
}

const money = (n: number) => '$' + Math.round(Math.abs(n)).toLocaleString('en-US');
const pct = (f: number, digits = 1) => `${f >= 0 ? '+' : ''}${(f * 100).toFixed(digits)}%`;

export function briefReady(lead: string, findings: { title: string }[]): PushMessage {
  const n = findings.length;
  const title = n === 0 ? 'Your brief is ready' : `Your brief is ready · ${n} finding${n === 1 ? '' : 's'}`;
  const body = n === 0 ? firstSentence(lead) : findings.map((f) => f.title.replace(/\.$/, '')).join('. ') + '.';
  return { title: clip(title, TITLE_MAX), body: clip(body, BODY_MAX), route: 'brief' };
}

export function positionMoved(moves: PositionMove[], dayPctOfBook?: number | null): PushMessage {
  if (moves.length === 1) {
    const m = moves[0];
    const share = dayPctOfBook !== null && dayPctOfBook !== undefined && Math.abs(dayPctOfBook) >= 0.0005
      ? `, ${pct(m.pct * m.weight, 1)} of your book`
      : '';
    return {
      title: clip(`${m.ticker} ${pct(m.pct)} today`, TITLE_MAX),
      body: clip(`${money(m.dollars)} ${m.dollars >= 0 ? 'on' : 'off'} your position${share}.`, BODY_MAX),
      route: 'book',
      id: m.ticker,
    };
  }
  const parts = moves.map((m) => `${m.ticker} ${pct(m.pct)} ${money(m.dollars)}`);
  return {
    title: clip(`${moves.length} of your names moved`, TITLE_MAX),
    body: clip(parts.join(', ') + '.', BODY_MAX),
    route: 'book',
  };
}

export function reasonBroke(b: { ticker: string; claim: string; sourceTitle: string; thesisId?: string }): PushMessage {
  return {
    title: clip(`${b.ticker}: a reason stopped holding`, TITLE_MAX),
    body: clip(`${b.sourceTitle} contradicts "${b.claim}". The quote is inside.`, BODY_MAX),
    route: 'thesis',
    id: b.thesisId,
  };
}

export function investigated(i: { ticker: string; pct: number; contradicts: boolean; thesisId?: string }): PushMessage {
  const dir = i.pct >= 0 ? 'rose' : 'fell';
  return {
    title: clip(`${i.ticker} ${dir} ${(Math.abs(i.pct) * 100).toFixed(1)}% today`, TITLE_MAX),
    body: clip(i.contradicts
      ? 'I read it against your pillars. One reason is under pressure. Memo inside.'
      : 'I read it against your pillars. Nothing contradicts a reason yet. Memo inside.', BODY_MAX),
    route: 'thesis',
    id: i.thesisId,
  };
}

export function filingFinding(f: { ticker: string; form: string; verdict: 'supports' | 'contradicts' | 'mixed'; thesisId?: string }): PushMessage {
  const what = f.verdict === 'contradicts' ? 'contradicts a reason you hold it' : f.verdict === 'supports' ? 'supports a reason you hold it' : 'bears on a reason you hold it';
  return {
    title: clip(`${f.ticker} ${f.form} read`, TITLE_MAX),
    body: clip(`It ${what}. The quote is inside.`, BODY_MAX),
    route: 'thesis',
    id: f.thesisId,
  };
}
