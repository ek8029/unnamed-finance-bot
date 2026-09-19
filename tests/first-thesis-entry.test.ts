import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import AnalyzePage from '@/app/dashboard/analyze/[ticker]/page';
import BuilderPage from '@/app/dashboard/theses/builder/page';
import { ClassicThesesPage } from '@/components/thesis/classic-theses-page';
import { freeThesisEntryHref, thesisEntryTicker } from '@/lib/thesis-entry';
import { RatifyQueue } from '@/components/thesis/ratify-queue';
import { WhyIOwnThis } from '@/components/thesis/why-i-own-this';
import AdoptThesisPage from '@/app/dashboard/theses/adopt/page';
import { OnboardingFlowV2 } from '@/components/onboarding/onboarding-flow-v2';
import { __resetApiCache } from '@/lib/api-cache';

const h = vi.hoisted(() => ({
  tier: 'free', resolved: true, query: '', path: '/dashboard/theses/classic',
  theses: [] as any[], held: false, countError: false, realCache: false,
  slots: [] as any[], cursor: 0,
  effects: [] as { index: number; effect: () => void | (() => void) }[],
  cleanups: new Map<number, () => void>(), fetch: vi.fn(), capture: vi.fn(),
}));
vi.mock('react', async (original) => {
  const actual = await original<typeof import('react')>();
  const same = (a?: unknown[], b?: unknown[]) => !!a && !!b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = h.cursor++;
      if (!(index in h.slots)) h.slots[index] = typeof initial === 'function' ? initial() : initial;
      return [h.slots[index], (value: unknown) => { h.slots[index] = typeof value === 'function' ? value(h.slots[index]) : value; }];
    },
    useRef: (initial: unknown) => {
      const index = h.cursor++;
      if (!(index in h.slots)) h.slots[index] = { current: initial };
      return h.slots[index];
    },
    useCallback: (callback: unknown, deps: unknown[]) => {
      const index = h.cursor++;
      if (!same(h.slots[index]?.deps, deps)) h.slots[index] = { deps, callback };
      return h.slots[index].callback;
    },
    useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
      const index = h.cursor++;
      if (!same(h.slots[index], deps)) {
        h.slots[index] = deps;
        h.effects.push({ index, effect });
      }
    },
  };
});
vi.mock('next/link', () => ({ default: 'a' }));
vi.mock('next/navigation', () => ({ usePathname: () => h.path, useSearchParams: () => new URLSearchParams(h.query), useRouter: () => ({ push: vi.fn() }), notFound: vi.fn() }));
vi.mock('posthog-js', () => ({ default: { capture: h.capture } }));
vi.mock('@/lib/supabase/client', () => ({ supabase: { auth: { getUser: async () => ({ data: { user: { email: 'owner@example.test' } } }) } } }));
vi.mock('@/lib/preview-context', () => ({ usePreview: () => ({ tier: h.tier, resolved: h.resolved }) }));
vi.mock('@/lib/tier', () => ({ getUserTier: async () => h.tier, tierAtLeast: (tier: string) => tier === 'pro' }));
vi.mock('@/lib/analyze-stock', () => ({ analyzeStock: async () => ({ analysis: {}, computedAt: '2026-09-12T12:00:00Z' }) }));
vi.mock('@/lib/financial-data', () => ({ getFullTickerData: async () => ({}) }));
vi.mock('@/app/analyze/[ticker]/analysis-terminal', () => ({ AnalysisTerminal: () => null }));
vi.mock('@/lib/api-cache', async (original) => {
  const actual = await original<typeof import('@/lib/api-cache')>();
  return {
    ...actual,
    cachedGet: async (url: string) => h.realCache ? actual.cachedGet(url) : url === '/api/thesis' ? { ok: true, status: 200, data: { theses: h.theses } } : { ok: false, status: 404 },
  };
});

// Read-only schema double: UNIQUE(user_id,ticker), row ownership and exact
// counts are enforced. There are deliberately no insert/update/delete methods.
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'owner', email: 'owner@example.test' } } }) },
    from: (table: string) => {
      const filters = new Map<string, unknown>();
      let count = false;
      const result = () => {
        if (table === 'thesis_pillars') return { data: [], error: null };
        if (table === 'holdings') return { data: h.held ? [{ id: 'held', user_id: 'owner', ticker: 'AAPL' }] : [], error: null };
        if (table !== 'theses') throw new Error(`Unexpected table: ${table}`);
        const keys = h.theses.map((row) => `${row.user_id}:${row.ticker}`);
        if (new Set(keys).size !== keys.length) throw new Error('UNIQUE(user_id,ticker)');
        if (filters.get('user_id') !== 'owner') throw new Error('Unscoped thesis query');
        const rows = h.theses.filter((row) => [...filters].every(([key, value]) => row[key] === value));
        return { data: count ? null : rows, count: count ? rows.length : null, error: count && h.countError ? { message: 'unavailable' } : null };
      };
      const query = {
        select: (_columns: string, options?: { count?: string }) => { count = options?.count === 'exact'; return query; },
        eq: (key: string, value: unknown) => { filters.set(key, value); return query; },
        limit: () => query,
        maybeSingle: async () => { const value = result(); return { ...value, data: value.data?.[0] ?? null }; },
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
      };
      return query;
    },
  }),
}));

