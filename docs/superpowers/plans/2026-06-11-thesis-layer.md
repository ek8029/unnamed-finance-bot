# Thesis Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Continuous thesis-based research on user holdings — pillars, evidence with verbatim citations, rules-derived status — per spec `docs/superpowers/specs/2026-06-11-thesis-layer-design.md`.

**Architecture:** Three new Postgres tables (theses, thesis_pillars, pillar_evidence) behind RLS. EDGAR extensions (Form 4 with 10b5-1 detection, backfill) in `lib/edgar.ts`. Pure status-derivation and excerpt-verification functions in `lib/` with vitest coverage. Scoring runs in its own CRON_SECRET-authed route, decoupled from the 60s daily cron. Surfaces: The Current (brief API) + holding detail "Why I Own This" + thesis CRUD routes. UI wires last (parallel Claude Design session).

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + RLS, service-role from cron), SEC EDGAR (no key), OpenAI via existing wrapper pattern (`lib/generate-digest.ts`), vitest (`npm test`, tests in `tests/`).

**Hard rules (apply to every task):**
- Commits LOCAL ONLY. NEVER `git push` — Evan's explicit go required.
- No invented numbers, no confidence percentages, no consensus claims, no em dashes in UI copy.
- `excerpt` is NOT NULL everywhere. No excerpt, no evidence row.
- Status is derived by rules, never declared by an LLM.
- 10b5-1 scheduled sales default to `context` materiality and can never alone flip status.

---

## Task 1: Migration 039 — schema

**Files:**
- Create: `supabase/migrations/039_thesis_layer.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 039_thesis_layer.sql
-- Thesis layer: theses, thesis_pillars, pillar_evidence (+ macro_tier on market_news)
-- Spec: docs/superpowers/specs/2026-06-11-thesis-layer-design.md §3

create table if not exists theses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  notes text,
  tracked boolean not null default false,
  last_scanned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, ticker)
);

create table if not exists thesis_pillars (
  id uuid primary key default gen_random_uuid(),
  thesis_id uuid not null references theses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  claim text not null check (length(trim(claim)) > 0),
  origin text not null check (origin in ('ai_draft', 'user')),
  confirmed boolean not null default false,
  status text not null default 'unverified'
    check (status in ('unverified', 'intact', 'weakening', 'broken')),
  status_override text
    check (status_override is null or status_override in ('unverified', 'intact', 'weakening', 'broken')),
  status_changed_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pillar_evidence (
  id uuid primary key default gen_random_uuid(),
  pillar_id uuid not null references thesis_pillars(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  verdict text not null check (verdict in ('supports', 'contradicts', 'neutral')),
  materiality text not null check (materiality in ('material', 'context')),
  source_type text not null
    check (source_type in ('filing', 'form4', 'xbrl', 'news', 'price_move')),
  source_key text not null,
  source_title text not null,
  source_url text,
  source_published_at timestamptz,
  excerpt text not null check (length(trim(excerpt)) > 0),
  why text not null,
  what_it_means text not null,
  consider text,
  is_backfill boolean not null default false,
  created_at timestamptz not null default now(),
  unique (pillar_id, source_key)
);

create index if not exists idx_theses_user on theses(user_id);
create index if not exists idx_theses_tracked on theses(user_id, tracked) where tracked;
create index if not exists idx_pillars_thesis on thesis_pillars(thesis_id);
create index if not exists idx_evidence_pillar on pillar_evidence(pillar_id);
create index if not exists idx_evidence_recency on pillar_evidence(pillar_id, created_at desc);

alter table theses enable row level security;
alter table thesis_pillars enable row level security;
alter table pillar_evidence enable row level security;

create policy "Users manage own theses" on theses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own pillars" on thesis_pillars
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own evidence" on pillar_evidence
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Macro strip classifier flag (spec §4.4). market_news is a shared table (no RLS), same as market_prices.
alter table market_news add column if not exists macro_tier text
  check (macro_tier is null or macro_tier in ('mover'));
```

Note: service-role key bypasses RLS, so cron writes need no extra policies (existing pattern, see migrations 025+).

- [ ] **Step 2: Apply locally**

