# Onboarding v3 (book first) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the three-screen book-first onboarding from `docs/superpowers/specs/2026-09-08-onboarding-book-first-design.md` behind `NEXT_PUBLIC_ONBOARDING_V3`, with the first-look question, the Portfolio empty-state ask, sidebar dimming, the standing inbox item and the brief lead.

**Architecture:** Every decision that can be a pure function lives in `lib/onboarding/*` with a Vitest test (exit routing, exposure sentence, first-look parsing and card order, copy). The UI is one new overlay `components/onboarding/v3/*` mounted from `dashboard-shell.tsx` when the v3 flag is set, reusing `PlaidLinkButton`, `ManualPortfolioForm`, `computePortfolioLookthrough`, `/api/financial-summary`, `/api/scan/ticker` and `/api/market/quotes`. No new tables; one nullable column on `user_preferences`.

**Tech Stack:** Next.js 16 App Router, React 19 client components, Tailwind v4 with the `helm-*` token classes, Supabase (RLS, service client in routes), Vitest (`environment: node`, `tests/**/*.test.ts` only), Playwright for the six-viewport QA script.

---

## Out of scope, on purpose

- Spec 4's second-session attribution survey: not in spec section 2's in-list; a separate small plan.
- Spec 11 "manual retry does not duplicate a lot": already proven by `tests/manual-import.test.ts` and `tests/manual-portfolio-save.test.ts` against the idempotent route (`app/api/portfolio/manual/route.ts:35,118`). Not re-tested here.

## Ground rules for every task

- Read `AGENTS.md` first. Rule 6: run the **whole** suite (`npm test`) before and after, report totals. Rule 16: `git status --porcelain <file>` and `stat -c %y <file>` before editing; never touch a file another agent has dirty. Known dirty by others right now: `lib/generate-digest.ts`, `contexts/settings-context.tsx`, `app/dashboard/settings/page.tsx`, `app/dashboard/layout.tsx`, `components/posthog-provider.tsx`. None of them is edited by this plan.
- Stage by name. Never `git add -A`, never `git add scripts/`.
- Copy: no em dashes, no exclamation marks, no advice words (`sell buy trim add consider should`). All v3 strings live in `lib/onboarding/v3-copy.ts` and Task 6 tests them.
- Nothing labelled demo ships. There is no `DEMO_EMAIL` gate in v3.
- Commit after every task with the message shape below (problem, behaviour, validation). End every commit with:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01AXwp6azZ8QcXVnATbpYvSJ
  ```
- Baseline before Task 1: `npm test` totals, `npx tsc --noEmit` exit code, `git log --oneline -1`.

## File structure

Create:
- `lib/onboarding/v3-copy.ts`: every user-facing string for v3, exported as constants.
- `lib/onboarding/v3-exit-route.ts`: `routeLinkExit(detail)`: the spec 3.1 exit table.
- `lib/onboarding/v3-exposure.ts`: `bookExposure(holdings)`, `exposureSentence(book)`, `previewSentence(rows)`.
- `lib/onboarding/first-look.ts`: `FIRST_LOOK_CODES`, `parseFirstLook(value)`, `orderRevealCards(codes, accounts)`.
- `components/onboarding/v3/onboarding-flow-v3.tsx`: overlay, phase state, gate, events.
- `components/onboarding/v3/book-ask.tsx`: Screen 1, also rendered inline by the Portfolio empty state.
- `components/onboarding/v3/account-loop.tsx`: Screen 2.
- `components/onboarding/v3/book-reveal.tsx`: Screen 3 with loading, error, ready.
- `components/onboarding/v3/first-look.tsx`: the 3.4 question.
- `components/onboarding/v3/use-book.ts`: one hook that fetches `/api/financial-summary` and exposes accounts, holdings, refetch.
- `supabase/migrations/077_first_look.sql`
- `app/testing/onboarding-v3/page.tsx`: harness with jump-to-screen, real reads, zero writes.
- `scripts/qa-onboarding-v3.mjs`: six viewports, three screens.
- Tests: `tests/link-exit-detail.test.ts`, `tests/onboarding-v3-exit-route.test.ts`, `tests/onboarding-v3-exposure.test.ts`, `tests/first-look.test.ts`, `tests/onboarding-v3-copy.test.ts`, `tests/insights-standing-item.test.ts`, `tests/digest-first-look.test.ts`; extend `tests/activation-state.test.ts`.

Modify:
- `lib/plaid/link-exit.ts`: add `LinkExitDetail` + `describeLinkExit()`.
- `components/plaid/plaid-link-button.tsx:14-32,168-185,190-213`: `onExitDetail`, `openRef`.
- `lib/preference-fields.ts:24-31`: add `'first_look'`.
- `app/api/user/preferences/route.ts:77-99`: validate `first_look` through `parseFirstLook`.
- `lib/activation-state.ts`: add `accountCount`, `hasBrief`.
- `app/dashboard/dashboard-shell.tsx:53-56,117-148,642`: v3 gate, sidebar dim labels.
- `app/dashboard/portfolio/page.tsx:470-503`: empty state renders `BookAsk`; brief promise banner.
- `lib/insights-reader.ts:136-162`: standing "Add your second account" item.
- `app/dashboard/actions/actions-client.tsx`: no dismiss/snooze controls on `source === 'standing'`.
- `lib/digest/pack.ts:483-487,686,756`: first-look category bonus on the first brief.
- `docs/superpowers/specs/2026-09-08-onboarding-book-first-design.md`: two corrections (Task 0).

---

### Task 0: Spec corrections found by the code read

**Files:**
- Modify: `docs/superpowers/specs/2026-09-08-onboarding-book-first-design.md`

- [ ] **Step 1: Fix the two wrong facts**

Section 10 says "The receipt covers 13 names." The truth is `CONTENT_UNIVERSE` in `lib/content/universe.ts`, 40 names, matched 1:1 by `HOUSE_THESES`. Section 3.3 says "the existing look-through behind the True Exposure view. Confirm which module before build". The module is `computePortfolioLookthrough` in `lib/etf-holdings.ts:632`, and True Exposure is a toggle inside `app/dashboard/portfolio/page.tsx` (state at line 361), not a route.

```bash
cd "C:/Users/Evan/Desktop/unnamed fintech bot"
python - <<'EOF'
import io
p='docs/superpowers/specs/2026-09-08-onboarding-book-first-design.md'
s=io.open(p,encoding='utf-8').read()
a='The receipt covers 13 names.'
b='The receipt covers the 40 names in `lib/content/universe.ts`.'
assert s.count(a)==1; s=s.replace(a,b)
a='True Exposure view. Confirm which module before build; do not write a second one.'
b='True Exposure toggle on the portfolio page: `computePortfolioLookthrough` in `lib/etf-holdings.ts:632`. Do not write a second one.'
assert s.count(a)==1; s=s.replace(a,b)
io.open(p,'w',encoding='utf-8',newline='').write(s); print('ok')
EOF
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-09-08-onboarding-book-first-design.md
git commit -m "docs(spec): onboarding v3 names the real coverage count and look-through module"
```

---

### Task 1: `describeLinkExit` and the `onExitDetail` / `openRef` props

Why: the spec's exit table needs the code, the institution name and the search query. Today `plaid-link-button.tsx:168-185` has all three in hand and throws them away after the PostHog capture. Chips also need to open the one Link instance instead of mounting seven buttons, because `create-link-token` is rate limited to 10 per hour per IP (`create-link-token/route.ts:10-17`).

**Files:**
- Modify: `lib/plaid/link-exit.ts` (append)
- Modify: `components/plaid/plaid-link-button.tsx:14-32` (props), `:168-185` (onExit), `:190-213` (handleClick), plus the destructure at `:34-45`
- Test: `tests/link-exit-detail.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/link-exit-detail.test.ts
import { describe, it, expect } from 'vitest';
import { describeLinkExit } from '@/lib/plaid/link-exit';