type Element = React.ReactElement<Record<string, any>>;
// Expand the actual entry components and TierLock. Unrelated chart/detail
// children remain React elements, so their external effects are not exercised.
const actualComponents = new Set(['ThesisBridge', 'BuilderPage', 'BuilderInner', 'FreeThesisEntry', 'TierLock', 'ClassicThesesPage', 'ClassicThesesInner', 'RatifySubject', 'WhySubject', 'AdoptThesisPage', 'ThesisErrorNotice', 'OnboardingSubject']);
function nodes(node: React.ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!React.isValidElement<Record<string, any>>(node)) return [];
  if (typeof node.type === 'function' && (actualComponents.has(node.type.name) || (h.realCache && node.type.name === 'RatifyQueue'))) {
    return nodes((node.type as (props: any) => React.ReactNode)(node.props));
  }
  return [node, ...nodes(node.props.children)];
}
function render(component: () => React.ReactNode) {
  h.cursor = 0;
  const tree = nodes(React.createElement(component));
  for (const { index, effect } of h.effects.splice(0)) {
    h.cleanups.get(index)?.();
    const cleanup = effect();
    if (cleanup) h.cleanups.set(index, cleanup);
  }
  return tree;
}
async function settle(component: () => React.ReactNode) {
  let tree = render(component);
  for (let i = 0; i < 12; i++) { await Promise.resolve(); tree = render(component); }
  return tree;
}
function seedCalls() { return h.fetch.mock.calls.filter(([url]) => url === '/api/thesis/seed'); }
function draftRow(ticker = 'AAPL', userId = 'owner') {
  return {
    id: `thesis-${ticker}`, user_id: userId, ticker, tracked: false, notes: null, last_scanned_at: null,
    pillars: [{ id: `pillar-${ticker}`, thesis_id: `thesis-${ticker}`, claim: 'My saved, edited reason', confirmed: false, origin: 'ai_draft', status: 'unverified', status_override: null, status_changed_at: null, lifecycle: 'proposed', sort_order: 0, latest_evidence: null }],
  };
}

beforeEach(() => {
  h.realCache = false; __resetApiCache();
  h.tier = 'free'; h.resolved = true; h.query = ''; h.theses = []; h.held = false; h.countError = false;
  h.slots = []; h.cursor = 0; h.effects = []; h.cleanups.clear(); h.capture.mockReset();
  h.fetch.mockReset().mockImplementation(async (url: string) => {
    if (url === '/api/holdings') return new Response(JSON.stringify({ holdings: [] }));
    if (url === '/api/thesis/seed') return new Response(JSON.stringify({ thesis: draftRow(), pillars: draftRow().pillars }));
    if (url.startsWith('/api/prebuy-risk')) return new Response('{}', { status: 403 });
    if (url === '/api/thesis/backfill') return new Response(JSON.stringify({ ok: true, evidenceAdded: 0 }));
    if (url.startsWith('/api/thesis/pillars/')) return new Response(JSON.stringify({ pillar: {} }));
    if (url === '/api/thesis/AAPL') return new Response(JSON.stringify({ thesis: { ...draftRow(), tracked: true } }));
    throw new Error(`Unexpected network request: ${url}`);
  });
  vi.stubGlobal('React', React);
  vi.stubGlobal('fetch', h.fetch);
  vi.stubGlobal('window', { location: { search: '' } });
});
afterEach(() => {
  for (const cleanup of h.cleanups.values()) cleanup();
  vi.unstubAllGlobals();
});