Run against the Supabase project the same way migrations 001-038 were applied (Supabase SQL editor or `supabase db push` — match Evan's existing workflow; ask if unclear). Verify:

```sql
select table_name from information_schema.tables
where table_name in ('theses','thesis_pillars','pillar_evidence');
```
Expected: 3 rows.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/039_thesis_layer.sql
git commit -m "feat: migration 039 — thesis layer schema (theses, pillars, evidence, macro_tier)"
```

---

## Task 2: Status derivation — pure function (TDD)

**Files:**
- Create: `lib/thesis-status.ts`
- Test: `tests/thesis-status.test.ts`

The single most important correctness surface. Rules (spec §3):
- no non-backfill evidence → `unverified`
- any non-backfill evidence → at least `intact`
- 1 material contradiction in last 30d → `weakening`
- 2+ material contradictions in last 30d from independent sources → `broken`; independent = distinct `source_key` AND at least one is primary (`filing`/`form4`/`xbrl`/`price_move`)
- `status_override` set → return the override, skip all rules
- backfill rows excluded from everything

- [ ] **Step 1: Write failing tests**

```typescript
// tests/thesis-status.test.ts
import { describe, it, expect } from 'vitest';
import { derivePillarStatus, type EvidenceForStatus } from '@/lib/thesis-status';

const NOW = new Date('2026-06-11T00:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400_000).toISOString();

function ev(overrides: Partial<EvidenceForStatus>): EvidenceForStatus {
  return {
    verdict: 'supports',
    materiality: 'context',
    source_type: 'news',
    source_key: 'https://example.com/a',
    is_backfill: false,
    created_at: daysAgo(1),
    ...overrides,
  };
}

describe('derivePillarStatus', () => {
  it('returns unverified with no evidence', () => {
    expect(derivePillarStatus([], null, NOW)).toBe('unverified');
  });

  it('returns unverified when only backfill evidence exists', () => {
    expect(derivePillarStatus([ev({ is_backfill: true })], null, NOW)).toBe('unverified');
  });

  it('returns intact with supporting evidence', () => {
    expect(derivePillarStatus([ev({})], null, NOW)).toBe('intact');
  });

  it('returns intact with only context-level contradiction', () => {
    expect(derivePillarStatus([ev({ verdict: 'contradicts', materiality: 'context' })], null, NOW)).toBe('intact');
  });

  it('returns weakening with 1 material contradiction in 30d', () => {
    expect(derivePillarStatus(
      [ev({ verdict: 'contradicts', materiality: 'material' })], null, NOW,
    )).toBe('weakening');
  });

  it('ignores material contradictions older than 30d', () => {
    expect(derivePillarStatus(
      [ev({ verdict: 'contradicts', materiality: 'material', created_at: daysAgo(31) })], null, NOW,
    )).toBe('intact');
  });

  it('returns broken with 2 independent material contradictions, one primary', () => {
    expect(derivePillarStatus([
      ev({ verdict: 'contradicts', materiality: 'material', source_type: 'filing', source_key: 'acc-001' }),
      ev({ verdict: 'contradicts', materiality: 'material', source_type: 'news', source_key: 'https://example.com/b' }),
    ], null, NOW)).toBe('broken');
  });

  it('two news rewrites cannot break a thesis (no primary source)', () => {
    expect(derivePillarStatus([
      ev({ verdict: 'contradicts', materiality: 'material', source_key: 'https://a.com/1' }),
      ev({ verdict: 'contradicts', materiality: 'material', source_key: 'https://b.com/2' }),
    ], null, NOW)).toBe('weakening');
  });

  it('same source_key twice is not independent', () => {
    expect(derivePillarStatus([
      ev({ verdict: 'contradicts', materiality: 'material', source_type: 'filing', source_key: 'acc-001' }),
      ev({ verdict: 'contradicts', materiality: 'material', source_type: 'filing', source_key: 'acc-001' }),
    ], null, NOW)).toBe('weakening');
  });

  it('backfill contradictions never count toward status', () => {
    expect(derivePillarStatus([
      ev({ verdict: 'contradicts', materiality: 'material', source_type: 'filing', source_key: 'acc-1', is_backfill: true }),
      ev({ verdict: 'contradicts', materiality: 'material', source_type: 'form4', source_key: 'acc-2', is_backfill: true }),
      ev({}),
    ], null, NOW)).toBe('intact');
  });

  it('status_override wins over everything', () => {
    expect(derivePillarStatus([
      ev({ verdict: 'contradicts', materiality: 'material', source_type: 'filing', source_key: 'acc-1' }),
      ev({ verdict: 'contradicts', materiality: 'material', source_type: 'form4', source_key: 'acc-2' }),
    ], 'intact', NOW)).toBe('intact');
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run tests/thesis-status.test.ts`
Expected: FAIL — cannot resolve `@/lib/thesis-status`.

- [ ] **Step 3: Implement**

```typescript
// lib/thesis-status.ts
// Pure status derivation. Spec §3. Never call an LLM here.

export type PillarStatus = 'unverified' | 'intact' | 'weakening' | 'broken';

export interface EvidenceForStatus {
  verdict: 'supports' | 'contradicts' | 'neutral';
  materiality: 'material' | 'context';
  source_type: 'filing' | 'form4' | 'xbrl' | 'news' | 'price_move';
  source_key: string;
  is_backfill: boolean;
  created_at: string; // ISO
}

const PRIMARY_SOURCES = new Set(['filing', 'form4', 'xbrl', 'price_move']);
const WINDOW_MS = 30 * 86400_000;

export function derivePillarStatus(
  evidence: EvidenceForStatus[],
  statusOverride: PillarStatus | null,
  now: Date = new Date(),
): PillarStatus {
  if (statusOverride) return statusOverride;

  const live = evidence.filter((e) => !e.is_backfill);
  if (live.length === 0) return 'unverified';

  const cutoff = now.getTime() - WINDOW_MS;
  const recentMaterialContradictions = live.filter(
    (e) =>
      e.verdict === 'contradicts' &&
      e.materiality === 'material' &&
      new Date(e.created_at).getTime() >= cutoff,
  );

  const distinctKeys = new Map<string, EvidenceForStatus>();
  for (const e of recentMaterialContradictions) {
    if (!distinctKeys.has(e.source_key)) distinctKeys.set(e.source_key, e);
  }
  const independent = [...distinctKeys.values()];
  const hasPrimary = independent.some((e) => PRIMARY_SOURCES.has(e.source_type));

  if (independent.length >= 2 && hasPrimary) return 'broken';
  if (recentMaterialContradictions.length >= 1) return 'weakening';
  return 'intact';
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run tests/thesis-status.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/thesis-status.ts tests/thesis-status.test.ts
git commit -m "feat: rules-derived pillar status (pure function, table-driven tests)"
```

---

## Task 3: Excerpt verification + evidence guards (TDD)

**Files:**
- Create: `lib/thesis-evidence.ts`
- Test: `tests/thesis-evidence.test.ts`

Hallucination kill-switch (spec §3, §4.3): excerpt must appear verbatim in the supplied source text for text sources (`filing`, `form4`, `news`). For `price_move`/`xbrl` the excerpt is system-generated by us, never the LLM — verification does not apply.

Normalization is allowed ONLY for whitespace (collapse runs, trim) and Unicode quote/dash variants — never word changes.

- [ ] **Step 1: Write failing tests**

```typescript
// tests/thesis-evidence.test.ts
import { describe, it, expect } from 'vitest';
import { excerptFoundInSource } from '@/lib/thesis-evidence';

describe('excerptFoundInSource', () => {
  const source = 'Revenue for the quarter was $39.1 billion, up 112% year over year.  Data Center revenue reached a record.';

  it('accepts exact substring', () => {
    expect(excerptFoundInSource('Revenue for the quarter was $39.1 billion', source)).toBe(true);
  });

  it('accepts excerpt differing only in whitespace runs', () => {
    expect(excerptFoundInSource('year over year. Data Center revenue', source)).toBe(true);
  });

  it('accepts curly-quote vs straight-quote variants', () => {
    expect(excerptFoundInSource('company\u2019s outlook', "the company's outlook improved")).toBe(true);
  });

  it('rejects paraphrase', () => {
    expect(excerptFoundInSource('Revenue roughly doubled to $39.1B', source)).toBe(false);
  });

  it('rejects empty excerpt', () => {
    expect(excerptFoundInSource('', source)).toBe(false);
    expect(excerptFoundInSource('   ', source)).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run tests/thesis-evidence.test.ts`

- [ ] **Step 3: Implement**

```typescript
// lib/thesis-evidence.ts
// Verbatim-excerpt verification. Spec §4.3 step 2: rows whose excerpt
// is not found in the source are dropped. Applies to filing/form4/news only.

function normalize(text: string): string {
  return text
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function excerptFoundInSource(excerpt: string, sourceText: string): boolean {
  const e = normalize(excerpt);
  if (e.length === 0) return false;
  return normalize(sourceText).includes(e);
}

export const TEXT_SOURCES = new Set(['filing', 'form4', 'news']);
```

- [ ] **Step 4: Run, verify pass** — `npx vitest run tests/thesis-evidence.test.ts`

- [ ] **Step 5: Commit**

```bash
git add lib/thesis-evidence.ts tests/thesis-evidence.test.ts
git commit -m "feat: verbatim excerpt verification (hallucination kill-switch)"
```

---

## Task 4: EDGAR Form 4 parsing with 10b5-1 detection (TDD) — THE SPIKE

Council's "one thing to do first." Validates the only unknown-difficulty tech AND the false-positive killer before any UI exists.

**Files:**
- Modify: `lib/edgar.ts` (existing: UA header, 24h CIK map cache, `getRecentFilings(symbol, sinceDate)` at :301, `getReportedFinancialsEdgar` at :219)
- Create: `tests/form4-parse.test.ts`
- Create: `tests/fixtures/form4-sample.xml` (real Form 4 XML downloaded once from EDGAR)
- Create: `scripts/form4-spike.ts` (end-to-end spike, run manually)

**EDGAR facts the implementer needs:**
- Submissions JSON per CIK (`https://data.sec.gov/submissions/CIK##########.json`) lists filings; filter `form === '4'`.
- Filing documents live at `https://www.sec.gov/Archives/edgar/data/{cikNoLeadingZeros}/{accessionNoDashes}/`. Fetch `index.json` there, pick the `.xml` document that is NOT under an `xslF345X*/` path (that's the rendered version) — the raw `ownershipDocument` XML.
- Inside the XML: `reportingOwner > reportingOwnerRelationship` (`isDirector`, `isOfficer`, `officerTitle`, `isTenPercentOwner`); `nonDerivativeTable > nonDerivativeTransaction` rows with `transactionCoding > transactionCode` (`S` sale, `P` purchase, `A` award, `M` option exercise, `F` tax withholding, `G` gift), `transactionAmounts > transactionShares / transactionPricePerShare`, `transactionDate`.
- **10b5-1:** since the 2023 SEC amendment, `<aff10b5One>` (boolean, sibling of `periodOfReport`) flags plan trades. Older filings note "10b5-1" in `<footnotes>`. Detection = `aff10b5One` true OR any footnote matching `/10b5-1/i`.
- Parse with regex/string extraction consistent with existing `lib/edgar.ts` style (it has no XML dependency; do NOT add one).
- Rate limits: reuse the existing UA constant and stay under ~10 req/s — serialize document fetches, no `Promise.all` over filings.

- [ ] **Step 1: Download a real fixture**

Pick a ticker with known 10b5-1 activity (NVDA — Jensen Huang's sales are 10b5-1 flagged). Manually (curl with the UA header) fetch one Form 4 XML and save to `tests/fixtures/form4-sample.xml`. Also save a second fixture `tests/fixtures/form4-open-market.xml` for a non-plan transaction if findable; if not, construct the second test case by copying the fixture and removing the `aff10b5One`/footnote markers.

- [ ] **Step 2: Write failing tests**

```typescript
// tests/form4-parse.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { parseForm4Xml } from '@/lib/edgar';

const planXml = readFileSync('tests/fixtures/form4-sample.xml', 'utf-8');
const openXml = readFileSync('tests/fixtures/form4-open-market.xml', 'utf-8');

describe('parseForm4Xml', () => {
  it('extracts owner, role, and transactions', () => {
    const parsed = parseForm4Xml(planXml);
    expect(parsed.ownerName.length).toBeGreaterThan(0);
    expect(parsed.transactions.length).toBeGreaterThan(0);
    const t = parsed.transactions[0];
    expect(['S', 'P', 'A', 'M', 'F', 'G']).toContain(t.code);
    expect(t.shares).toBeGreaterThan(0);
    expect(t.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('detects 10b5-1 plan flag', () => {
    expect(parseForm4Xml(planXml).is10b51).toBe(true);
  });

  it('does not flag open-market transactions as 10b5-1', () => {
    expect(parseForm4Xml(openXml).is10b51).toBe(false);
  });

  it('computes total sale value when price present', () => {
    const parsed = parseForm4Xml(planXml);
    const sale = parsed.transactions.find((t) => t.code === 'S');
    if (sale && sale.pricePerShare) {
      expect(sale.value).toBeCloseTo(sale.shares * sale.pricePerShare, 0);
    }
  });
});
```

- [ ] **Step 3: Run, verify fail** — `npx vitest run tests/form4-parse.test.ts`

- [ ] **Step 4: Implement in lib/edgar.ts**

Add (following the file's existing string-extraction style and tag helpers if present):

```typescript
export interface Form4Transaction {
  code: string;           // S, P, A, M, F, G...
  shares: number;
  pricePerShare: number | null;
  value: number | null;   // shares * price when price present
  date: string;           // YYYY-MM-DD
  isDisposition: boolean; // transactionAcquiredDisposedCode === 'D'
}

export interface ParsedForm4 {
  ownerName: string;
  ownerRole: string;      // "CEO", "Director", "10% owner", or "" — from officerTitle/relationship flags
  is10b51: boolean;       // aff10b5One true OR footnotes mention 10b5-1
  transactions: Form4Transaction[];
}

export function parseForm4Xml(xml: string): ParsedForm4 { /* regex extraction per facts above */ }

export interface Form4Summary extends ParsedForm4 {
  accessionNumber: string;  // dedupe key (source_key)
  filedAt: string;
  url: string;              // human-viewable filing index URL
  totalSaleValue: number;   // sum of disposition S-code values
}

// Fetch Form 4s for a ticker filed since sinceDate (ISO). Serialized fetches, UA header, in-memory cache.
export async function getForm4Filings(symbol: string, sinceDate: string): Promise<Form4Summary[]>
```

Implementation notes:
- `getForm4Filings` reuses the existing CIK lookup + submissions fetch from `getRecentFilings` — extract a shared helper if one doesn't exist rather than duplicating the submissions call.
- Cap at 25 most recent Form 4s per call (backfill calls with `sinceDate` 12 months back; live scoring with `last_scanned_at`).
- Wrap per-filing parse in try/catch; a malformed filing is skipped and logged, never throws out of the function.

- [ ] **Step 5: Run, verify pass** — `npx vitest run tests/form4-parse.test.ts`

- [ ] **Step 6: Write and run the end-to-end spike script**

```typescript
// scripts/form4-spike.ts — run: npx tsx scripts/form4-spike.ts NVDA
// Pulls 12 months of Form 4s for one real ticker, prints owner/role/value/10b5-1 per filing.
import { getForm4Filings } from '../lib/edgar';

const ticker = process.argv[2] ?? 'NVDA';
const since = new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10);

const filings = await getForm4Filings(ticker, since);
for (const f of filings) {
  console.log(
    `${f.filedAt}  ${f.ownerName} (${f.ownerRole})  sold $${Math.round(f.totalSaleValue).toLocaleString()}  10b5-1: ${f.is10b51 ? 'YES (scheduled)' : 'no'}  ${f.url}`,
  );
}
console.log(`\n${filings.length} Form 4s. Scheduled (10b5-1): ${filings.filter((f) => f.is10b51).length}`);
```

Run: `npx tsx scripts/form4-spike.ts NVDA`
Expected: a list of real filings; the majority of large executive sales flagged `10b5-1: YES`. **Manually open 3 of the printed URLs and verify owner, value, and plan flag against the actual filing.** This is the council's credibility gate — do not proceed until 3/3 check out.

- [ ] **Step 7: Commit**

```bash
git add lib/edgar.ts tests/form4-parse.test.ts tests/fixtures scripts/form4-spike.ts
git commit -m "feat: EDGAR Form 4 parsing with 10b5-1 plan detection + 12mo spike script"
```

---

## Task 5: Seeding — AI-drafted pillars

**Files:**
- Create: `lib/thesis-seed.ts`
- Create: `app/api/thesis/seed/route.ts` (POST, user-authed, on-demand per ticker)

Spec §4.2. Use the OpenAI wrapper pattern from `lib/generate-digest.ts` (`new OpenAI({ apiKey: process.env.OPENAI_API_KEY })`, `chat.completions.create`). Define `const SEED_MODEL = 'gpt-4o-mini'` at top — single constant so the model can be swapped if draft quality disappoints.

- [ ] **Step 1: Implement `lib/thesis-seed.ts`**

```typescript
export interface SeededPillar { claim: string }

// Drafts 2-4 plain declarative claims for a ticker.
// Inputs: ticker, company profile (getCompanyProfileEdgar), recent filings list (getRecentFilings).
// Prompt constraints (spec §4.2 + §6, enforce in the system prompt):
//  - 2-4 short declarative claims, each independently checkable against future filings/news
//  - NO numbers the model invents; numbers allowed only if quoted from the supplied profile/filings text
//  - no hedging, no "may/could", no em dashes
// Returns [] on any failure (caller treats as "no drafts" — never blocks the page).
export async function draftPillars(ticker: string): Promise<SeededPillar[]>
```

JSON-mode response (`response_format: { type: 'json_object' }`), validate shape, clamp to 4, drop empty claims.

- [ ] **Step 2: Implement `app/api/thesis/seed/route.ts`**

POST `{ ticker }`. Auth via the existing server-side Supabase SSR client pattern (same as other `app/api/dashboard/*` routes). Behavior:
1. Upsert the `theses` row for (user, ticker) if missing (`tracked` stays false).
2. If the thesis already has ANY pillars and the request lacks `{ resuggest: true }`, return existing pillars (drafting is on-demand-once; re-draft only on explicit re-suggest, and re-suggest only ever ADDS new `ai_draft` rows — never touches confirmed pillars).
3. Call `draftPillars`, insert rows: `origin='ai_draft'`, `confirmed=false`, `status='unverified'`, `sort_order` sequential.
4. **Default tracked thesis (spec §5.3):** after the upsert, if the user has ZERO tracked theses AND this ticker is the user's largest holding by market value (reuse the holdings query pattern the brief route uses), set `tracked = true` on this thesis. Free tier gets its 1 tracked thesis without a manual step.
5. Return thesis + pillars.

- [ ] **Step 3: Manual verification**

With the dev server running and logged in as Evan's account, POST to `/api/thesis/seed` for one real holding. Verify rows in `thesis_pillars`, claims are plain checkable sentences, no invented numbers.

- [ ] **Step 4: Commit**

```bash
git add lib/thesis-seed.ts app/api/thesis/seed/route.ts
git commit -m "feat: AI pillar seeding (on-demand drafts, ai_draft/unconfirmed)"
```

Note: the "pre-draft for Plaid-connected users" batch job (spec §4.2) is just a loop over holdings calling the same `draftPillars` + inserts. Add it as a one-off authed admin route or run it manually from a script AFTER scoring works — not needed for the critical path. Defer.

---

## Task 6: Scoring route + status recompute

**Files:**
- Create: `lib/score-theses.ts`
- Create: `app/api/cron/score-theses/route.ts`
- Modify: `vercel.json` (add second cron entry — Vercel Pro)
- Test: extend `tests/thesis-evidence.test.ts` with the candidate-gathering filter if any pure logic emerges (e.g. price-move threshold helper)

Spec §4.3. Route skeleton mirrors `app/api/cron/daily/route.ts`: `export const maxDuration = 300;` (Vercel Pro), CRON_SECRET bearer check, service-role client.

- [ ] **Step 1: Implement `lib/score-theses.ts`**

`export async function scoreAllTheses(serviceClient): Promise<{ scanned: number; evidenceAdded: number; statusChanges: number; log: string[] }>`

Per tracked thesis (free tier: only the 1 allowed tracked thesis is ever tracked — enforcement happens at track time, Task 7; the cron trusts `tracked`):

1. **Gather candidates since `last_scanned_at`** (default 7 days back if null):
   - `getRecentFilings(ticker, since)` — source_type `filing`, source_key = accession number
   - `getForm4Filings(ticker, since)` — source_type `form4`, source_key = accession number
   - `market_news` rows where `primary_ticker = ticker`, published since, passing existing junk filters (already filtered at ingest by `lib/free-news.ts`) — source_type `news`, source_key = URL
   - price move: compare latest two closes in `market_prices`; if |move| > 5%, candidate with source_type `price_move`, source_key `price:TICKER:YYYY-MM-DD`, excerpt = system string `"NVDA fell 7.2% on 2026-06-10"` (our data, not LLM)
   - XBRL company facts: `getReportedFinancialsEdgar(ticker)` (lib/edgar.ts:219); when a NEW period appeared since `last_scanned_at`, build candidates from key line items compared against the company's own prior period ONLY (spec §4.1 — no consensus, never "beat expectations"). source_type `xbrl`, source_key `xbrl:TICKER:PERIOD:METRIC`, excerpt = system-built factual string (e.g. `"Q1 FY26 revenue $39.1B vs $18.4B prior year"`), never LLM text
   - Cap: 12 candidates per thesis per run (newest first). Skip candidates whose `(pillar_id, source_key)` already exists — dedupe guarantee is the DB unique constraint `(pillar_id, source_key)` (created in migration 039; spec §7's "evidence dedupe" test is satisfied by the constraint, verified explicitly in Task 12).
2. **One batched LLM call per thesis** (not per pillar): supply confirmed pillars + candidate source texts (for filings, fetch the primary doc text, truncated ~8k chars; for news, headline+summary from `market_news`; Form 4s get a system-built factual text block). JSON output: array of `{ pillar_index, source_index, verdict, materiality, why, what_it_means, consider?, excerpt }`.
3. **Guards before insert** (order matters):
   - text sources: `excerptFoundInSource(excerpt, sourceText)` or DROP the row
   - `price_move`/`xbrl`: overwrite whatever excerpt the LLM returned with our system-generated string
   - **Form 4 with `is10b51 === true`: force `materiality = 'context'`** regardless of LLM output (spec §4.1 — scheduled sales can never alone flip status; the status rules then guarantee they can't)
   - dedupe on `(pillar_id, source_key)` — the DB unique constraint backstops, use upsert-ignore
4. **Recompute status** per pillar via `derivePillarStatus` (fetch that pillar's evidence rows, map to `EvidenceForStatus`); on change, update `status` + `status_changed_at`. Respect `status_override` (function already does).
5. Update `theses.last_scanned_at = now()` — **always, even with zero candidates** (silence is the product working).
6. Per-thesis try/catch: failures logged, never abort the batch.

- [ ] **Step 2: Implement `app/api/cron/score-theses/route.ts`**

GET, CRON_SECRET bearer (copy auth block from daily cron :21-28), `maxDuration = 300`, builds service client, calls `scoreAllTheses`, returns the summary JSON. Support `?ticker=NVDA` to scope to one thesis for local testing.

- [ ] **Step 3: Schedule via dedicated cron entry**

Account is on Vercel Pro (40 cron jobs, any schedule). Do NOT trigger from the daily cron route — add a second cron entry to `vercel.json` (or `vercel.ts` if the project uses it; check which exists) scheduled 10 minutes after the existing 9:15 ET daily cron, so ingestion (filings/news/prices) lands first:

```json
{ "path": "/api/cron/score-theses", "schedule": "25 13 * * *" }
```

Match the UTC convention of the existing daily cron entry (9:15 ET = 13:15 UTC during EDT; copy whatever offset the existing entry uses, same DST caveat). Vercel calls cron routes with the CRON_SECRET-style auth already handled by the route's bearer check — confirm the existing daily entry's auth mechanism and mirror it. `app/api/cron/daily/route.ts` is NOT modified.

- [ ] **Step 4: Manual local run**

`curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/score-theses?ticker=<real holding>"`
Expected: JSON summary; evidence rows in DB; every excerpt verifiable. **Hand-verify every citation URL** (spec §7 — every one, every time, before Ben/Noah/Danny see anything).

- [ ] **Step 5: Commit**

```bash
git add lib/score-theses.ts app/api/cron/score-theses/route.ts app/api/cron/daily/route.ts
git commit -m "feat: thesis evidence scoring route (batched LLM, excerpt-verified, 10b5-1 guarded)"
```

---

## Task 7: Thesis CRUD routes + tier gating

**Files:**
- Create: `app/api/thesis/route.ts` (GET list for user, POST create/track)
- Create: `app/api/thesis/[ticker]/route.ts` (GET one with pillars+evidence, PATCH notes/tracked, DELETE)
- Create: `app/api/thesis/pillars/[id]/route.ts` (PATCH claim/confirm/dismiss/sort_order/status_override, DELETE)
- Create: POST handler on `app/api/thesis/[ticker]/route.ts` (or a `pillars` collection route) to ADD a user-authored pillar: `origin='user'`, `confirmed=true`, `status='unverified'`, non-empty claim required (spec §2: pillars can be written/replaced by the user, not only accepted from drafts)
- Test: tier-gate covered by manual test (server-side logic is 5 lines; skip unit test — Supabase mocking not worth it)

All user-scoped via the SSR server client (RLS enforces ownership). Validation at the boundary: whitelist updatable fields, reject empty claims.

- [ ] **Step 1: Tracking gate (the only business logic)**

In the PATCH handler when setting `tracked = true`:

```typescript
const tier = await getUserTier(user.id); // lib/tier.ts:28
if (tier === 'free') {
  const { count } = await supabase
    .from('theses')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('tracked', true);
  if ((count ?? 0) >= 1) {
    return NextResponse.json(
      { error: 'Free tier tracks one thesis. Upgrade to track all your positions.' },
      { status: 403 },
    );
  }
}
```

- [ ] **Step 2: Pillar rules in PATCH**

- `confirmed: true` on an `ai_draft` row = accept (claim edit allowed in same call = accept-with-edit)
- dismiss = DELETE on unconfirmed `ai_draft` rows; confirmed pillars can also be deleted by the user (their thesis, their call) — evidence cascades
- `status_override` accepts a status value or null (clear); set `status_changed_at`
- the system NEVER edits a confirmed pillar — only these user-initiated routes do

- [ ] **Step 3: Manual verification**

Free test account: track 1 thesis OK, second track returns 403. Confirm/edit/dismiss/override flows via curl or the UI once wired.

- [ ] **Step 4: Commit**

```bash
git add app/api/thesis
git commit -m "feat: thesis CRUD routes with server-side free-tier track gate"
```

---

## Task 8: Backfill (12-month historical context)

**Files:**
- Create: `app/api/thesis/backfill/route.ts` (POST, user-authed)
- Modify: `lib/score-theses.ts` (export a single-thesis scoring function with `{ since, isBackfill }` options — backfill reuses the exact same pipeline, only labeled)

Spec §4.1: triggered at track time when the thesis has ≥1 confirmed pillar; scoped to that thesis; rows get `is_backfill = true` (status rules already exclude them — Task 2 tests prove it).

- [ ] **Step 1: Refactor `scoreAllTheses` to expose `scoreOneThesis(client, thesis, { since, isBackfill })`** — batch function becomes a loop over it. Re-run the existing tests (`npm test`) to confirm nothing pure broke.

- [ ] **Step 2: Implement the route.** POST `{ ticker }` → verify thesis is tracked + has a confirmed pillar → call `scoreOneThesis` with `since` = 12 months ago, `isBackfill: true`. Candidates capped at 40 for backfill. Return summary. **Trigger: fire-and-forget from the track-enable path in Task 7's PATCH handler** (same short-abort fetch pattern as the Task 6 cron trigger; skip silently if the thesis has no confirmed pillar yet — backfill then happens on the next track toggle or manual call). Manual curl invocation is the test path only, not the product behavior.

- [ ] **Step 3: Backfill audit (spec §7).** Run against one real holding. Sample 10 backfilled evidence rows: verify excerpt fidelity against sources and `is_backfill = true`. Confirm pillar statuses did NOT move from backfill rows alone.

- [ ] **Step 4: Commit**

```bash
git add app/api/thesis/backfill/route.ts lib/score-theses.ts
git commit -m "feat: 12-month evidence backfill, labeled historical context"
```

---

## Task 9: Macro strip classification (cron-time)

**Files:**
- Modify: `lib/free-news.ts` (after ingest, classify candidates)
- Modify: `app/api/cron/daily/route.ts` (only if classification needs a separate step; prefer inside the existing news refresh path)

Spec §4.4: strict classifier, flag stored on `market_news.macro_tier` (migration 039 added it), NEVER an LLM call in the request path.

- [ ] **Step 1: Implement classifier.** In the news ingest path: after junk filtering, batch the day's macro-candidate headlines (those with no `primary_ticker`) into ONE LLM call: "Which of these, if any, are true market-movers (Fed decisions, CPI/inflation shocks, war/geopolitical escalation, major credit events)? Return indices. Almost always the answer is none." Set `macro_tier = 'mover'` on at most 2 rows/day. Zero is the expected output most days.

- [ ] **Step 2: Manual check.** Run news refresh locally on a quiet day → expect 0 flagged. Inspect prompt behavior against a synthetic CPI-shock headline inserted into the batch.

- [ ] **Step 3: Commit**

```bash
git add lib/free-news.ts app/api/cron/daily/route.ts
git commit -m "feat: macro-mover classification at ingest (macro_tier flag, max 2/day)"
```

---

## Task 10: Brief API payload — The Current

**Files:**
- Modify: `app/api/dashboard/brief/route.ts`

Spec §5.1. Additions to the payload (read-only assembly, no LLM calls):

- [ ] **Step 1: `pillarSummary`** — for the user: counts of pillars by status across tracked theses + max `last_scanned_at`. Shape: `{ intact: number; weakening: number; broken: number; unverified: number; positions: number; lastScannedAt: string | null }`.

- [ ] **Step 2: `thesisIntelligence`** — up to 3 evidence items from the last 24h (non-backfill), ranked `materiality DESC, position weight DESC` (position weight from the same holdings data the brief already loads). Each item: `{ ticker, pillarClaim, verdict, materiality, what, why, whatItMeans, consider, sourceTitle, sourceUrl, sourcePublishedAt, statusChanged: boolean }`.

- [ ] **Step 3: `macroStrip`** — `market_news` rows where `macro_tier = 'mover'` and published in last 24h (max 2). Frame per user at request time WITHOUT an LLM: compute the user's exposure (e.g. % of portfolio in equities/sector if derivable from existing holdings data; keep it simple — total equity % is enough). Shape: `{ headline, sourceUrl, exposureLine }` where exposureLine is template-built, e.g. `"Your portfolio is 84% equities."`.

- [ ] **Step 4: Remove headline lists from the brief payload** (spec: headline lists killed; watchlist tape stays — tape is a different endpoint, untouched). Check what consumes the removed field in `app/dashboard/` and the public `/brief` page before deleting; public /brief is prod-visible, so keep its payload shape working (it has no theses — it gets `macroStrip` only, headlines may need to stay there if it's the page's content; verify and decide at implementation, flag in PR notes).

- [ ] **Step 5: Manual verification** — load dashboard locally; payload contains the three new keys; quiet day shows zero items + populated pillarSummary.

- [ ] **Step 6: Commit**

```bash
git add app/api/dashboard/brief/route.ts
git commit -m "feat: brief payload — thesis intelligence, pillar summary, macro strip"
```

---

## Task 11: UI wiring — The Current block + holding detail "Why I Own This"

**Files:**
- Modify: The Current page components (locate via `app/dashboard/` brief page imports)
- Modify: `app/dashboard/holdings/[ticker]/holding-detail-client.tsx` + `page.tsx`
- Create: components per the Claude Design session output

**BLOCKED ON:** Claude Design session iterations (running in parallel). Visual spec: `docs/thesis-layer-ui-brief.md`.

- [ ] **Step 1: The Current** — render order: macro strip (0-2) → thesis intelligence (≤3) → quiet/hero state ("All N pillars intact across M positions" + "Last scanned …" stamp) → existing tape. Headline list components removed.
- [ ] **Step 2: Holding detail** — pillar list (status chips, evidence counts), inline claim editing, ghosted ai_draft rows with accept/edit/dismiss (+ accept all), expandable newest-first evidence timeline (neutral verdicts behind "show all"), status-rule explanation on hover, override control ("Keep intact, I disagree"), collapsed notes textarea ("Your notes (not scanned)"), free-tier lock treatment ("Track all N positions, Pro") with ghost pillars visible.
- [ ] **Step 3: Copy audit** — no em dashes, declarative verdict language, citations on every evidence card, quiet state framed positively.
- [ ] **Step 4: Commit** — `git commit -m "feat: thesis layer UI — The Current block + Why I Own This"`

---

## Task 12: Integration test pass (local, pre-demo gate)

Spec §7. No commit until all pass:

- [ ] `npm test` — full unit suite green.
- [ ] Seed against Evan's real portfolio; confirm pillars read as checkable claims.
- [ ] Run scoring via `curl` with CRON_SECRET; **hand-verify EVERY citation resolves to a real EDGAR/news URL and the excerpt appears in it.**
- [ ] Form 4 spot check: at least one 10b5-1 sale in evidence shows `context` materiality and did NOT move status.
- [ ] Backfill audit: 10 sampled rows, excerpt fidelity + historical-context label.
- [ ] Tier gate: free account second-track attempt → 403.
- [ ] Dedupe guarantee: re-run scoring for the same ticker twice; confirm zero duplicate evidence rows (DB unique constraint `(pillar_id, source_key)` holds).
- [ ] Quiet state renders with last-scanned stamp when nothing new.
- [ ] Final: `git log` review. NO PUSH — say "ready to push when you are" and wait for Evan.

---

## Execution order and dependencies

```
Task 1 (migration) ──┬─→ Task 5 (seeding) ─┐
Task 2 (status fn) ──┤                     ├─→ Task 6 (scoring) ─→ Task 8 (backfill) ─┐
Task 3 (excerpt fn) ─┤                     │                                          ├─→ Task 12
Task 4 (Form 4 spike)┴─────────────────────┘   Task 7 (CRUD) ──────────────────────────┤
Task 9 (macro) ─→ Task 10 (brief API) ─→ Task 11 (UI, blocked on design session) ─────┘
```

Tasks 2, 3, 4 are independent after Task 1 and can run in any order — but run Task 4 (the spike) EARLY; it is the only unknown-difficulty item.