describe('describeLinkExit', () => {
  it('reports institution_not_found from status when err is null', () => {
    expect(describeLinkExit(null, { status: 'institution_not_found' }, 'Public.com')).toEqual({
      code: 'INSTITUTION_NOT_FOUND', status: 'institution_not_found', institutionName: null, searchQuery: 'Public.com',
    });
  });
  it('reports the Plaid error code and the institution the user picked', () => {
    expect(describeLinkExit({ error_code: 'INVALID_CREDENTIALS' }, { status: 'requires_credentials', institution: { name: 'Fidelity' } }, null)).toEqual({
      code: 'INVALID_CREDENTIALS', status: 'requires_credentials', institutionName: 'Fidelity', searchQuery: null,
    });
  });
  it('reports a plain close as code null', () => {
    expect(describeLinkExit(null, { status: null }, null)).toEqual({ code: null, status: null, institutionName: null, searchQuery: null });
  });
  it('never throws on missing metadata', () => {
    expect(describeLinkExit(undefined as never, undefined, undefined as never).code).toBeNull();
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `npx vitest run tests/link-exit-detail.test.ts`
Expected: FAIL, `describeLinkExit` is not exported.

- [ ] **Step 3: Implement**

Append to `lib/plaid/link-exit.ts`:

```ts
export type LinkExitDetail = {
  /** Plaid error_code, INSTITUTION_NOT_FOUND synthesized from status, or null for a plain close. */
  code: string | null;
  status: string | null;
  institutionName: string | null;
  searchQuery: string | null;
};

type LinkExitMetadata = { status?: string | null; institution?: { name?: string | null } | null } | null | undefined;

/** Everything the caller can act on after Link closes, in one object. */
export function describeLinkExit(err: PlaidLinkExitError | undefined, metadata: LinkExitMetadata, searchQuery: string | null | undefined): LinkExitDetail {
  const status = metadata?.status ?? null;
  const resolved = resolveLinkExitError(err ?? null, status);
  return {
    code: resolved?.code || null,
    status,
    institutionName: metadata?.institution?.name ?? null,
    searchQuery: searchQuery ?? null,
  };
}
```

In `components/plaid/plaid-link-button.tsx`:

1. Import: change the existing import from `@/lib/plaid/link-exit` to also bring `describeLinkExit` and `type LinkExitDetail`.
2. Props interface (after `onExit?: () => void;`):
```tsx
  /** Same moment as onExit, with the code, institution and search query. */
  onExitDetail?: (detail: LinkExitDetail) => void;
  /** Lets a parent open Link from another control (a chip) without mounting a second button. */
  openRef?: React.MutableRefObject<(() => void) | null>;
```
3. Destructure both in the function signature.
4. In `onExit`, after `onLinkError?.(...)` and before `onExit?.();`:
```tsx
      onExitDetail?.(describeLinkExit(err, metadata, lastSearchRef.current));
```
5. After `handleClick` is defined, add:
```tsx
  useEffect(() => {
    if (!openRef) return;
    openRef.current = handleClick;
    return () => { openRef.current = null; };
  });
```
(`useEffect` is already imported at the top; confirm.)

- [ ] **Step 4: Run the test and the existing Plaid tests**

Run: `npx vitest run tests/link-exit-detail.test.ts tests/plaid-link-exit.test.ts`
Expected: PASS, both files.

- [ ] **Step 5: Typecheck and confirm callers**

Run: `npx tsc --noEmit`
Expected: exit 0. The eight importers (grep finds nine files, one is the component) pass no new props, so nothing else changes. State in the commit message: "8 callers read, none affected".

- [ ] **Step 6: Commit**

```bash
git add lib/plaid/link-exit.ts components/plaid/plaid-link-button.tsx tests/link-exit-detail.test.ts
git commit -m "feat(plaid): expose the Link exit detail and an open handle on PlaidLinkButton

The onboarding exit table needs the code, institution and search query that
onExit already captures for analytics. Adds onExitDetail (same moment as
onExit) and openRef so shortcut chips can open the one Link instance instead
of mounting a button each, which would spend the 10/hour link-token limit.
Existing props unchanged; 8 callers read, none affected. Tests: link-exit-detail."
```

---

### Task 2: Exit routing table

**Files:**
- Create: `lib/onboarding/v3-exit-route.ts`
- Test: `tests/onboarding-v3-exit-route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/onboarding-v3-exit-route.test.ts
import { describe, it, expect } from 'vitest';
import { routeLinkExit } from '@/lib/onboarding/v3-exit-route';
import { PLAID_ERROR_MESSAGES } from '@/lib/plaid/link-exit';

const d = (code: string | null, extra: Partial<{ status: string | null; institutionName: string | null; searchQuery: string | null }> = {}) =>
  ({ code, status: null, institutionName: null, searchQuery: null, ...extra });

describe('routeLinkExit', () => {
  it('sends institution_not_found to the manual panel naming the search', () => {
    const r = routeLinkExit(d('INSTITUTION_NOT_FOUND', { searchQuery: 'Public.com' }));
    expect(r.to).toBe('manual');
    expect(r.message).toContain('Public.com is not available through Plaid yet');
  });
  it('sends institution_not_found without a query to the manual panel with a generic subject', () => {
    expect(routeLinkExit(d('INSTITUTION_NOT_FOUND')).message).toContain('That brokerage is not available');
  });
  it('sends down, no longer supported and registration required to manual with the link-exit message', () => {
    for (const code of ['INSTITUTION_DOWN', 'INSTITUTION_NO_LONGER_SUPPORTED', 'INSTITUTION_REGISTRATION_REQUIRED']) {
      const r = routeLinkExit(d(code));
      expect(r.to).toBe('manual');
      expect(r.message).toBe(PLAID_ERROR_MESSAGES[code]);
    }
  });
  it('keeps invalid credentials and locked items on the screen with the message', () => {
    for (const code of ['INVALID_CREDENTIALS', 'ITEM_LOCKED']) {
      expect(routeLinkExit(d(code))).toEqual({ to: 'stay', message: PLAID_ERROR_MESSAGES[code] });
    }
  });
  it('does nothing on a plain close', () => {
    expect(routeLinkExit(d(null, { status: 'requires_credentials' }))).toEqual({ to: 'none', message: null });
  });
  it('treats an unknown code as stay with a generic line', () => {
    const r = routeLinkExit(d('SOMETHING_NEW'));
    expect(r.to).toBe('stay');
    expect(r.message).toMatch(/try again/i);
  });
  it('never uses an em dash or advice words', () => {
    for (const code of ['INSTITUTION_NOT_FOUND', 'INSTITUTION_DOWN', 'INVALID_CREDENTIALS', 'SOMETHING_NEW']) {
      const m = routeLinkExit(d(code, { searchQuery: 'X' })).message ?? '';
      expect(m).not.toMatch(/\u2014|!/);
      expect(m.toLowerCase()).not.toMatch(/\b(sell|buy|trim|consider|should)\b/);
    }
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `npx vitest run tests/onboarding-v3-exit-route.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
// lib/onboarding/v3-exit-route.ts
// Spec 3.1 exit table. Pure: the screen decides what to render from `to`.
import { PLAID_ERROR_MESSAGES, type LinkExitDetail } from '@/lib/plaid/link-exit';

export type ExitRoute = { to: 'manual' | 'stay' | 'none'; message: string | null };

const TO_MANUAL = new Set(['INSTITUTION_DOWN', 'INSTITUTION_NO_LONGER_SUPPORTED', 'INSTITUTION_REGISTRATION_REQUIRED']);
const STAY = new Set(['INVALID_CREDENTIALS', 'ITEM_LOCKED']);

export function routeLinkExit(detail: LinkExitDetail): ExitRoute {
  const { code } = detail;
  if (!code) return { to: 'none', message: null };
  if (code === 'INSTITUTION_NOT_FOUND') {
    const subject = detail.searchQuery ? `${detail.searchQuery} is not available through Plaid yet.` : 'That brokerage is not available through Plaid yet.';
    return { to: 'manual', message: `${subject} Add those positions by hand. Everything works on positions entered by hand.` };
  }
  if (TO_MANUAL.has(code)) return { to: 'manual', message: PLAID_ERROR_MESSAGES[code] };
  if (STAY.has(code)) return { to: 'stay', message: PLAID_ERROR_MESSAGES[code] };
  return { to: 'stay', message: 'Something went wrong connecting your account. Please try again.' };
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npx vitest run tests/onboarding-v3-exit-route.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/onboarding/v3-exit-route.ts tests/onboarding-v3-exit-route.test.ts
git commit -m "feat(onboarding): v3 Link exit routing table as a pure function"
```

---

### Task 3: Exposure sentence and the manual live preview

Why: Screen 3's headline sentence and Screen 1's live preview are the same computation on different inputs. `computePortfolioLookthrough(holdings, total)` returns a `Map<ticker, { directWeight, indirectWeight, totalWeight, sources }>` where weights are percentages of the book and `sources` is `['Direct']` or fund tickers. Account count per underlying is not in that map, so this module counts accounts itself. Definition, so test and code agree: an account counts for a ticker when it holds the ticker directly **or** through a fund that contains it (`getUnderlyingExposure` per row). That is what "across {n} accounts" and "from every account and the funds inside them" mean in the spec.

**Files:**
- Create: `lib/onboarding/v3-exposure.ts`
- Test: `tests/onboarding-v3-exposure.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/onboarding-v3-exposure.test.ts
import { describe, it, expect } from 'vitest';
import { bookExposure, exposureSentence, previewSentence } from '@/lib/onboarding/v3-exposure';

const h = (ticker: string, total_value: number, account_id = 'a1') => ({ ticker, total_value, account_id });

describe('bookExposure', () => {
  it('ranks by total weight and splits direct from inside funds', () => {
    const b = bookExposure([h('NVDA', 600), h('QQQ', 400)]);
    expect(b.total).toBe(1000);
    expect(b.rows[0].ticker).toBe('NVDA');
    expect(b.rows[0].directPct).toBeCloseTo(60, 5);
    expect(b.rows[0].indirectPct).toBeGreaterThan(0); // QQQ holds NVDA
    expect(b.rows[0].funds).toEqual(['QQQ']);
  });
  it('counts the accounts that hold the top name directly', () => {
    const b = bookExposure([h('AAPL', 500, 'a1'), h('AAPL', 500, 'a2')]);
    expect(b.top?.accounts).toBe(2);
  });
  it('counts an account that holds the name only through a fund', () => {
    const b = bookExposure([h('NVDA', 500, 'a1'), h('QQQ', 500, 'a2')]);
    expect(b.rows.find((r) => r.ticker === 'NVDA')?.accounts).toBe(2);
  });
  it('returns no top for an empty book', () => {
    expect(bookExposure([]).top).toBeNull();
  });
});

describe('exposureSentence', () => {
  it('one account, no funds', () => {
    const s = exposureSentence(bookExposure([h('AAPL', 700), h('MSFT', 300)]));
    expect(s).toBe('AAPL is 70% of your book, all of it held directly. That figure comes from every account and the funds inside them.');
  });
  it('funds only', () => {
    const s = exposureSentence(bookExposure([h('QQQ', 1000)]));
    expect(s).toMatch(/^[A-Z]+ is \d+% of your book, all of it inside QQQ\./);
  });
  it('direct plus funds across two accounts', () => {
    const s = exposureSentence(bookExposure([h('NVDA', 500, 'a1'), h('QQQ', 500, 'a2')]));
    expect(s).toMatch(/^NVDA is \d+% of your book: 50% held directly, \d+% inside QQQ, across 2 accounts\./);
  });
  it('never uses advice words or em dashes', () => {
    const s = exposureSentence(bookExposure([h('NVDA', 500), h('QQQ', 500)]));
    expect(s).not.toMatch(/\u2014|!/);
    expect(s.toLowerCase()).not.toMatch(/\b(sell|buy|trim|consider|should)\b/);
  });
});

describe('previewSentence', () => {
  it('one row', () => {
    expect(previewSentence([{ ticker: 'NVDA', value: 100 }])).toBe('NVDA is 100% of this one position.');
  });
  it('two rows', () => {
    expect(previewSentence([{ ticker: 'NVDA', value: 300 }, { ticker: 'AAPL', value: 100 }])).toBe('NVDA is 75% of these two positions.');
  });
  it('three rows with a fund adds the inside-funds share', () => {
    const s = previewSentence([{ ticker: 'NVDA', value: 300 }, { ticker: 'QQQ', value: 300 }, { ticker: 'AAPL', value: 100 }]);
    expect(s).toMatch(/^NVDA is \d+% of these three positions, \d+% of it inside QQQ\.$/);
  });
  it('no prices yet', () => {
    expect(previewSentence([{ ticker: 'NVDA', value: null }])).toBe('Prices load when the book is read.');
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `npx vitest run tests/onboarding-v3-exposure.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
// lib/onboarding/v3-exposure.ts
// The one sentence the reveal and the manual preview are built on. Pure.
import { computePortfolioLookthrough, getUnderlyingExposure } from '@/lib/etf-holdings';
import { canonicalTicker } from '@/lib/ticker-alias';

export type ExposureRow = { ticker: string; totalPct: number; directPct: number; indirectPct: number; funds: string[]; accounts: number };
export type BookExposure = { total: number; rows: ExposureRow[]; top: ExposureRow | null };

type Holding = { ticker: string; total_value: number | string | null; account_id?: string | null };

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five'];
const pct = (n: number) => `${Math.round(n)}%`;

export function bookExposure(holdings: Holding[]): BookExposure {
  const rows = holdings.map((h) => ({ ticker: h.ticker, totalValue: Number(h.total_value) || 0, account: h.account_id ?? 'manual' }));
  const total = rows.reduce((n, r) => n + r.totalValue, 0);
  if (total <= 0) return { total: 0, rows: [], top: null };
  const map = computePortfolioLookthrough(rows, total);
  // An account counts for a name it holds directly or through a fund it holds.
  const accountsByTicker = new Map<string, Set<string>>();
  const note = (ticker: string, account: string) => {
    const key = canonicalTicker(ticker); // same key computePortfolioLookthrough uses (etf-holdings.ts:642)
    if (!accountsByTicker.has(key)) accountsByTicker.set(key, new Set());
    accountsByTicker.get(key)!.add(account);
  };
  for (const r of rows) {
    note(r.ticker, r.account);
    for (const u of getUnderlyingExposure(r.ticker, r.totalValue, total)) note(u.ticker, r.account);
  }
  const out: ExposureRow[] = [...map.entries()]
    .map(([ticker, d]) => ({
      ticker,
      totalPct: d.totalWeight,
      directPct: d.directWeight,
      indirectPct: d.indirectWeight,
      funds: d.sources.filter((s) => s !== 'Direct'),
      accounts: accountsByTicker.get(ticker)?.size ?? 0,
    }))
    .sort((a, b) => b.totalPct - a.totalPct);
  return { total, rows: out, top: out[0] ?? null };
}

const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export function exposureSentence(book: BookExposure): string {
  const t = book.top;
  if (!t) return '';
  const tail = ' That figure comes from every account and the funds inside them.';
  const across = t.accounts > 1 ? `, across ${t.accounts} accounts` : '';
  if (t.indirectPct <= 0) return `${t.ticker} is ${pct(t.totalPct)} of your book, all of it held directly${across}.${tail}`;
  if (t.directPct <= 0) return `${t.ticker} is ${pct(t.totalPct)} of your book, all of it inside ${list(t.funds)}${across}.${tail}`;
  return `${t.ticker} is ${pct(t.totalPct)} of your book: ${pct(t.directPct)} held directly, ${pct(t.indirectPct)} inside ${list(t.funds)}${across}.${tail}`;
}

export function previewSentence(rows: { ticker: string; value: number | null }[]): string {
  if (rows.length === 0) return '';
  if (rows.some((r) => r.value == null)) return 'Prices load when the book is read.';
  const book = bookExposure(rows.map((r) => ({ ticker: r.ticker, total_value: r.value })));
  const t = book.top;
  if (!t) return '';
  const n = rows.length;
  const count = n === 1 ? 'this one position' : `these ${WORDS[n] ?? n} positions`;
  const inside = t.indirectPct > 0 ? `, ${pct(t.indirectPct)} of it inside ${list(t.funds)}` : '';
  return `${t.ticker} is ${pct(t.totalPct)} of ${count}${inside}.`;
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npx vitest run tests/onboarding-v3-exposure.test.ts`
Expected: PASS. `QQQ` is at `lib/etf-holdings.ts:281` and lists AAPL 8.81 then NVDA 8.25; direct NVDA dominates, so the assertions hold. Note `getUnderlyingExposure` returns `[]` for a plain stock, so direct rows add nothing extra.

- [ ] **Step 5: Commit**

```bash
git add lib/onboarding/v3-exposure.ts tests/onboarding-v3-exposure.test.ts
git commit -m "feat(onboarding): exposure sentence and manual preview on the real look-through"
```

---

### Task 4: First-look codes, parsing, card order, migration 077, preferences whitelist

`user_preferences` has `UNIQUE(user_id)` (`001_create_users_and_preferences.sql:74`) and a row is created at signup (`app/api/auth/signup/route.ts:295`) and in the OAuth callback (`app/auth/callback/route.ts:71`). PATCH `/api/user/preferences` upserts on `user_id` through the whitelist in `lib/preference-fields.ts:24-31` and passes values through unvalidated; this task adds the one validated field.

**Files:**
- Create: `lib/onboarding/first-look.ts`, `supabase/migrations/077_first_look.sql`
- Modify: `lib/preference-fields.ts:24-31`, `app/api/user/preferences/route.ts:84-88`
- Test: `tests/first-look.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/first-look.test.ts
import { describe, it, expect } from 'vitest';
import { FIRST_LOOK_CODES, parseFirstLook, orderRevealCards } from '@/lib/onboarding/first-look';
import { WRITABLE_PREFERENCE_FIELDS } from '@/lib/preference-fields';

describe('parseFirstLook', () => {
  it('accepts only known codes, deduplicated, in the given order', () => {
    expect(parseFirstLook(['receipts', 'exposure', 'receipts'])).toEqual(['receipts', 'exposure']);
  });
  it('rejects unknown codes and non-arrays', () => {
    expect(parseFirstLook(['tlh'])).toBeNull();
    expect(parseFirstLook('exposure')).toBeNull();
    expect(parseFirstLook([1])).toBeNull();
  });
  it('accepts the empty set (skipped) as an empty array', () => {
    expect(parseFirstLook([])).toEqual([]);
  });
  it('has exactly the four spec codes', () => {
    expect([...FIRST_LOOK_CODES]).toEqual(['exposure', 'receipts', 'changes', 'overlap']);
  });
});

describe('orderRevealCards', () => {
  it('default order with no answer', () => {
    expect(orderRevealCards(null, 1)).toEqual(['exposure', 'receipts']);
  });
  it('chosen card first, changes adds a third card', () => {
    expect(orderRevealCards(['changes'], 1)).toEqual(['changes', 'exposure', 'receipts']);
    expect(orderRevealCards(['receipts'], 1)).toEqual(['receipts', 'exposure']);
  });
  it('overlap only counts with two or more accounts and swaps the exposure sentence, not the card', () => {
    expect(orderRevealCards(['overlap'], 1)).toEqual(['exposure', 'receipts']);
    expect(orderRevealCards(['overlap'], 2)).toEqual(['exposure', 'receipts']);
  });
  it('several choices keep their order', () => {
    expect(orderRevealCards(['receipts', 'changes'], 1)).toEqual(['receipts', 'changes', 'exposure']);
  });
});

describe('first_look is writable through the preferences route', () => {
  it('is on the whitelist', () => {
    expect((WRITABLE_PREFERENCE_FIELDS as readonly string[]).includes('first_look')).toBe(true);
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `npx vitest run tests/first-look.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the module**

```ts
// lib/onboarding/first-look.ts
// Spec 3.4. Codes are the only thing stored; copy lives in v3-copy.ts.
export const FIRST_LOOK_CODES = ['exposure', 'receipts', 'changes', 'overlap'] as const;
export type FirstLook = (typeof FIRST_LOOK_CODES)[number];
export type RevealCard = 'exposure' | 'receipts' | 'changes';

const KNOWN = new Set<string>(FIRST_LOOK_CODES);

/** null means reject the write. [] means the user skipped. */
export function parseFirstLook(value: unknown): FirstLook[] | null {
  if (!Array.isArray(value)) return null;
  const out: FirstLook[] = [];
  for (const v of value) {
    if (typeof v !== 'string' || !KNOWN.has(v)) return null;
    if (!out.includes(v as FirstLook)) out.push(v as FirstLook);
  }
  return out;
}

/** Card order for Screen 3. `overlap` changes the exposure sentence, not the card list. */
export function orderRevealCards(codes: readonly string[] | null | undefined, accounts: number): RevealCard[] {
  const chosen = (codes ?? []).filter((c): c is RevealCard => c === 'exposure' || c === 'receipts' || c === 'changes');
  const rest: RevealCard[] = ['exposure', 'receipts'].filter((c) => !chosen.includes(c as RevealCard)) as RevealCard[];
  void accounts;
  return [...chosen, ...rest];
}

export function wantsOverlap(codes: readonly string[] | null | undefined, accounts: number): boolean {
  return accounts >= 2 && (codes ?? []).includes('overlap');
}
```

- [ ] **Step 4: Whitelist and validate**

`lib/preference-fields.ts`: add `'first_look',` as the last entry before `] as const;`.

`app/api/user/preferences/route.ts`, inside the `for (const field of WRITABLE_PREFERENCE_FIELDS)` loop, replace the body with:

```ts
  if (!(field in updates)) continue;
  if (field === 'first_look') {
    const parsed = parseFirstLook(updates[field]);
    if (parsed === null) return NextResponse.json({ error: 'first_look must be a list of known codes' }, { status: 400 });
    sanitized[field] = parsed;
    continue;
  }
  sanitized[field] = updates[field];
```
and import `parseFirstLook` from `@/lib/onboarding/first-look`.

- [ ] **Step 5: Migration**

```sql
-- supabase/migrations/077_first_look.sql
-- Independent of 074-076. What a new signup asked to see first (spec 3.4):
-- a list of codes, never free text. NULL = never asked, '{}' = skipped.
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS first_look TEXT[] DEFAULT NULL;

COMMENT ON COLUMN user_preferences.first_look
  IS 'Onboarding v3 first-look codes: exposure, receipts, changes, overlap. NULL = not asked, empty = skipped.';
```

Apply by hand in the Supabase SQL editor (that is how every migration here is applied; `SETUP.md:15-28`). Then verify with a service-role probe in `scripts/` (untracked): `select column_name from information_schema.columns where table_name='user_preferences' and column_name='first_look'`. Report the result in the commit. Until applied, the PATCH will fail with PGRST204 on that column, so the UI in Task 8 must treat a failed save as non-blocking.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/first-look.test.ts tests/preference-fields.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/onboarding/first-look.ts lib/preference-fields.ts app/api/user/preferences/route.ts supabase/migrations/077_first_look.sql tests/first-look.test.ts
git commit -m "feat(onboarding): first_look preference, validated codes, migration 077"
```

---

### Task 5: Activation state grows `accountCount` and `hasBrief`

Why: the sidebar dims by these, the loop screen and inbox item need the account count, and the brief promise banner needs `hasBrief`. `readActivationState` in `lib/activation-state.ts` is the DB-truth helper; `/api/onboarding/status` returns it verbatim. Callers to open first (rule 1): `app/api/onboarding/status/route.ts`, `app/api/emails/drip/route.ts:82`, `tests/activation-state.test.ts`, `tests/drip-delivery.test.ts`. Adding fields breaks none of them; say so in the commit.

**Files:**
- Modify: `lib/activation-state.ts`
- Test: `tests/activation-state.test.ts` (extend)

- [ ] **Step 1: Read the existing test and add cases**

Open `tests/activation-state.test.ts`, copy its fake-client pattern. Add:

```ts
  it('reports the active account count and whether a brief exists', async () => {
    // mock: linked_accounts select id eq user_id eq is_active -> 2 rows; brief_digests select id eq user_id limit 1 -> 1 row
    const s = await readActivationState(client, 'u1');
    expect(s.accountCount).toBe(2);
    expect(s.hasBrief).toBe(true);
  });
```
Build the mock so `from('linked_accounts')` and `from('brief_digests')` return those rows and the three existing tables keep returning what the existing tests expect. The existing `clientFor` mock (`tests/activation-state.test.ts:6-19`) only resolves through `.limit()`, the query object is not thenable; that is why the accounts query below ends in `.limit(100)`. State the constraints the mock enforces: `linked_accounts.is_active`, `brief_digests UNIQUE(user_id)` (033).

- [ ] **Step 2: Run, expect failure**

Run: `npx vitest run tests/activation-state.test.ts`
Expected: FAIL on the new case.

- [ ] **Step 3: Implement**

In `readActivationState`, extend the `Promise.all` with:
```ts
    client.from('linked_accounts').select('id').eq('user_id', userId).eq('is_active', true).limit(100),
    client.from('brief_digests').select('id').eq('user_id', userId).limit(1),
```
Destructure as `accounts, briefs`, include both in the error check, and return:
```ts
  return { hasConnection, hasHoldings, hasThesis, hasSavedWork: hasConnection || hasHoldings || hasThesis, accountCount: accounts.data?.length ?? 0, hasBrief: !!briefs.data?.length };
```

- [ ] **Step 4: Run the whole suite**

Run: `npm test`
Expected: all pass; totals reported.

- [ ] **Step 5: Commit**

```bash
git add lib/activation-state.ts tests/activation-state.test.ts
git commit -m "feat(activation): account count and hasBrief on the activation state (4 callers read, additive)"
```

---

### Task 6: Copy module and its lint test

**Files:**
- Create: `lib/onboarding/v3-copy.ts`
- Test: `tests/onboarding-v3-copy.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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

describe('onboarding v3 copy', () => {
  const all = strings(V3_COPY);
  it('has copy', () => { expect(all.length).toBeGreaterThan(20); });
  for (const [path, s] of all) {
    it(`${path} has no em dash, exclamation mark or advice language`, () => {
      expect(s.includes('\u2014'), 'em dash').toBe(false);
      expect(s.includes('!'), 'exclamation').toBe(false);
      expect(hasAdviceLanguage(s), 'advice').toBe(false);
    });
  }
});
```

- [ ] **Step 2: Run, expect failure**

Run: `npx vitest run tests/onboarding-v3-copy.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
// lib/onboarding/v3-copy.ts
// Every v3 string. tests/onboarding-v3-copy.test.ts lints all of it.
export const V3_COPY = {
  later: 'Do this later',
  step: (n: number) => `Step ${n} of 3`,
  ask: {
    title: 'Start with what you own.',
    lede: 'Connect a brokerage, or type in the positions you hold. Either one gives Helm something real to read.',
    manual: {
      heading: 'Add the positions you hold',
      body: 'Three to five tickers is enough. No credentials, no account numbers. Connect a brokerage later to import the rest.',
    },
    plaid: {
      heading: 'Connect a brokerage',
      body: 'Read-only. Helm can see positions and balances and can never trade, move money or see your login.',
      search: 'Search all brokerages',
      chips: ['Fidelity', 'Schwab', 'Robinhood', 'Vanguard', 'E*TRADE', 'Interactive Brokers'],
      trust: [
        'Read-only. Helm cannot trade or move money.',
        'Disconnect any time from Accounts. Helm removes the connection and everything it imported.',
        'Your login goes to Plaid, never to Helm.',
      ],
    },
  },
  loop: {
    title: 'Is that all of it?',
    lede: 'Helm reads across accounts. Add the others now or later from Accounts.',
    one: 'Most people who pay for Helm hold accounts at two or more brokerages. Add the others and the exposure view shows the overlap between them.',
    many: (n: number, positions: number, value: string) => `${n} accounts, ${positions} positions, ${value}. Add another, or continue.`,
    syncing: (institution: string) => `Syncing ${institution}`,
    imported: 'imported',
    byHand: 'entered by hand',
    already: (institution: string) => `${institution} is already connected`,
    primary: 'Show me what Helm sees',
    secondary: 'You can add accounts any time from Accounts.',
  },
  reveal: {
    title: 'Here is your book, read.',
    loading: 'Reading your book',
    stillSyncing: (institution: string) => `${institution} is still syncing; this updates when it lands.`,
    error: 'Helm could not read the filings just now.',
    retry: 'Retry',
    exposureHeading: 'What you actually own',
    legendDirect: 'Held directly',
    legendFunds: 'Inside your funds',
    receiptHeading: (t: string) => `The reason you hold ${t}, checked`,
    receiptFallback: (t: string) => `No filing has moved ${t} in the last 90 days.`,
    changesHeading: 'What moved this week in these positions',
    changesEmpty: 'Nothing in these positions moved outside its normal range this week.',
    primary: 'Open the terminal',
    promise: 'The brief on these positions lands at 9:15 ET tomorrow.',
  },
  firstLook: {
    heading: 'What do you want to see first?',
    options: {
      exposure: 'How much of everything I actually own',
      receipts: 'Whether the reasons I hold these still hold',
      changes: 'What changed in these positions this week',
      overlap: 'Overlap between my accounts',
    },
    skip: 'Skip',
    save: 'Continue',
  },
  sidebar: {
    briefTomorrow: 'tomorrow',
    afterBrief: 'after your brief',
    needsCostBasis: 'needs cost basis',
  },
  inbox: {
    secondAccountTitle: 'Add your second account',
    secondAccountBody: 'Exposure and the tax view are only as complete as the book. Accounts holds the connection.',
  },
  portfolio: {
    promise: 'Your first brief on these positions lands at 9:15 ET tomorrow.',
  },
} as const;
```

- [ ] **Step 4: Run, expect pass**

Run: `npx vitest run tests/onboarding-v3-copy.test.ts`
Expected: PASS. If `hasAdviceLanguage` flags a line, rewrite the line, not the test. Note: functions in the object are skipped by the walker; call them in the test with sample args if you want them linted (add three `it` cases doing so).

- [ ] **Step 5: Commit**

```bash
git add lib/onboarding/v3-copy.ts tests/onboarding-v3-copy.test.ts
git commit -m "feat(onboarding): v3 copy module with an em dash and advice lint"
```

---

### Task 7: `useBook` hook and Screen 1 `BookAsk`

Why first: `BookAsk` is used by the overlay (Task 9) and by the Portfolio empty state (Task 11). It must work standalone.

Data: `GET /api/financial-summary` returns `accounts` via `transformedAccounts` (`app/api/financial-summary/route.ts:376-385`), which today maps `id, institution, account_type, account_name, balance, sync_status, last_synced_at` and **drops `source`**. Step 0 of this task adds `source: account.source` to that map so manual books read "entered by hand"; without it every row is `plaid`. Callers of the route (`hooks/use-financial-data.ts`, `app/wrapped/connect/page.tsx`, `components/wrapped/wrapped-landing.tsx`, `components/onboarding/onboarding-flow-v2.tsx:437,479`; the overview page reads it through the hook) ignore unknown keys, so the addition is safe; say so in the commit and `holdings` (raw rows: `ticker, total_value, account_id`). `GET /api/market/quotes?tickers=A,B` returns prices for the preview (read `app/api/market/quotes/route.ts:27-60` for the exact response key before coding; it is rate limited, so debounce 600 ms and only fetch when the ticker set changes).

**Files:**
- Create: `components/onboarding/v3/use-book.ts`, `components/onboarding/v3/book-ask.tsx`
- Modify: `app/api/financial-summary/route.ts:376-385` (add `source`), `components/manual-portfolio-form.tsx` (add `onRowsChange`)

- [ ] **Step 0: Expose `source` on financial-summary accounts**

In `transformedAccounts` add `source: account.source,` next to `sync_status`. `linked_accounts.source` is `'plaid' | 'manual'` (manual route writes it at `app/api/portfolio/manual/route.ts:96`).

- [ ] **Step 1: `use-book.ts`**

```ts
'use client';
import { useCallback, useEffect, useState } from 'react';

export type BookAccount = { id: string; institution: string; account_type: string; source: 'plaid' | 'manual'; positions: number };
export type BookHolding = { ticker: string; total_value: number; account_id: string | null };

export function useBook(enabled = true) {
  const [accounts, setAccounts] = useState<BookAccount[]>([]);
  const [holdings, setHoldings] = useState<BookHolding[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/financial-summary', { cache: 'no-store' });
      if (!r.ok) throw new Error(String(r.status));
      const d = await r.json();
      const hs: BookHolding[] = (d.holdings ?? []).map((h: Record<string, unknown>) => ({ ticker: String(h.ticker), total_value: Number(h.total_value) || 0, account_id: (h.account_id as string) ?? null }));
      const counts = new Map<string, number>();
      for (const h of hs) if (h.account_id) counts.set(h.account_id, (counts.get(h.account_id) ?? 0) + 1);
      setAccounts((d.accounts ?? []).map((a: Record<string, unknown>) => ({ id: String(a.id), institution: String(a.institution), account_type: String(a.account_type), source: a.source === 'manual' ? 'manual' : 'plaid', positions: counts.get(String(a.id)) ?? 0 })));
      setHoldings(hs);
      setError(null);
    } catch {
      setError('Could not load your accounts.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { if (enabled) void refetch(); }, [enabled, refetch]);
  return { accounts, holdings, loading, error, refetch };
}
```

- [ ] **Step 2: `book-ask.tsx`**

Requirements, in order of what the component renders:
- Two panels in one grid, `grid-cols-1` under 860px (`min-[860px]:grid-cols-2`), and the **manual panel first in DOM order** so it stacks first on mobile; on wide screens use `min-[860px]:order-2` on the manual panel if the design wants Plaid on the left. Both panels same card style: `rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-tint)] p-5`.
- Manual panel: heading, body, then `<ManualPortfolioForm compact onComplete={onManualComplete} readOnly={readOnly} />`. Above the form, a live preview line: watch the form's rows. `ManualPortfolioForm` does not expose its rows today; add one optional prop to it, `onRowsChange?: (rows: { ticker: string; shares: number }[]) => void`, called from its existing row state effect (open `components/manual-portfolio-form.tsx`, find the rows state, add a `useEffect` that calls it; do not change anything else). In `BookAsk`, debounce 600 ms, fetch `/api/market/quotes?tickers=...` for the row tickers, compute `previewSentence(rows.map(r => ({ ticker, value: price ? price * shares : null })))`, render it in `text-[13px] text-[var(--color-text-secondary)]` with `aria-live="polite"`.
- Plaid panel: heading, body, one `PlaidLinkButton` (`className="helm-button w-full"`, children = `V3_COPY.ask.plaid.search`) with `openRef`, `onSuccess`, `onWarning`, `onExitDetail`, `onSynced`. Six chips as `<button type="button" class="helm-chip">` that call `openRef.current?.()` then remember which chip opened Link in a ref so focus can return to it (`onExitDetail` handler: `lastOpener.current?.focus()`). The three trust rows as a `<ul>`.
- Exit handling: `const route = routeLinkExit(detail)`; `to === 'manual'` → set a notice state rendered above the manual form (`role="status"`) and `manualRef.current?.querySelector('input')?.focus()`; `to === 'stay'` → notice under the chips; `to === 'none'` → nothing. `onWarning(message)` (the duplicate institution) → call `onDuplicate?.(message)`.
- Props:
```tsx
export function BookAsk(props: {
  linkedInstitutions: string[];           // chips already connected render disabled with a check
  onPlaidSuccess: (itemId?: string) => void;
  onPlaidSynced?: (result: BackgroundSyncResult, itemId?: string) => void;
  onManualComplete: () => void;
  onDuplicate?: (message: string) => void;
  onChoice?: (via: 'plaid' | 'manual') => void;   // fires once per panel first interaction, for onb3_ask_choice
  readOnly?: boolean;                      // harness: real form, blocked write
  compact?: boolean;                       // portfolio empty state
})
```
- Inputs 16px (`text-[16px]`) and targets 44px (`min-h-[44px]`) on every button and chip. Check `ManualPortfolioForm compact` already meets 16px; the v2 review found 14px inputs in the lab CSS, not in the form. Verify in the browser at 390px.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add components/onboarding/v3/use-book.ts components/onboarding/v3/book-ask.tsx components/manual-portfolio-form.tsx app/api/financial-summary/route.ts
git commit -m "feat(onboarding): v3 Screen 1, the ask, with manual first on mobile and every Link exit handled"
```

---

### Task 8: `FirstLook` question component

**Files:**
- Create: `components/onboarding/v3/first-look.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client';
import { useState } from 'react';
import { FIRST_LOOK_CODES, type FirstLook } from '@/lib/onboarding/first-look';
import { V3_COPY } from '@/lib/onboarding/v3-copy';

export function FirstLookQuestion({ accounts, onDone }: { accounts: number; onDone: (codes: FirstLook[] | null) => void }) {
  const [picked, setPicked] = useState<FirstLook[]>([]);
  const options = FIRST_LOOK_CODES.filter((c) => c !== 'overlap' || accounts >= 2);
  const toggle = (c: FirstLook) => setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));
  async function save(codes: FirstLook[] | null) {
    if (codes) {
      // Non-blocking: a failed save (migration not applied, network) never holds the reveal.
      fetch('/api/user/preferences', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ first_look: codes }) }).catch(() => undefined);
    }
    onDone(codes);
  }
  return (
    <fieldset className="mt-6 max-w-md">
      <legend className="text-[15px] text-[var(--color-text-primary)]">{V3_COPY.firstLook.heading}</legend>
      <div className="mt-3 grid gap-2">
        {options.map((c) => (
          <label key={c} className="flex items-center gap-3 min-h-[44px] px-3 rounded-lg border border-[var(--color-border)] cursor-pointer has-[:checked]:border-[var(--color-gold)]">
            <input type="checkbox" className="h-4 w-4" checked={picked.includes(c)} onChange={() => toggle(c)} />
            <span className="text-[14px]">{V3_COPY.firstLook.options[c]}</span>
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4">
        <button type="button" className="helm-button min-h-[44px]" onClick={() => save(picked)}>{V3_COPY.firstLook.save}</button>
        <button type="button" className="min-h-[44px] text-[13px] text-[var(--color-text-muted)] underline-offset-2 hover:underline" onClick={() => save([])}>{V3_COPY.firstLook.skip}</button>
      </div>
    </fieldset>
  );
}
```
Skip saves `[]` (spec: empty = skipped) so the question is not asked again. The parent fires `onb3_first_look {count, skipped}`.

- [ ] **Step 2: Typecheck, commit**

```bash
npx tsc --noEmit
git add components/onboarding/v3/first-look.tsx
git commit -m "feat(onboarding): the first-look question, skippable, saves codes only"
```

---

### Task 9: Screen 2 `AccountLoop` and Screen 3 `BookReveal`

**Files:**
- Create: `components/onboarding/v3/account-loop.tsx`, `components/onboarding/v3/book-reveal.tsx`

- [ ] **Step 1: `account-loop.tsx`**

Props: `{ accounts: BookAccount[]; holdings: BookHolding[]; syncing: string | null; linkedInstitutions: string[]; duplicate: string | null; onPlaidSuccess; onPlaidSynced; onManualComplete; onContinue: () => void; firstLook?: React.ReactNode }`.
- Heading from `V3_COPY.loop.one` or `.many(n, positions, value)` where value is `formatCurrency` from `useSettings()` (`contexts/settings-context.tsx` exposes it; read only, do not edit that file).
- Account rows: institution, type, `positions` count, `imported` / `entered by hand`. If `syncing` names an institution, its row reads `V3_COPY.loop.syncing(institution)` with the v2 stage indicator: copy the `syncing` branch markup from `onboarding-flow-v2.tsx:1428-1437` (the check SVG plus two lines).
- If `duplicate`, a `role="status"` line with `V3_COPY.loop.already(duplicate)`.
- Chips minus linked ones, plus compact `ManualPortfolioForm`: reuse `BookAsk` with `compact` here rather than re-implementing chips. So `AccountLoop` = list + `<BookAsk compact .../>` + `firstLook` slot (manual path renders the question here per spec 3.4) + primary/secondary.

- [ ] **Step 2: `book-reveal.tsx`**

Props: `{ holdings: BookHolding[]; accounts: number; syncing: string | null; firstLook: FirstLook[] | null; onOpenTerminal: () => void; onViewed: (p: { top_ticker_covered: boolean; synced: boolean }) => void; firstLookSlot?: React.ReactNode }`.

States:
- **Loading**: `holdings.length === 0 && syncing` → skeleton with `V3_COPY.reveal.loading`, the `firstLookSlot` under it (this is the sync-wait placement). Keep polling: the parent refetches `useBook` every 10 s while `syncing` is set (Task 10).
- **Fetch error**: receipt fetch failed (network or 5xx) → `V3_COPY.reveal.error` + Retry + "Open the terminal". Distinct from the fallback.
- **Ready**: `const book = bookExposure(holdings)`; cards in `orderRevealCards(firstLook, accounts)` order:
  - `exposure`: top five rows, each a bar with two segments: direct (solid gold) and indirect (gold with a diagonal stripe pattern via `repeating-linear-gradient`, so pattern differs as well as colour), width = pct of book. Every row has a visually hidden `<span class="sr-only">{T}: {d}% direct, {i}% inside funds</span>`. Then the sentence: `wantsOverlap(firstLook, accounts) ? overlapSentence : exposureSentence(book)`. Overlap sentence: "{T} sits in {n} of your {accounts} accounts." built from `book.top.accounts`; put it in `v3-exposure.ts` as `overlapSentence(book, accounts)` with one test appended to Task 3's file.
  - `receipts`: fetch `/api/scan/ticker?symbol={book.top.ticker}`. Read `app/api/scan/ticker/route.ts` first for the response shape; render verdict chip (`supports`/`contradicts`), pillar claim, `verbatimCite` in quotes, `sourceLabel` and `dateISO`, `sourceUrl` link. If the route returns no house thesis (`house: false` or `null`), render `V3_COPY.reveal.receiptFallback(t)`. Never invent a verdict.
  - `changes` (only when chosen): `GET /api/dashboard/delta` (it exists; read `app/api/dashboard/delta/route.ts` for shape) filtered to held tickers; if empty, `V3_COPY.reveal.changesEmpty`.
  - If `syncing`, a line `V3_COPY.reveal.stillSyncing(syncing)` above the cards.
- Primary button `V3_COPY.reveal.primary` → `onOpenTerminal()`. Under it `V3_COPY.reveal.promise`.
- Call `onViewed` once when Ready renders.

- [ ] **Step 3: Typecheck, commit**

```bash
npx tsc --noEmit
git add components/onboarding/v3/account-loop.tsx components/onboarding/v3/book-reveal.tsx lib/onboarding/v3-exposure.ts tests/onboarding-v3-exposure.test.ts
git commit -m "feat(onboarding): v3 loop and reveal screens with loading, error and honest fallback states"
```

---

### Task 10: The overlay `OnboardingFlowV3`, the gate, the harness

**Files:**
- Create: `components/onboarding/v3/onboarding-flow-v3.tsx`, `app/testing/onboarding-v3/page.tsx`
- Modify: `app/dashboard/dashboard-shell.tsx:53-56` and `:642`

- [ ] **Step 1: The overlay**

Model it on `onboarding-flow-v2.tsx` and copy these parts verbatim, nothing else: the `track` helper (lines 39-41), the `settle` once-guard (200-207), the fixed overlay container (697-698) with `z-[100]`, the reduced-motion style block (683-695). Do **not** copy the DEMO_EMAIL block.

```tsx
type Phase = 'ask' | 'loop' | 'reveal';
const V3_KEY = 'helm_onboarding_v3_deferred';
```
- Gate effect: if `harness`, show. Else if `localStorage[V3_KEY] === '1'` → settle, hide. Else `GET /api/onboarding/status`; if `hasSavedWork` → settle, hide (a returning user with a book never sees this); else show and `track('onb3_shown', { flow: 'v3' })`.
- Phase transitions: ask → loop on `onPlaidSuccess` (set `syncing = institutionName` from the exit detail is not available on success; take it from the refetched accounts list: the newest Plaid account) or `onManualComplete`; loop → reveal on continue; reveal → `/dashboard/portfolio` via `window.location.href` after `localStorage[V3_KEY]='1'` and `track('onb3_terminal_opened')`.
- `syncing`: set on Plaid success, cleared in `onPlaidSynced`. While set, `setInterval(refetch, 10_000)`.
- "Do this later": text link bottom left on every screen, `track('onb3_deferred', { screen: phase })`, set `V3_KEY`, `window.location.href = '/dashboard/portfolio'`.
- Progress: `<div role="progressbar" aria-valuenow={n} aria-valuemin={1} aria-valuemax={3}>` with three bars and `<span className="sr-only">{V3_COPY.step(n)}</span>`.
- First look: on the Plaid path render `<FirstLookQuestion>` inside the reveal's loading slot; on the manual path render it in the loop's slot. Ask once: keep `firstLook` in state, `null` until answered; after `onDone`, `track('onb3_first_look', { count: codes?.length ?? 0, skipped: !codes || codes.length === 0 })`. If sync lands before the user answers, keep the question mounted above the cards on Ready until answered or skipped; it still drives the brief and the stored preference even when the reveal order is already fixed.
- Events per spec 7, all with `flow: 'v3'`: `onb3_ask_choice {via}`, `onb3_plaid_exit {code}`, `onb3_account_added {via, accounts}`, `onb3_loop_continue {accounts, positions}`, `onb3_reveal_viewed {top_ticker_covered, synced}`. No tickers, names or amounts in any event.

- [ ] **Step 2: The gate in `dashboard-shell.tsx`**

At line 53-56 add `const ONBOARDING_V3 = process.env.NEXT_PUBLIC_ONBOARDING_V3 === '1';` and import `OnboardingFlowV3`. At line 642 replace the ternary with:
```tsx
{!previewPath && checkoutChecked && !resumeCheckout && (ONBOARDING_V3 ? <OnboardingFlowV3 onSettled={settleOnboarding} /> : ONBOARDING_V2 ? <OnboardingFlowV2 onSettled={settleOnboarding} /> : <OnboardingFlow onSettled={settleOnboarding} />)}
```
Check `git status --porcelain app/dashboard/dashboard-shell.tsx` is empty before editing.

- [ ] **Step 3: The harness**

`app/testing/onboarding-v3/page.tsx`: copy the shape of `app/testing/onboarding/page.tsx` (jump buttons, `DemoProvider`), guard with `if (process.env.NODE_ENV === 'production') notFound();` in a `layout.tsx` next to it like `app/testing/onboarding-lab/layout.tsx`, and render `<OnboardingFlowV3 harness jumpTo={phase} readOnly />` where `readOnly` passes through to `BookAsk` so the manual form renders but never writes.

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev` (if not already running; check `netstat -ano | findstr :3000` first, one dev server only). Open `http://localhost:3000/testing/onboarding-v3`. Walk ask → loop → reveal on your own account. Confirm: manual panel first at 390px wide, Link opens from a chip and from the search button, closing Link returns focus to the chip, the progressbar is announced, "Do this later" lands on `/dashboard/portfolio`.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add components/onboarding/v3/onboarding-flow-v3.tsx app/testing/onboarding-v3 app/dashboard/dashboard-shell.tsx
git commit -m "feat(onboarding): v3 overlay behind NEXT_PUBLIC_ONBOARDING_V3, harness at /testing/onboarding-v3

Three screens over the dashboard: the ask, the account loop, one reveal, then
the real terminal. No demo path. Deferral lands on Portfolio, never a blank
terminal. Events carry counts and codes only. Flag off by default; v2 and the
legacy tour unchanged."
```

---

### Task 11: Portfolio empty state and the brief promise banner

`app/dashboard/portfolio/page.tsx:470-503` renders "No holdings yet" with two links to other pages. Replace the inner block with `BookAsk compact` so the ask is where the holdings table will be (spec 6). Keep the `dataState === 'empty'` preview branch at line 455 untouched.

**Files:**
- Modify: `app/dashboard/portfolio/page.tsx:470-503` and the top of the page for the banner

- [ ] **Step 1: Empty state**

Replace lines 470-503 with:
```tsx
  if (holdings.length === 0) {
    return (
      <div className="container mx-auto card-padding max-w-[1600px]">
        <div className="max-w-4xl mx-auto py-10">
          <h1 className="type-h1 mb-2">{V3_COPY.ask.title}</h1>
          <p className="type-body text-[var(--color-text-secondary)] mb-6">{V3_COPY.ask.lede}</p>
          <BookAsk compact linkedInstitutions={[]} onPlaidSuccess={() => refetch()} onPlaidSynced={() => refetch()} onManualComplete={() => refetch()} />
        </div>
      </div>
    );
  }
```
The page's holdings come from `useHoldings()` at line 197, which has no `refetch`. Do not use `refreshPrices()`: it only re-reads `/api/holdings` when `POST /api/market/prices/refresh` succeeds, and that route is limited to 8 per 10 minutes per user, so a throttled call leaves the new book invisible. Use `router.refresh()` from `next/navigation` plus a direct `fetch('/api/holdings')` into the hook's setter if it exposes one (`hooks/use-financial-data.ts:399-416`); if it does not, `window.location.reload()` after the manual save is acceptable here, the page is empty anyway. Remove the now-unused `TrendingUp` import only if nothing else on the page uses it (grep first).

- [ ] **Step 2: Brief promise banner**

At the top of the non-empty render, when `activation.hasBrief === false` (fetch `/api/onboarding/status` once in the page; it is `private, no-store`), render one banner: `V3_COPY.portfolio.promise` in a `rounded-lg border border-[var(--color-gold-border)] bg-[var(--color-gold-surface)] px-4 py-3 text-[13px]`. Gate the fetch and banner on `process.env.NEXT_PUBLIC_ONBOARDING_V3 === '1'` so the flag controls the whole feature.

- [ ] **Step 3: Verify, commit**

Open `/dashboard/portfolio` on an account with no holdings (the `+appreview` free account, or the harness) and on your own. Then:
```bash
npx tsc --noEmit
git add app/dashboard/portfolio/page.tsx
git commit -m "feat(portfolio): the empty state is the ask; brief promise until the first brief lands"
```

---

### Task 12: Sidebar dim labels

**Files:**
- Modify: `app/dashboard/dashboard-shell.tsx:101-148` (NavItem type and arrays) and the item renderer

- [ ] **Step 1: Model**

Add to `NavItem`: `dim?: (s: { hasBrief: boolean; hasConnection: boolean }) => string | null;`. Set:
- Daily Brief: `dim: (s) => (s.hasBrief ? null : V3_COPY.sidebar.briefTomorrow)`
- Theses, Earnings: `dim: (s) => (s.hasBrief ? null : V3_COPY.sidebar.afterBrief)`
- Taxes: `dim: (s) => (s.hasConnection ? null : V3_COPY.sidebar.needsCostBasis)`
There is no Agent nav item today (the spec lists one); skip it. Deliberate simplification: dimming does not read `first_look`; the spec's "matching item is the first to light" is covered by the reveal card order and the brief lead, not the sidebar.

- [ ] **Step 2: State and render**

When `ONBOARDING_V3`, fetch `/api/onboarding/status` once in the shell (after auth) into `activation` state; default `{ hasBrief: true, hasConnection: true }` so nothing dims before the fetch or on error. In the nav item renderer, compute `const dimLabel = ONBOARDING_V3 ? item.dim?.(activation) ?? null : null;`. When set: add `opacity-70` to the link (text must stay at 4.5:1: verify the muted token against the sidebar background with the contrast check in `scripts/audit-*` or a browser devtools pick; if it fails use `text-[var(--color-text-secondary)]` instead of opacity) and append `<span className="ml-2 text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{dimLabel}</span>` inside the link so the label is part of the accessible name. No `aria-disabled`, no `disabled`; the link still navigates.

- [ ] **Step 3: Verify, commit**

Check with the flag on and a fresh account: Brief shows "tomorrow", Taxes shows "needs cost basis" on a manual-only book. Tab through: the screen reader name reads "Daily Brief tomorrow".
```bash
npx tsc --noEmit
git add app/dashboard/dashboard-shell.tsx
git commit -m "feat(shell): sidebar items say what they wait for instead of hiding (v3 flag only)"
```

---

### Task 13: Standing inbox item "Add your second account"

`readInsights` in `lib/insights-reader.ts` returns only `insights` rows. Add one synthesized item when the user has exactly one active `linked_accounts` row and the default (open) view is requested. Callers to open (rule 1): `app/api/insights/route.ts:6`, `app/dashboard/actions/page.tsx`, and the PATCH handler at `app/api/insights/route.ts:29` (it must not be able to dismiss a fake id; it updates by `id` and will affect zero rows, which is fine, but the client should not offer the control).

**Files:**
- Modify: `lib/insights-reader.ts` (after the map/filter, before return), `app/dashboard/actions/actions-client.tsx`
- Test: `tests/insights-standing-item.test.ts`

- [ ] **Step 1: Write the failing test**

Use the `vi.hoisted` + `vi.mock` pattern from `tests/stripe-webhook.test.ts:6-46`. Mock `supabase.from('insights')` to return an empty list, every other table `readInsights` touches before line 136 (the thesis context lookups feeding `ctx`/`ruleCtx`; read the function to list them) to return empty, and `from('linked_accounts')` to return one row (mock enforces `is_active = true` filter by only returning when `.eq('is_active', true)` was called). Assert `readInsights(client, { id: 'u1' })` resolves to one item with `id: 'standing-second-account'`, `source: 'standing'`, `title: V3_COPY.inbox.secondAccountTitle`. Second case: two accounts → no standing item. Third: `options.status === 'done'` → no standing item.

- [ ] **Step 2: Run, expect failure**

Run: `npx vitest run tests/insights-standing-item.test.ts`

- [ ] **Step 3: Implement**

At the end of `readInsights`, before the return, when `!options.status || options.status === 'open'` (read the status branches at lines 37-57 to use the right default) and not `options.archived`:
```ts
  const { data: accts } = await supabase.from('linked_accounts').select('id').eq('user_id', user.id).eq('is_active', true).limit(2);
  if ((accts?.length ?? 0) === 1) {
    transformedInsights.push({
      id: 'standing-second-account', type: 'portfolio', priority: 'low',
      title: V3_COPY.inbox.secondAccountTitle, description: V3_COPY.inbox.secondAccountBody,
      recommended_action: undefined, estimated_impact: null,
      source: 'standing', related_entity_type: null, created_at: new Date(0).toISOString(), expires_at: null,
      snoozed_until: null, is_archived: false, is_dismissed: false, is_useful: null,
    });
  }
```
The array is `transformedInsights`; the object literal must satisfy its inferred element type, so include every key with `null`/`undefined` as above (tsc tells you if one is missing). In `actions-client.tsx`, where dismiss/snooze/archive controls render, hide them when `item.source === 'standing'`, and make its CTA link to `/dashboard/accounts` (`ctaHref` map at lines 103-116). Deliberate simplification: the item is pinned last and does not read `first_look`; the spec's "moves below the chosen item" collapses to this because chosen items are real rows sorted above it by priority.

- [ ] **Step 4: Run whole suite, commit**

```bash
npm test
git add lib/insights-reader.ts app/dashboard/actions/actions-client.tsx tests/insights-standing-item.test.ts
git commit -m "feat(actions): standing item asks for the second account until it exists (3 callers read)"
```

---

### Task 14: Brief lead from `first_look`, in the pack

The ranked digest orders items by score in `lib/digest/pack.ts:686` with `CAT_BONUS` at 483. `buildDigestContext(userId, db)` at 756 has the db and the user, so the first-look read lives here and `lib/generate-digest.ts` (dirty, another agent) is not touched.

**Files:**
- Modify: `lib/digest/pack.ts`
- Test: `tests/digest-first-look.test.ts`

- [ ] **Step 1: Export the bonus function and test it**

Add near `CAT_BONUS`:
```ts
/** Spec 3.4: the first brief leads with what the person asked to see first. Later briefs use the normal order. */
export const FIRST_LOOK_CATS: Record<string, Cat[]> = { exposure: ['a', 'f'], receipts: ['b', 'c'], changes: ['e', 'g', 'h'], overlap: ['a'] };
/** Larger than the whole CAT_BONUS spread (a = 3.0) so a chosen item leads regardless of category. */
export const FIRST_LOOK_BONUS = 4.0;
export function firstLookBonus(cat: Cat, firstLook: readonly string[] | null | undefined, isFirstBrief: boolean): number {
  if (!isFirstBrief || !firstLook?.length) return 0;
  return firstLook.some((code) => FIRST_LOOK_CATS[code]?.includes(cat)) ? FIRST_LOOK_BONUS : 0;
}
```
No test imports the real `lib/digest/pack` today; its service client is lazy (`pack.ts:39`) so a bare import works, but mock `@/lib/financial-data`, `@/lib/vix` and `@/lib/earnings-edgar` the way `tests/news-ingest-readers.test.ts` does so the file stays offline. Test: `firstLookBonus('b', ['receipts'], true) === FIRST_LOOK_BONUS`, `firstLookBonus('b', ['receipts'], false) === 0`, `firstLookBonus('e', ['receipts'], true) === 0`, `firstLookBonus('a', [], true) === 0`, and `FIRST_LOOK_BONUS > CAT_BONUS.a` (export `CAT_BONUS` or assert against the literal 3.0 with a comment pointing at line 485). Contribution points still add on top, so a very large `a` move can outrank; that is intended, a threshold crossing is the more consequential fact.

- [ ] **Step 2: Wire it**

In `buildDigestContext`, read `user_preferences.first_look` and whether `brief_digests` has a row for the user (`select id ... limit 1`; UNIQUE(user_id) so this is "first brief" when empty). Known limitation, state it in the commit: `digest-cron.ts:141-151` upserts a generic digest for users with no holdings, so a pre-existing no-book user who sees v3 at flag flip already has a row and gets no lead. New signups, the population the spec measures, are unaffected. Pass both into `buildRanked` (add two optional params) and add `firstLookBonus(it.cat, firstLook, isFirstBrief)` into the score line at 659. `buildRanked` has one caller, inside `buildDigestContext` at line 1116; update it.

- [ ] **Step 3: Whole suite, commit**

```bash
npm test
git add lib/digest/pack.ts tests/digest-first-look.test.ts
git commit -m "feat(brief): the first brief leads with the reader's first-look choice"
```

---

### Task 15: QA script, full verification, working tree

**Files:**
- Create: `scripts/qa-onboarding-v3.mjs` (copy `scripts/qa-full-onboarding.mjs`, point at `http://localhost:3000/testing/onboarding-v3`, screens `['Ask', 'Loop', 'Reveal']`, same six viewports and checks: horizontal overflow, console errors, sub-44px targets at `w <= 430`, rendered content).

- [ ] **Step 1: Run the QA script**

Run: `node scripts/qa-onboarding-v3.mjs`
Expected: 18 screenshots, zero overflow, zero console errors, zero sub-44px targets. Fix what it finds in the component that owns it, commit each fix.

- [ ] **Step 2: Full verification**

```bash
npm test                  # report totals vs the Task 0 baseline
npx tsc --noEmit          # exit 0
npm run build             # exit 0 (stop `next dev` first if the swc binary is stale)
git status --porcelain    # only the other agents' known files; nothing untracked that tracked code imports
```

- [ ] **Step 3: Commit the script by name**

```bash
git add scripts/qa-onboarding-v3.mjs
git commit -m "test(onboarding): six-viewport QA for the v3 screens"
```

- [ ] **Step 4: Report**

List for Evan: commits, test totals before and after, migration 077 status (applied or not), the harness URL, and what stays dark until the flag flips. Do not push. Do not promote.

---

## Rollout (after the plan, on Evan's go)

1. Apply 077 in the Supabase SQL editor if not yet done; verify with a probe.
2. Push on explicit go. Vercel builds the preview.
3. Set `NEXT_PUBLIC_ONBOARDING_V3=1` on the preview, walk the three screens on a fresh signup.
4. Promote manually. Flip the flag in production. Read at 40 new signups with `scripts/probe-book-retention-2026-09-08.ts` (spec section 8).