describe('actual research page thesis destinations', () => {
  async function bridgeHref() {
    const tree = nodes(await AnalyzePage({ params: Promise.resolve({ ticker: 'aapl' }) }));
    return tree.find((node) => node.type === 'a')?.props.href;
  }
  it.each([false, true])('routes the first Free thesis to visible drafting (held=%s)', async (held) => {
    h.held = held;
    expect(await bridgeHref()).toBe('/dashboard/theses/classic?ticker=AAPL');
  });
  it('routes an existing Free draft to its confirmation workspace', async () => {
    h.theses = [draftRow()];
    expect(await bridgeHref()).toBe('/dashboard/theses/classic?ticker=AAPL');
  });
  it('keeps Pro research in the premium Builder', async () => {
    h.tier = 'pro';
    expect(await bridgeHref()).toBe('/dashboard/theses/builder?ticker=AAPL');
  });
  it('keeps a second new Free thesis behind Pro instead of implying another Free slot', async () => {
    h.theses = [draftRow('MSFT')];
    expect(await bridgeHref()).toBe('/dashboard/theses/builder?ticker=AAPL');
  });
  it('does not count another owner’s thesis against this account', async () => {
    h.theses = [draftRow('MSFT', 'another-owner')];
    expect(await bridgeHref()).toBe('/dashboard/theses/classic?ticker=AAPL');
  });
  it('keeps an already tracked thesis on its existing detail route', async () => {
    h.theses = [{ ...draftRow(), tracked: true }];
    expect(await bridgeHref()).toBe('/dashboard/theses/thesis-AAPL');
  });
  it('does not promise a Free slot when the count lookup fails', async () => {
    h.countError = true;
    expect(await bridgeHref()).toBeUndefined();
  });
});

describe('real Builder mount and hidden effects', () => {
  it.each([['free', true], ['free', false], ['pro', false]] as const)('never seeds or runs premium risk while tier=%s/resolved=%s', async (tier, resolved) => {
    h.tier = tier; h.resolved = resolved; h.query = 'ticker=AAPL';
    await settle(BuilderPage);
    expect(h.fetch).not.toHaveBeenCalled();
  });
  it('keeps a visible Free continuation link carrying the requested ticker', async () => {
    h.query = 'ticker=AAPL';
    const tree = await settle(BuilderPage);
    expect(tree.find((node) => node.props.href === '/dashboard/theses/classic?ticker=AAPL')).toBeDefined();
  });
  it('waits for Pro resolution, then performs the existing automatic draft once', async () => {
    h.tier = 'pro'; h.resolved = false; h.query = 'ticker=AAPL';
    await settle(BuilderPage);
    expect(seedCalls()).toHaveLength(0);
    h.resolved = true;
    await settle(BuilderPage);
    expect(seedCalls()).toHaveLength(1);
    expect(JSON.parse(seedCalls()[0][1].body)).toEqual({ ticker: 'AAPL' });
  });
});

describe('real Free thesis creation and saved-draft continuation', () => {
  it('prefills a valid ticker without writing, then drafts only on explicit submit', async () => {
    h.query = 'ticker=aapl';
    let tree = await settle(ClassicThesesPage);
    expect(tree.find((node) => node.type === 'input' && node.props.value === 'AAPL')).toBeDefined();
    expect(seedCalls()).toHaveLength(0);
    tree.find((node) => node.type === 'form')!.props.onSubmit({ preventDefault() {} });
    tree = await settle(ClassicThesesPage);
    expect(seedCalls()).toHaveLength(1);
    expect(JSON.parse(seedCalls()[0][1].body)).toEqual({ ticker: 'AAPL' });
    expect(tree.some((node) => node.props.value === 'My saved, edited reason')).toBe(true);
  });
  it('loads saved draft claims into editable confirmation without re-seeding', async () => {
    h.theses = [draftRow()]; h.query = 'ticker=AAPL';
    const tree = await settle(ClassicThesesPage);
    expect(tree.some((node) => node.props.value === 'My saved, edited reason')).toBe(true);
    expect(seedCalls()).toHaveLength(0);
    expect(tree.some((node) => node.type === 'button' && typeof node.props.onClick === 'function')).toBe(true);
  });
  it('does not replace a saved edit when the list rerenders', async () => {
    h.theses = [draftRow()]; h.query = 'ticker=AAPL';
    let tree = await settle(ClassicThesesPage);
    const field = tree.find((node) => node.props.value === 'My saved, edited reason')!;
    field.props.onChange({ target: { value: 'My new local edit' } });
    tree = await settle(ClassicThesesPage);
    expect(tree.some((node) => node.props.value === 'My new local edit')).toBe(true);
    expect(seedCalls()).toHaveLength(0);
  });
  it('can reopen the same saved draft after the query ticker is removed and restored', async () => {
    h.theses = [draftRow()]; h.query = 'ticker=AAPL';
    let tree = await settle(ClassicThesesPage);
    tree.find((node) => node.props.value === 'My saved, edited reason')!.props.onChange({ target: { value: 'Temporary edit' } });
    h.query = '';
    await settle(ClassicThesesPage);
    h.query = 'ticker=AAPL';
    tree = await settle(ClassicThesesPage);
    expect(tree.some((node) => node.props.value === 'My saved, edited reason')).toBe(true);
    expect(seedCalls()).toHaveLength(0);
  });
  it('opens the existing detail for a confirmed but untracked thesis without re-seeding', async () => {
    const saved = draftRow(); saved.pillars[0].confirmed = true;
    h.theses = [saved]; h.query = 'ticker=AAPL';
    const tree = await settle(ClassicThesesPage);
    expect(tree.some((node) => typeof node.type === 'function' && node.type.name === 'WhyIOwnThis' && node.props.ticker === 'AAPL')).toBe(true);
    expect(seedCalls()).toHaveLength(0);
  });
  it('stops before tracking when a reason could not be saved', async () => {
    h.theses = [draftRow()]; h.query = 'ticker=AAPL';
    const tree = await settle(ClassicThesesPage);
    h.fetch.mockImplementation(async () => new Response(JSON.stringify({ error: 'Could not save reason' }), { status: 500 }));
    await tree.find((node) => node.props.children === 'Track this thesis')!.props.onClick();
    const after = await settle(ClassicThesesPage);
    expect(after.some((node) => node.props.role === 'alert' && node.props.children === 'Could not save reason')).toBe(true);
    expect(h.fetch.mock.calls.some(([url]) => url === '/api/thesis/AAPL' || url === '/api/thesis/backfill')).toBe(false);
  });
  it('returns a tracking cap error to editable confirmation and never backfills', async () => {
    h.theses = [draftRow()]; h.query = 'ticker=AAPL';
    const tree = await settle(ClassicThesesPage);
    h.fetch.mockImplementation(async (url: string) => url === '/api/thesis/AAPL'
      ? new Response(JSON.stringify({ error: 'Free accounts watch 1 thesis.', code: 'PRO_REQUIRED' }), { status: 403 })
      : new Response('{}'));
    const button = tree.find((node) => node.props.children === 'Track this thesis')!;
    const first = button.props.onClick();
    button.props.onClick(); // A second click before React disables the control.
    await first;
    const after = await settle(ClassicThesesPage);
    expect(after.some((node) => node.props.role === 'alert' && node.props.children === 'Free accounts watch 1 thesis.')).toBe(true);
    expect(after.some((node) => node.props.value === 'My saved, edited reason')).toBe(true);
    expect(h.fetch.mock.calls.filter(([url]) => url === '/api/thesis/AAPL')).toHaveLength(1);
    expect(h.fetch.mock.calls.some(([url]) => url === '/api/thesis/backfill')).toBe(false);
  });
  it('keeps editing and retry locked after one save fails until its sibling settles', async () => {
    const saved = draftRow();
    saved.pillars.push({ ...saved.pillars[0], id: 'slow-sibling', claim: 'Another reason' });
    h.theses = [saved]; h.query = 'ticker=AAPL';
    let tree = await settle(ClassicThesesPage);
    let finishSibling!: (response: Response) => void;
    const sibling = new Promise<Response>((resolve) => { finishSibling = resolve; });
    h.fetch.mockImplementation(async (url: string) => url.endsWith('slow-sibling')
      ? sibling : new Response(JSON.stringify({ error: 'First save failed' }), { status: 500 }));
    const original = tree.find((node) => node.props.children === 'Track this thesis')!;
    const pending = original.props.onClick();
    tree = await settle(ClassicThesesPage);
    expect(tree.find((node) => node.props.children === 'Saving your reasons…')?.props.disabled).toBe(true);
    expect(tree.filter((node) => node.type === 'textarea').every((node) => node.props.disabled)).toBe(true);
    original.props.onClick();
    expect(h.fetch.mock.calls.filter(([url]) => url.startsWith('/api/thesis/pillars/'))).toHaveLength(2);
    finishSibling(new Response('{}'));
    await pending;
    tree = await settle(ClassicThesesPage);
    expect(tree.find((node) => node.props.children === 'Track this thesis')?.props.disabled).toBe(false);
    expect(tree.some((node) => node.props.role === 'alert' && node.props.children === 'First save failed')).toBe(true);
    expect(h.fetch.mock.calls.some(([url]) => url === '/api/thesis/AAPL')).toBe(false);
  });
  it('keeps successful tracking distinct from missing history and retries only the history read', async () => {
    h.theses = [draftRow()]; h.query = 'ticker=AAPL';
    let tree = await settle(ClassicThesesPage);
    h.fetch.mockImplementation(async (url: string) => url === '/api/thesis/backfill'
      ? new Response('{}', { status: 503 }) : new Response('{}'));
    await tree.find((node) => node.props.children === 'Track this thesis')!.props.onClick();
    tree = await settle(ClassicThesesPage);
    expect(tree.some((node) => node.props.children === 'Your thesis is tracked. Its history is not ready yet.')).toBe(true);
    const writes = h.fetch.mock.calls.filter(([url]) => url !== '/api/thesis/backfill').length;
    h.fetch.mockImplementation(async () => new Response(JSON.stringify({ ok: true, evidenceAdded: 2 })));
    await tree.find((node) => node.props.children === 'Retry history')!.props.onClick();
    await settle(ClassicThesesPage);
    expect(h.fetch.mock.calls.filter(([url]) => url !== '/api/thesis/backfill')).toHaveLength(writes);
    expect(h.fetch.mock.calls.filter(([url]) => url === '/api/thesis/backfill')).toHaveLength(2);
  });
  it('does not repeat a successfully removed reason after another step failed', async () => {
    const saved = draftRow();
    saved.pillars.push({ ...saved.pillars[0], id: 'remove-me', claim: 'Discard this claim' });
    h.theses = [saved]; h.query = 'ticker=AAPL';
    let tree = await settle(ClassicThesesPage);
    tree.filter((node) => node.props.children === 'Remove')[1].props.onClick();
    tree = await settle(ClassicThesesPage);
    h.fetch.mockImplementation(async (url: string) => url === '/api/thesis/AAPL'
      ? new Response('{}', { status: 500 }) : new Response('{}'));
    await tree.find((node) => node.props.children === 'Track this thesis')!.props.onClick();
    tree = await settle(ClassicThesesPage);
    expect(tree.some((node) => node.props.value === 'Discard this claim')).toBe(false);
    h.fetch.mockImplementation(async () => new Response(JSON.stringify({ ok: true, evidenceAdded: 0 })));
    await tree.find((node) => node.props.children === 'Track this thesis')!.props.onClick();
    expect(h.fetch.mock.calls.filter(([, options]) => options?.method === 'DELETE')).toHaveLength(1);
  });
  it('ignores invalid URL input without seeding or putting it into the form', async () => {
    h.query = 'ticker=https://elsewhere.test';
    const tree = await settle(ClassicThesesPage);
    expect(tree.find((node) => node.type === 'input')?.props.value).toBe('');
    expect(seedCalls()).toHaveLength(0);
  });
});

describe('local thesis entry URLs', () => {
  it('uses the thesis grammar and keeps a share-class ticker intact', () => {
    expect(thesisEntryTicker(' brk.b ')).toBe('BRK.B');
    expect(freeThesisEntryHref('brk.b')).toBe('/dashboard/theses/classic?ticker=BRK.B');
  });
  it.each(['//elsewhere.test', 'AAPL&upgrade=pro', 'ABCDEFGHIJK', '', null])('rejects malformed ticker %s', (ticker) => {
    expect(thesisEntryTicker(ticker)).toBeNull();
    expect(freeThesisEntryHref(ticker)).toBe('/dashboard/theses/classic');
  });
});

describe('actual thesis cap and failure handling', () => {
  const cap = { error: 'Free accounts can hold 1 thesis. Pro tracks every position you own.', code: 'PRO_REQUIRED' };
  const changed = vi.fn();
  const draft = { thesisId: 'draft', ticker: 'AAPL', draftPillarIds: ['p1'], topClaim: 'My reason', moreCount: 0 };
  function RatifySubject() { return RatifyQueue({ items: [draft], unthesed: [{ ticker: 'AAPL', name: 'Apple' }, { ticker: 'MSFT', name: 'Microsoft' }], confirmedCount: 0, onChanged: changed, onEdit: vi.fn() }); }
  function WhySubject() { return WhyIOwnThis({ ticker: 'AAPL' }); }
  function errorIsVisible(tree: Element[], message: string) { expect(tree.some(node => node.props.role === 'alert' && node.props.children === message)).toBe(true); }
  function upgradeIsVisible(tree: Element[]) { expect(tree.some(node => node.props.href === '/pricing' && node.props.children === 'View Pro')).toBe(true); }

  it.each([
    [403, cap], [403, { error: 'Personal AI permission is required.', code: 'AI_CONSENT_REQUIRED' }],
    [401, { error: 'Unauthorized' }], [429, { error: 'Too many requests. Please try again later.' }], [500, { error: 'Drafting is temporarily unavailable.' }],
  ] as const)('keeps the ticker and truthful failure after a Classic seed response %s/%s', async (status, body) => {
    h.query = 'ticker=AAPL'; h.theses = [draftRow('MSFT')];
    let tree = await settle(ClassicThesesPage);
    h.fetch.mockResolvedValue(new Response(JSON.stringify(body), { status }));
    tree.find(node => node.type === 'form')!.props.onSubmit({ preventDefault() {} });
    tree = await settle(ClassicThesesPage);
    expect(seedCalls()).toHaveLength(1);
    expect(tree.some(node => node.type === 'input' && node.props.value === 'AAPL')).toBe(true);
    errorIsVisible(tree, body.error);
    expect(tree.some(node => node.props.href === '/pricing' && node.props.children === 'View Pro')).toBe('code' in body && body.code === 'PRO_REQUIRED');
    expect(tree.some(node => node.props.children === 'Track this thesis')).toBe(false);
  });
  it('does not blame the ticker for a network failure', async () => {
    h.query = 'ticker=AAPL';
    let tree = await settle(ClassicThesesPage);
    h.fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    tree.find(node => node.type === 'form')!.props.onSubmit({ preventDefault() {} });
    tree = await settle(ClassicThesesPage);
    expect(tree.some(node => node.props.role === 'alert')).toBe(true);
    expect(JSON.stringify(tree)).not.toContain('Check the symbol');
    expect(tree.some(node => node.type === 'input' && node.props.value === 'AAPL')).toBe(true);
  });
  it('shows a cap from the real Pro Builder seed branch without loading risk', async () => {
    h.tier = 'pro'; h.query = 'ticker=AAPL';
    h.fetch.mockResolvedValue(new Response(JSON.stringify(cap), { status: 403 }));
    const tree = await settle(BuilderPage);
    expect(seedCalls()).toHaveLength(1);
    errorIsVisible(tree, cap.error); upgradeIsVisible(tree);
    expect(h.fetch).toHaveBeenCalledTimes(1);
  });
  it('stops batch drafting on the cap and never reports it as success', async () => {
    changed.mockReset();
    h.fetch.mockResolvedValue(new Response(JSON.stringify(cap), { status: 403 }));
    let tree = await settle(RatifySubject);
    await tree.find(node => node.props.children === 'Draft 2 more from holdings')!.props.onClick();
    tree = await settle(RatifySubject);
    errorIsVisible(tree, cap.error); upgradeIsVisible(tree);
    expect(seedCalls()).toHaveLength(1);
    expect(changed).not.toHaveBeenCalled();
  });
  it('does not track or claim confirmation after a failed ratification write', async () => {
    changed.mockReset();
    h.fetch.mockResolvedValue(new Response(JSON.stringify({ error: 'Could not save reason' }), { status: 500 }));
    let tree = await settle(RatifySubject);
    await tree.find(node => node.props.children === 'Looks right')!.props.onClick();
    tree = await settle(RatifySubject);
    expect(h.fetch).toHaveBeenCalledTimes(1);
    errorIsVisible(tree, 'Could not save reason');
    expect(changed).not.toHaveBeenCalled();
  });
  it('surfaces the cap in the actual holding thesis composer', async () => {
    h.fetch.mockImplementation(async (url: string) => url === '/api/thesis/AAPL' ? new Response('{}', { status: 404 }) : new Response(JSON.stringify(cap), { status: 403 }));
    let tree = await settle(WhySubject);
    await tree.find(node => node.props.children === 'Draft my thesis')!.props.onClick();
    tree = await settle(WhySubject);
    errorIsVisible(tree, cap.error); upgradeIsVisible(tree);
    expect(seedCalls()).toHaveLength(1);
  });
  it('retains a custom reason when its prerequisite draft hits the cap', async () => {
    h.fetch.mockImplementation(async (url: string) => url === '/api/thesis/AAPL' ? new Response('{}', { status: 404 }) : new Response(JSON.stringify(cap), { status: 403 }));
    let tree = await settle(WhySubject);
    tree.find(node => node.props.children === '+ Add a pillar')!.props.onClick();
    tree = await settle(WhySubject);
    tree.find(node => node.props.placeholder === 'Write a reason you own AAPL, in one sentence')!.props.onChange('My own reason');
    tree.find(node => node.type === 'textarea')!.props.onChange({ target: { value: 'Revenue falls for two consecutive quarters' } });
    tree = await settle(WhySubject);
    await tree.find(node => node.props.children === 'Add pillar')!.props.onClick();
    tree = await settle(WhySubject);
    errorIsVisible(tree, cap.error); upgradeIsVisible(tree);
    expect(tree.some(node => node.props.value === 'My own reason')).toBe(true);
    expect(seedCalls()).toHaveLength(1);
    expect(h.fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  });
  it('adds a Pro action to adoption limits without marking a house thesis followed', async () => {
    h.fetch.mockImplementation(async (url: string) => url === '/api/dashboard/holdings-tickers' ? new Response('{"tickers":[]}') : new Response(JSON.stringify(cap), { status: 403 }));
    let tree = await settle(AdoptThesisPage);
    await tree.find(node => node.props.children === 'Follow')!.props.onClick();
    tree = await settle(AdoptThesisPage);
    errorIsVisible(tree, cap.error); upgradeIsVisible(tree);
    expect(tree.some(node => node.props.children === '✓ Following')).toBe(false);
  });
  it('keeps V2 failed batch drafts visible with a Pro action instead of completing onboarding', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('localStorage', { getItem: () => null });
    vi.stubGlobal('sessionStorage', { getItem: () => null });
    h.fetch.mockImplementation(async (url: string) => {
      if (url === '/api/onboarding/status') return new Response('{"hasSavedWork":false}');
      if (url === '/api/financial-summary') return new Response(JSON.stringify({ accounts: [], holdings: [{ ticker: 'AAPL', total_value: 100 }, { ticker: 'MSFT', total_value: 90 }] }));
      if (url === '/api/thesis/seed') return new Response(JSON.stringify(cap), { status: 403 });
      throw new Error(`Unexpected request: ${url}`);
    });
    function OnboardingSubject() { return OnboardingFlowV2({ jumpTo: 'synced' }); }
    try {
      for (let i = 0; i < 6; i++) await settle(OnboardingSubject);
      await vi.advanceTimersByTimeAsync(1000);
      const tree = await settle(OnboardingSubject);
      expect(seedCalls()).toHaveLength(1);
      errorIsVisible(tree, cap.error); upgradeIsVisible(tree);
      expect(tree.some(node => node.props.children === 'No theses drafted yet.')).toBe(true);
      const confirmAll = tree.find(node => node.props.onClick?.name === 'confirmAll')!;
      expect(confirmAll.props.disabled).toBe(true);
      expect(h.capture.mock.calls.some(([event]) => event === 'onb_thesis_confirmed')).toBe(false);
    } finally { vi.useRealTimers(); }
  });
  it('preserves a scanned V2 ticker when its direct draft hits the cap', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('localStorage', { getItem: () => null });
    vi.stubGlobal('sessionStorage', { getItem: () => null });
    h.fetch.mockImplementation(async (url: string) => {
      if (url === '/api/onboarding/status') return new Response('{"hasSavedWork":false}');
      if (url.startsWith('/api/scan/ticker')) return new Response(JSON.stringify({ ticker: 'AAPL', house: false, kind: 'filer' }));
      if (url === '/api/thesis/seed') return new Response(JSON.stringify(cap), { status: 403 });
      throw new Error(`Unexpected request: ${url}`);
    });
    function OnboardingSubject() { return OnboardingFlowV2({ jumpTo: 'input' }); }
    try {
      let tree = await settle(OnboardingSubject);
      tree.find(node => node.type === 'input')!.props.onChange({ target: { value: 'AAPL' } });
      tree = await settle(OnboardingSubject);
      tree.find(node => node.type === 'form')!.props.onSubmit({ preventDefault() {} });
      for (let i = 0; i < 4; i++) await settle(OnboardingSubject);
      await vi.advanceTimersByTimeAsync(2500);
      tree = await settle(OnboardingSubject);
      errorIsVisible(tree, cap.error); upgradeIsVisible(tree);
      expect(seedCalls()).toHaveLength(1);
      expect(JSON.parse(seedCalls()[0][1].body)).toEqual({ ticker: 'AAPL' });
      expect(tree.some(node => node.props.children === 'AAPL')).toBe(true);
      expect(h.capture.mock.calls.some(([event]) => event === 'onb_draft_shown' || event === 'onb_reasons_saved')).toBe(false);
    } finally { vi.useRealTimers(); }
  });
  it('does not exit V2 confirmation or label a thesis Watching after a tracking cap', async () => {
    const dismiss = vi.fn();
    vi.useFakeTimers();
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: dismiss });
    vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: dismiss });
    h.fetch.mockImplementation(async (url: string) => {
      if (url === '/api/onboarding/status') return new Response('{"hasSavedWork":false}');
      if (url === '/api/financial-summary') return new Response(JSON.stringify({ accounts: [], holdings: [{ ticker: 'AAPL', total_value: 100 }] }));
      if (url === '/api/thesis/seed') return new Response(JSON.stringify({ thesis: draftRow(), pillars: draftRow().pillars }));
      if (url.startsWith('/api/thesis/pillars/')) return new Response('{}');
      if (url === '/api/thesis/AAPL') return new Response(JSON.stringify(cap), { status: 403 });
      throw new Error(`Unexpected request: ${url}`);
    });
    function OnboardingSubject() { return OnboardingFlowV2({ jumpTo: 'synced' }); }
    try {
      let tree = await settle(OnboardingSubject);
      for (let i = 0; i < 4; i++) tree = await settle(OnboardingSubject);
      await tree.find(node => node.props.onClick?.name === 'confirmAll')!.props.onClick();
      tree = await settle(OnboardingSubject);
      errorIsVisible(tree, cap.error); upgradeIsVisible(tree);
      expect(dismiss).not.toHaveBeenCalled();
      expect(tree.some(node => node.props.children === 'Watching')).toBe(false);
      expect(h.capture.mock.calls.some(([event]) => event === 'onb_thesis_confirmed')).toBe(false);
    } finally { vi.useRealTimers(); }
  });
  it('reloads saved V2 reasons as untracked and retries only tracking', async () => {
    const dismiss = vi.fn();
    const saved = draftRow(); saved.pillars[0].confirmed = true;
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: dismiss });
    vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: dismiss });
    let trackingAllowed = false;
    h.fetch.mockImplementation(async (url: string) => {
      if (url === '/api/onboarding/status') return new Response('{"hasSavedWork":false}');
      if (url === '/api/financial-summary') return new Response(JSON.stringify({ accounts: [], holdings: [{ ticker: 'AAPL', total_value: 100 }] }));
      // Seed's existing-thesis branch returns saved reasons without auto-tracking.
      if (url === '/api/thesis/seed') return new Response(JSON.stringify({ thesis: saved, pillars: saved.pillars }));
      if (url === '/api/thesis/AAPL') return trackingAllowed ? new Response('{}') : new Response(JSON.stringify(cap), { status: 403 });
      throw new Error(`Unexpected request: ${url}`);
    });
    function OnboardingSubject() { return OnboardingFlowV2({ jumpTo: 'synced' }); }
    let tree = await settle(OnboardingSubject);
    for (let i = 0; i < 4; i++) tree = await settle(OnboardingSubject);
    expect(seedCalls()).toHaveLength(1);
    expect(tree.some(node => node.props.children === 'Watching')).toBe(false);
    expect(tree.some(node => node.props.children === 'Saved · not watching')).toBe(true);
    await tree.find(node => node.props.onClick?.name === 'confirmAll')!.props.onClick();
    tree = await settle(OnboardingSubject);
    errorIsVisible(tree, cap.error);
    expect(dismiss).not.toHaveBeenCalled();
    trackingAllowed = true;
    await tree.find(node => node.props.children === 'Track')!.props.onClick();
    tree = await settle(OnboardingSubject);
    expect(tree.some(node => node.props.children === 'Watching')).toBe(true);
    expect(h.fetch.mock.calls.filter(([url]) => url === '/api/thesis/AAPL')).toHaveLength(2);
    expect(h.fetch.mock.calls.some(([url]) => url.startsWith('/api/thesis/pillars/'))).toBe(false);
  });
  it.each([false, true])('refreshes the actual Classic parent after Ratify drafting and confirmation (partial=%s)', async (partial) => {
    h.realCache = true;
    const existing = draftRow('GOOG'); existing.pillars[0].confirmed = true; existing.tracked = true;
    const persisted = [existing];
    h.fetch.mockImplementation(async (url: string, options?: RequestInit) => {
      if (url === '/api/thesis') return new Response(JSON.stringify({ theses: persisted }));
      if (url === '/api/holdings') return new Response(JSON.stringify({ holdings: ['GOOG', 'AAPL', 'MSFT'].map(ticker => ({ ticker, total_value: 100 })) }));
      if (url === '/api/thesis/seed') {
        const { ticker } = JSON.parse(String(options?.body));
        if (partial && ticker === 'MSFT') return new Response(JSON.stringify(cap), { status: 403 });
        const row = draftRow(ticker); persisted.push(row);
        return new Response(JSON.stringify({ thesis: row, pillars: row.pillars }));
      }
      if (url === '/api/thesis/pillars/pillar-AAPL' && options?.method === 'PATCH') {
        persisted.find(row => row.ticker === 'AAPL')!.pillars[0].confirmed = true;
        return new Response('{}');
      }
      if (url === '/api/thesis/AAPL' && options?.method === 'PATCH') {
        persisted.find(row => row.ticker === 'AAPL')!.tracked = true;
        return new Response('{}');
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    let tree = await settle(ClassicThesesPage);
    expect(h.fetch.mock.calls.filter(([url]) => url === '/api/thesis')).toHaveLength(1);
    await tree.find(node => node.props.children === 'Draft 2 more from holdings')!.props.onClick();
    tree = await settle(ClassicThesesPage);
    expect(h.fetch.mock.calls.filter(([url]) => url === '/api/thesis')).toHaveLength(2);
    expect(tree.filter(node => node.props.children === 'Looks right')).toHaveLength(partial ? 1 : 2);
    if (partial) { errorIsVisible(tree, cap.error); upgradeIsVisible(tree); }
    await tree.find(node => node.props.children === 'Looks right')!.props.onClick();
    tree = await settle(ClassicThesesPage);
    expect(h.fetch.mock.calls.filter(([url]) => url === '/api/thesis')).toHaveLength(3);
    expect(persisted.find(row => row.ticker === 'AAPL')!.tracked).toBe(true);
    expect(tree.filter(node => node.props.children === 'Looks right')).toHaveLength(partial ? 0 : 1);
  });
});
