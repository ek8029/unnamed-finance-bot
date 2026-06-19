# Content Automation Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Daily, automatically draft multi-platform content (X thread, LinkedIn company post, 6-slide carousel) from the biggest news/filing event that hits a thesis on a high-traffic ticker, landing in an admin approval queue for manual posting.

**Architecture:** A daily Vercel cron gathers EDGAR filings + news for a fixed ~40-ticker universe, scores each item against hand-authored canonical theses (stored as code), ranks by newsworthiness, and persists the top event. A generation step turns that event into 4 content formats via the existing AI client, with hard guards (verbatim-cite integrity + advice-language lint). Slides render on demand via `@vercel/og`. An allowlisted `/admin/content` page previews drafts and exposes copy-ready text + downloadable PNGs. No auto-posting in this plan (manual paste).

**Tech Stack:** Next.js 16 (App Router, Vercel cron), Supabase (Postgres), existing EDGAR + news + AI-scoring libs, `@vercel/og` / `ImageResponse` (already in stack), TypeScript.

**Scope:** Phases 0-4 only. Phase 5 (auto-post via Ayrshare/Postiz) and Phase 6 (go-live tuning) are intentionally out of scope and tracked in `docs/content-automation-spec.md`.

**Verification model (no test framework in repo):** Each task verifies via one of: `npx tsc --noEmit` (types), a one-off probe script run with `node`/`tsx` against `.env.local`, `npm run build`, or a manual `/admin/content` check. Mirrors the existing probe-script + tsc + build workflow.

---

## File Structure

**Create:**
- `lib/content/universe.ts` — the ~40-ticker list (high-traffic + volatile names).
- `lib/content/house-theses.ts` — hand-authored canonical theses (pillars) per universe ticker.
- `lib/content/types.ts` — shared types (Pillar, HouseThesis, ContentEvent, GeneratedContent).
- `lib/content/select.ts` — gather + score + rank -> top ContentEvent.
- `lib/content/generate.ts` — ContentEvent -> GeneratedContent (4 formats) via AI client.
- `lib/content/validate.ts` — verbatim-cite integrity + advice-language lint.
- `lib/content/slides.ts` — slide-copy -> slide model (6 slides) shared by render + preview.
- `app/api/cron/content/route.ts` — daily cron: select -> generate -> validate -> queue.
- `app/api/content/slide/[eventId]/[index]/route.tsx` — on-demand 1080x1350 slide PNG via ImageResponse.
- `app/admin/content/page.tsx` — allowlisted approval queue UI (server component).
- `app/admin/content/actions.ts` — server actions: approve / reject.
- `scripts/probe-content.ts` — local runner to exercise select+generate without the cron.
- `supabase/migrations/<ts>_content_pipeline.sql` — content_events + content_queue tables.

**Modify:**
- `vercel.json` (or `vercel.ts`) — register the new daily cron path + schedule.
- `lib/tier.ts` or existing allowlist util — reuse `isThesisUser`-style gate for `/admin/content` (read existing pattern first; do not duplicate).

**Reuse (verified real paths/names — read each before writing, do not reimplement):**
- `lib/edgar.ts` — `getRecentFilings(symbol, sinceDate?)` returns `EdgarFiling[]` (metadata only: form, filingDate, items, url — NO body text).
- `lib/filing-extract.ts` — `stripFilingHtml`, `extractFilingSection` to get actual filing TEXT (the filing libs don't hand you body text).
- News TEXT comes from the **`market_news` table** (`summary` column), NOT from `lib/free-news.ts` (`fetchTickerHeadlines` returns title/url only). Dependency: the existing news-refresh cron must have populated `market_news` for the ticker/day first.
- `lib/score-theses.ts` — `scoreOneThesis`/`scoreAllTheses` are DB-coupled to user `thesis_pillars`/`pillar_evidence` and WRITE evidence rows. They CANNOT score an in-code pillar against an arbitrary item. You must EXTRACT a pure helper (Task 1.2a).
- `lib/thesis-evidence.ts` — `excerptFoundInSource(excerpt, sourceText)`: the verbatim-cite guard. **The cite is LLM-extracted then validated with this; it is NOT a free source-extracted field.**
- AI provider is **OpenAI used directly** (`import OpenAI from 'openai'; new OpenAI({apiKey: process.env.OPENAI_API_KEY})`), per `lib/score-theses.ts` / `lib/analyze-stock.ts`. There is NO generic `aiComplete` wrapper.
- `lib/prompt-safety.ts` — `fence`, `INJECTION_GUARD` (correct as-is).
- `lib/supabase/server.ts` — `createServiceClient` (NOT `lib/supabase/service`).
- `lib/thesis-access.ts` — `isThesisUser(email)` for the `/admin/content` gate.
- `app/api/cron/daily/route.ts` — the exact cron-auth pattern (Bearer `CRON_SECRET`).
- `app/analyze/[ticker]/opengraph-image.tsx` — the `ImageResponse` (`next/og`) pattern.

**Plan-review corrections folded in (2026-06-18):** verdict enum is `'supports'|'contradicts'|'neutral'` to match the codebase (NOT `confirms`); the verbatim-cite integrity check runs at SELECTION via `excerptFoundInSource` against text you fetch yourself; the scorer is an extracted pure helper, not a reused export. Deliberate deviation from the spec: house theses are hand-authored IN CODE (`lib/content/house-theses.ts`), not a `house_theses` DB table — this is spec Open-Decision #5's chosen alternative. Spec's "runner-up" is omitted for Phases 0-4.

---

## Phase 0 — House theses (canonical, hand-authored)

### Task 0.1: Ticker universe + types

**Files:**
- Create: `lib/content/types.ts`
- Create: `lib/content/universe.ts`

- [ ] **Step 1: Define shared types**

```typescript
// lib/content/types.ts
export interface Pillar {
  id: string;        // stable slug, e.g. 'gov-revenue'
  claim: string;     // the falsifiable reason-to-own
  breaks_if: string; // the single fact that would invalidate it
}

export interface HouseThesis {
  ticker: string;
  company: string;
  pillars: Pillar[]; // 2-3 per ticker
}

export interface ScoredItem {
  ticker: string;
  pillarId: string;
  verdict: 'supports' | 'contradicts' | 'neutral'; // matches codebase vocabulary
  verbatimCite: string; // LLM-extracted excerpt, VALIDATED against source via excerptFoundInSource at selection
  citeDate: string;     // ISO
  sourceUrl: string;
  sourceType: 'filing' | 'major_news' | 'minor_news';
  summary: string;
}

export interface ContentEvent extends ScoredItem {
  id: string;
  date: string;          // ISO date of the run
  company: string;
  pillarClaim: string;
  newsworthiness: number;
}

export interface GeneratedContent {
  xThread: string[];     // one string per tweet
  linkedinPost: string;
  caption: string;       // IG/TikTok/X-image caption
  slideCopy: { title: string; body: string }[]; // exactly 6
  disclaimer: string;
}
```

- [ ] **Step 2: Define the ticker universe**

```typescript
// lib/content/universe.ts
// High-traffic + volatile names that get daily airtime. Edit freely.
export const CONTENT_UNIVERSE: string[] = [
  // mega / large cap
  'NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA',
  // semis / AI
  'AMD', 'AVGO', 'SMCI', 'ARM', 'MU', 'TSM', 'MRVL',
  // high-traffic volatile / retail
  'PLTR', 'COIN', 'HOOD', 'SOFI', 'RIVN', 'LCID', 'RDDT', 'MSTR', 'AFRM', 'DKNG',
  // meme / heavily-discussed
  'GME', 'AMC', 'DJT', 'CVNA',
  // thematic volatile
  'SMR', 'OKLO', 'IONQ', 'RGTI',
  // other heavy-traffic
  'NFLX', 'DIS', 'BA', 'UBER', 'SHOP', 'SNAP', 'PYPL', 'INTC',
];
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: EXIT 0.

- [ ] **Step 4: Commit**

```bash
git add lib/content/types.ts lib/content/universe.ts
git commit -m "feat(content): ticker universe + shared types"
```

### Task 0.2: Hand-authored canonical theses

**Files:**
- Create: `lib/content/house-theses.ts`

Author 2-3 pillars per universe ticker. Each pillar = a falsifiable reason-to-own + the fact that would break it. This is content work; quality matters because it drives every post. Pattern below; fill ALL universe tickers.

- [ ] **Step 1: Write the file with the helper + every ticker**

```typescript
// lib/content/house-theses.ts
import type { HouseThesis } from './types';
import { CONTENT_UNIVERSE } from './universe';

export const HOUSE_THESES: HouseThesis[] = [
  {
    ticker: 'NVDA',
    company: 'NVIDIA',
    pillars: [
      { id: 'ai-capex', claim: 'Hyperscaler AI capex keeps growing and NVIDIA keeps the lion share of accelerator spend', breaks_if: 'A major hyperscaler guides data-center capex flat or down, or signals a shift away from NVIDIA silicon' },
      { id: 'margin', claim: 'Gross margin stays in the low-to-mid 70s on pricing power', breaks_if: 'Gross margin guidance is cut materially or competition forces discounting' },
      { id: 'moat', claim: 'CUDA + networking lock-in keeps switching costs high', breaks_if: 'A credible customer migration to AMD/in-house silicon at scale is disclosed' },
    ],
  },
  {
    ticker: 'PLTR',
    company: 'Palantir',
    pillars: [
      { id: 'gov-revenue', claim: 'Government revenue stays sticky and keeps growing', breaks_if: 'A major government contract is cancelled, not renewed, or put under review' },
      { id: 'commercial', claim: 'US commercial revenue accelerates on AIP adoption', breaks_if: 'US commercial growth decelerates for two consecutive quarters' },
      { id: 'margin', claim: 'Operating margin keeps expanding', breaks_if: 'Operating margin guidance is cut or rule-of-40 deteriorates' },
    ],
  },
  // ... author the remaining universe tickers in this exact shape ...
];

// Dev guard: surface any universe ticker missing a thesis (used by probe script).
export function missingTheses(): string[] {
  const have = new Set(HOUSE_THESES.map((t) => t.ticker));
  return CONTENT_UNIVERSE.filter((t) => !have.has(t));
}

export function getHouseThesis(ticker: string): HouseThesis | undefined {
  return HOUSE_THESES.find((t) => t.ticker === ticker.toUpperCase());
}
```

- [ ] **Step 2: Author every remaining universe ticker** (2-3 pillars each). Keep claims specific and falsifiable; no vibes. EVAN reviews this file in the PR — it is the content backbone.

- [ ] **Step 3: Verify coverage with a probe**

Run: `npx tsx -e "import('./lib/content/house-theses.ts').then(m=>{const x=m.missingTheses(); console.log(x.length?('MISSING: '+x.join(',')):'ALL COVERED')})"`
Expected: `ALL COVERED`.

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc --noEmit
git add lib/content/house-theses.ts
git commit -m "feat(content): hand-authored canonical theses for ticker universe"
```

---

## Phase 1 — Selection job

### Task 1.1: DB migration for events + queue

**Files:**
- Create: `supabase/migrations/<ts>_content_pipeline.sql`

- [ ] **Step 1: Write migration** (match existing migration style in `supabase/migrations/`; read one first)

```sql
create table if not exists content_events (
  id uuid primary key default gen_random_uuid(),
  run_date date not null,
  ticker text not null,
  company text not null,
  pillar_id text not null,
  pillar_claim text not null,
  verdict text not null,
  verbatim_cite text not null,
  cite_date timestamptz,
  source_url text not null,
  source_type text not null,
  summary text not null,
  newsworthiness numeric not null,
  selected boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists content_queue (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references content_events(id) on delete cascade, -- unique so og route can key by event_id with maybeSingle
  status text not null default 'draft', -- draft | approved | rejected | posted
  x_thread jsonb not null,
  linkedin_post text not null,
  caption text not null,
  slide_copy jsonb not null,
  disclaimer text not null,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists content_events_run_date_idx on content_events(run_date);
create index if not exists content_queue_status_idx on content_queue(status);
```

These are service-role-only tables (no user RLS needed; never client-queried). Confirm they are NOT exposed to anon role.

- [ ] **Step 2: Apply migration** (use the project's existing migration apply path — Supabase CLI or dashboard; check how prior migrations were applied).

Run: project's migrate command (e.g. `npx supabase db push`) OR apply via dashboard.
Expected: both tables exist.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(content): events + queue tables"
```

### Task 1.2a: Extract a pure scoring helper (prerequisite)

`scoreOneThesis` in `lib/score-theses.ts` cannot be reused directly (DB-coupled, writes evidence). Extract the scoring CORE into a pure function.

**Files:**
- Create: `lib/content/score-helper.ts`

- [ ] **Step 1:** Read `lib/score-theses.ts` ~lines 440-510 (the OpenAI prompt that classifies an item against pillars, the `response_format` JSON call, the parse producing `{pillarId, verdict, excerpt}`). Lift it into:

```typescript
// lib/content/score-helper.ts
import type { Pillar } from './types';
export interface SourceDoc { text: string; date: string; url: string; sourceType: 'filing'|'major_news'|'minor_news'; }
export interface ScoredHit { pillarId: string; verdict: 'supports'|'contradicts'|'neutral'; excerpt: string; date: string; url: string; sourceType: SourceDoc['sourceType']; sourceText: string; summary: string; }
// Pure: takes pillars + already-fetched source docs, returns hits. NO DB reads/writes.
export async function scoreItemsForPillars(ticker: string, pillars: Pillar[], sources: SourceDoc[]): Promise<ScoredHit[]> {
  // mirror the score-theses OpenAI prompt: classify each source against each pillar,
  // return verdict + the model's extracted excerpt (verbatim from source.text). Keep sourceText for the guard.
}
```

- [ ] **Step 2:** Typecheck. Run `npx tsc --noEmit`. Expected EXIT 0.
- [ ] **Step 3:** Commit `feat(content): pure scoring helper extracted from score-theses`.

### Task 1.2: Selection logic

**Files:**
- Create: `lib/content/select.ts`
- Create: `scripts/probe-content.ts`

- [ ] **Step 1: Implement select.ts** — gather SOURCE TEXT (the libs return metadata only), score via the helper, and enforce the verbatim guard at selection:

```typescript
// lib/content/select.ts
import { CONTENT_UNIVERSE } from './universe';
import { getHouseThesis } from './house-theses';
import type { ScoredItem, ContentEvent } from './types';
import { getRecentFilings } from '@/lib/edgar';                          // (symbol, sinceDate?) -> metadata
import { stripFilingHtml, extractFilingSection } from '@/lib/filing-extract'; // filing body text
import { excerptFoundInSource } from '@/lib/thesis-evidence';            // verbatim guard
import { scoreItemsForPillars, type SourceDoc } from './score-helper';

const SOURCE_WEIGHT = { filing: 3, major_news: 2, minor_news: 1 } as const;
const IMPACT = { contradicts: 1, supports: 0.5, neutral: 0 } as const;

function prominence(ticker: string): number {
  const i = CONTENT_UNIVERSE.indexOf(ticker.toUpperCase());
  return i < 0 ? 0.5 : 1 - i / (CONTENT_UNIVERSE.length * 2);
}

export async function selectTopEvent(runDate: string): Promise<ContentEvent | null> {
  const scored: ScoredItem[] = [];
  for (const ticker of CONTENT_UNIVERSE) {
    const thesis = getHouseThesis(ticker);
    if (!thesis) continue;

    // GATHER source docs (text + date + url + type):
    //  - filings: getRecentFilings(ticker, runDate) -> per filing, fetch + stripFilingHtml + extractFilingSection
    //  - news: read today's `market_news` rows for ticker (summary col). Depends on news-refresh cron having run.
    const sources: SourceDoc[] = []; // fill from the two paths above

    const hits = await scoreItemsForPillars(ticker, thesis.pillars, sources);
    for (const h of hits) {
      // VERBATIM GUARD AT SELECTION — the real anti-slop check. Drop if the quote isn't in the source.
      if (h.verdict === 'neutral') continue;
      if (!excerptFoundInSource(h.excerpt, h.sourceText)) continue;
      scored.push({
        ticker, pillarId: h.pillarId, verdict: h.verdict, verbatimCite: h.excerpt,
        citeDate: h.date, sourceUrl: h.url, sourceType: h.sourceType, summary: h.summary,
      });
    }
  }
  if (scored.length === 0) return null;

  const ranked = scored
    .map((s) => ({ s, score: IMPACT[s.verdict] * SOURCE_WEIGHT[s.sourceType] * prominence(s.ticker) }))
    .sort((a, b) => b.score - a.score);

  // Threshold interaction (intended): with IMPACT.supports=0.5, a minor supportive news item ~0.45 is
  // filtered; effectively only FILINGS or CONTRADICTS events clear the floor. We post on real moves, not noise.
  const top = ranked[0];
  const MIN_THRESHOLD = 1.0;
  if (top.score < MIN_THRESHOLD) return null;

  const thesis = getHouseThesis(top.s.ticker)!;
  const pillar = thesis.pillars.find((p) => p.id === top.s.pillarId);
  if (!pillar) return null;
  return { id: '', date: runDate, company: thesis.company, pillarClaim: pillar.claim, newsworthiness: top.score, ...top.s };
}
```

- [ ] **Step 2: Probe script** to run selection locally against `.env.local`

```typescript
// scripts/probe-content.ts
import 'dotenv/config';
import { selectTopEvent } from '../lib/content/select';

const date = new Date().toISOString().slice(0, 10);
selectTopEvent(date).then((e) => {
  console.log(e ? JSON.stringify(e, null, 2) : 'NO EVENT (slow news / below threshold)');
  process.exit(0);
});
```

- [ ] **Step 3: Run the probe**

Run: `npx tsx scripts/probe-content.ts`
Expected: either a ContentEvent JSON with a real `verbatimCite` + `sourceUrl`, or `NO EVENT`. Inspect that the cite is a real substring from the source, not invented.

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc --noEmit
git add lib/content/select.ts scripts/probe-content.ts
git commit -m "feat(content): daily event selection (gather+score+rank)"
```

---

## Phase 2 — Generation + validation

> **Voice (decided):** no exemplars needed. Use the `VOICE_GUIDE` constant below — cool, plain, confident, NO em dashes, no hype, doesn't read as AI.

### Task 2.1: Generation

**Files:**
- Create: `lib/content/generate.ts`

- [ ] **Step 1: Implement generate.ts** — single AI call, structured output, reuse existing AI client + the prompt-safety `fence`/`INJECTION_GUARD` utilities.

Key rules baked into the prompt:
- The `verbatimCite` is provided and MUST appear verbatim in the output; the model may not alter or invent quotes or numbers.
- Descriptive/analytical framing only. No "buy/sell/should/must/recommend".
- X thread 5-8 tweets: hook -> the thesis pillar -> the event + the verbatim dated cite + source -> which pillar it hits -> close with "Run any ticker free at helmterminal.dev/analyze".
- LinkedIn: one professional post, same substance.
- caption: 1-2 sentences.
- slideCopy: exactly 6 {title, body}: hook / pillar / the event / the cite + date / verdict (intact|weakening|broken) / CTA.
- disclaimer returned separately (fixed text).

```typescript
// lib/content/generate.ts
import OpenAI from 'openai';
import type { ContentEvent, GeneratedContent } from './types';
import { fence, INJECTION_GUARD } from '@/lib/prompt-safety'; // EXISTING

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const DISCLAIMER = 'Not investment advice. Helm surfaces the evidence; you decide.';
const VOICE_GUIDE = `Voice: cool, plain, confident. Short declarative sentences. NO em dashes (use periods or commas). No hype words (revolutionary, game-changer, unleash), no emoji spam, no rhetorical questions, no "in today's fast-paced world." Lead with the fact. Sound like a sharp trader who respects the reader's time, not a marketing bot.`;

export async function generateContent(event: ContentEvent): Promise<GeneratedContent> {
  const system = `${INJECTION_GUARD}\nYou write Helm Terminal's company social posts. Descriptive and analytical, NEVER investment advice. Never use the words buy, sell, should, must, or recommend. Use the provided quote VERBATIM; never invent quotes or numbers.`;
  const user = `Event:\n${fence(JSON.stringify(event), 'EVENT')}\nVoice guide:\n${fence(VOICE_GUIDE, 'VOICE')}\nReturn JSON exactly: {"xThread":string[],"linkedinPost":string,"caption":string,"slideCopy":[{"title":string,"body":string}]}. xThread 5-8 items; slideCopy EXACTLY 6.`;
  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini', // bump to gpt-4o if quality needs it
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  });
  const parsed = JSON.parse(res.choices[0].message.content || '{}');
  return {
    xThread: parsed.xThread ?? [],
    linkedinPost: parsed.linkedinPost ?? '',
    caption: parsed.caption ?? '',
    slideCopy: parsed.slideCopy ?? [],
    disclaimer: DISCLAIMER,
  };
}
```

- [ ] **Step 2: Extend probe** to also run generation on the selected event and print all 4 formats.

- [ ] **Step 3: Run probe**

Run: `npx tsx scripts/probe-content.ts`
Expected: prints xThread (array), linkedinPost, caption, 6 slideCopy items. The `verbatimCite` appears unchanged in the output.

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc --noEmit
git add lib/content/generate.ts scripts/probe-content.ts
git commit -m "feat(content): AI generation of 4 platform formats"
```

### Task 2.2: Validation guards

**Files:**
- Create: `lib/content/validate.ts`

- [ ] **Step 1: Implement validate.ts**

```typescript
// lib/content/validate.ts
import type { ContentEvent, GeneratedContent } from './types';

const ADVICE_WORDS = /\b(buy|sell|should|must|recommend|recommended|strong buy|price target)\b/i;

export interface ValidationResult { ok: boolean; reasons: string[] }

export function validateContent(event: ContentEvent, c: GeneratedContent): ValidationResult {
  const reasons: string[] = [];
  const allText = [c.xThread.join('\n'), c.linkedinPost, c.caption, ...c.slideCopy.map(s => s.title + ' ' + s.body)].join('\n');

  // 1. Verbatim-cite integrity: the source quote must appear somewhere in the output.
  const normalized = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!normalized(allText).includes(normalized(event.verbatimCite))) {
    reasons.push('verbatim cite missing from generated content');
  }
  // 2. Advice-language lint.
  if (ADVICE_WORDS.test(allText)) reasons.push('advice-language word detected');
  // 3. Shape checks.
  if (c.slideCopy.length !== 6) reasons.push('slideCopy must have exactly 6 slides');
  if (c.xThread.length < 4) reasons.push('x thread too short');

  return { ok: reasons.length === 0, reasons };
}
```

- [ ] **Step 2: Probe a deliberate failure** — temporarily mutate the generated cite in the probe and confirm `validateContent` returns `ok:false` with the cite reason; then revert.

Run: `npx tsx scripts/probe-content.ts` (with temporary mutation)
Expected: prints a validation failure naming the missing cite.

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc --noEmit
git add lib/content/validate.ts
git commit -m "feat(content): cite-integrity + advice-language validation"
```

---

## Phase 3 — Slide rendering

### Task 3.1: Slide model + ImageResponse route

**Files:**
- Create: `lib/content/slides.ts`
- Create: `app/api/content/slide/[eventId]/[index]/route.tsx`

- [ ] **Step 1: slides.ts** — pure mapping from a queue row's slideCopy to a render model (so preview + PNG share one source).

```typescript
// lib/content/slides.ts
export interface SlideModel { index: number; title: string; body: string; kind: 'hook'|'pillar'|'event'|'cite'|'verdict'|'cta' }
const KINDS = ['hook','pillar','event','cite','verdict','cta'] as const;
export function toSlides(slideCopy: { title: string; body: string }[]): SlideModel[] {
  return slideCopy.slice(0, 6).map((s, i) => ({ index: i, kind: KINDS[i], ...s }));
}
```

- [ ] **Step 2: ImageResponse route** — 1080x1350, brand tokens (#060606 bg, #E6B94D gold, Space Grotesk/Manrope). Reads the queue row by eventId, renders slide `index`.

```tsx
// app/api/content/slide/[eventId]/[index]/route.tsx
import { ImageResponse } from 'next/og';
import { createServiceClient } from '@/lib/supabase/server'; // EXISTING path — confirm
import { toSlides } from '@/lib/content/slides';

export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string; index: string }> }) {
  const { eventId, index } = await params;
  const supabase = await createServiceClient();
  const { data } = await supabase.from('content_queue').select('slide_copy').eq('event_id', eventId).maybeSingle();
  if (!data) return new Response('not found', { status: 404 });
  const slide = toSlides(data.slide_copy)[Number(index)];
  if (!slide) return new Response('bad index', { status: 400 });
  return new ImageResponse(
    (
      <div style={{ width: 1080, height: 1350, background: '#060606', color: '#FAFAFA', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 80, fontFamily: 'sans-serif' }}>
        <div style={{ color: '#E6B94D', fontSize: 28, letterSpacing: 4, textTransform: 'uppercase' }}>Helm Terminal</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>{slide.title}</div>
          <div style={{ fontSize: 36, color: '#C8C8C8', lineHeight: 1.4 }}>{slide.body}</div>
        </div>
        <div style={{ color: '#7A7A7A', fontSize: 24 }}>helmterminal.dev/analyze</div>
      </div>
    ),
    { width: 1080, height: 1350 }
  );
}
```

- [ ] **Step 3: Verify build compiles the route**

Run: `npm run build`
Expected: EXIT 0; route appears as a dynamic function in the route list.

- [ ] **Step 4: Commit**

```bash
git add lib/content/slides.ts "app/api/content/slide/[eventId]/[index]/route.tsx"
git commit -m "feat(content): on-demand 1080x1350 slide PNGs via ImageResponse"
```

---

## Phase 4 — Cron wiring + approval UI

### Task 4.1: Cron route

**Files:**
- Create: `app/api/cron/content/route.ts`
- Modify: `vercel.json` or `vercel.ts` (cron registration)

- [ ] **Step 1: Cron handler** — select -> generate -> validate -> persist event + queue (status draft). On no event or validation fail: persist nothing (or persist event with selected=false) and return a clear status. Guard with the same cron auth the existing `app/api/cron/*` routes use (read one first).

```typescript
// app/api/cron/content/route.ts
import { NextResponse } from 'next/server';
import { selectTopEvent } from '@/lib/content/select';
import { generateContent } from '@/lib/content/generate';
import { validateContent } from '@/lib/content/validate';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  // Cron auth — copy the EXACT pattern from app/api/cron/daily/route.ts.
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const runDate = new Date().toISOString().slice(0, 10);
  const event = await selectTopEvent(runDate);
  if (!event) return NextResponse.json({ status: 'no-event' });

  const supabase = await createServiceClient();
  const { data: ev } = await supabase.from('content_events').insert({
    run_date: runDate, ticker: event.ticker, company: event.company, pillar_id: event.pillarId,
    pillar_claim: event.pillarClaim, verdict: event.verdict, verbatim_cite: event.verbatimCite,
    cite_date: event.citeDate, source_url: event.sourceUrl, source_type: event.sourceType,
    summary: event.summary, newsworthiness: event.newsworthiness, selected: true,
  }).select('id').maybeSingle(); // repo rule: never .single()
  if (!ev) return NextResponse.json({ status: 'insert-failed' }, { status: 500 });

  const content = await generateContent({ ...event, id: ev.id });
  const check = validateContent(event, content);
  if (!check.ok) return NextResponse.json({ status: 'validation-failed', reasons: check.reasons, eventId: ev.id });

  await supabase.from('content_queue').insert({
    event_id: ev.id, status: 'draft', x_thread: content.xThread, linkedin_post: content.linkedinPost,
    caption: content.caption, slide_copy: content.slideCopy, disclaimer: content.disclaimer,
  });
  return NextResponse.json({ status: 'queued', eventId: ev.id });
}
```

- [ ] **Step 2: Register cron** in vercel config — daily, post-market ET (e.g. `30 21 * * *` UTC ≈ 5:30pm ET) so filings/news are in. Confirm Vercel Pro allows an additional cron.

- [ ] **Step 3: Verify** by hitting the route locally with the cron auth header.

Run: `npx tsx scripts/probe-content.ts` first (confirms pipeline), then `npm run build`.
Expected: build EXIT 0; manual local GET to the route returns `{status:'queued'|'no-event'|'validation-failed'}`.

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/content/route.ts vercel.json
git commit -m "feat(content): daily cron wiring select->generate->validate->queue"
```

### Task 4.2: Approval UI

**Files:**
- Create: `app/admin/content/page.tsx`
- Create: `app/admin/content/actions.ts`

- [ ] **Step 1: Gate + page** — server component, allowlisted to evank8029 (reuse the existing `isThesisUser`/allowlist util; read it first, do not duplicate). Lists `content_queue` rows with status `draft`, newest first. For each: show X thread (each tweet in a copyable block), LinkedIn post (copyable), caption (copyable), disclaimer, and the 6 slide images via `/api/content/slide/<eventId>/<0..5>` with download links. Approve / Reject buttons call server actions.

- [ ] **Step 2: Server actions** — `approveDraft(id)` sets status `approved` + decided_at; `rejectDraft(id)` sets `rejected`. Both re-check the caller is allowlisted (never trust the client). Revalidate the page.

```typescript
// app/admin/content/actions.ts
'use server';
import { createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
// import { requireAdmin } from '...'; // reuse allowlist check server-side

async function setStatus(id: string, status: 'approved' | 'rejected') {
  // await requireAdmin();  // throws if not evank8029
  const supabase = await createServiceClient();
  await supabase.from('content_queue').update({ status, decided_at: new Date().toISOString() }).eq('id', id);
  revalidatePath('/admin/content');
}
export async function approveDraft(id: string) { await setStatus(id, 'approved'); }
export async function rejectDraft(id: string) { await setStatus(id, 'rejected'); }
```

- [ ] **Step 3: Verify** — build, then manually load `/admin/content` while logged in as evank8029; confirm a queued draft renders with copyable text + 6 slide previews, and Approve flips it out of the draft list. Confirm a non-allowlisted session is denied.

Run: `npm run build` then manual check on localhost.
Expected: build EXIT 0; gated page works; approve/reject update status.

- [ ] **Step 4: Commit**

```bash
git add app/admin/content/page.tsx app/admin/content/actions.ts
git commit -m "feat(content): allowlisted approval queue UI"
```

---

## Done criteria (Phases 0-4)

- Each morning the cron leaves a `draft` in `content_queue` built from a real, verbatim-cited event (or cleanly does nothing on a slow news day).
- `/admin/content` shows the draft with copy-ready X thread / LinkedIn post / caption + 6 downloadable on-brand slides.
- Validation blocks any draft with a missing/altered cite or advice-language.
- Evan copies, posts manually to @helmterminal (X) + LinkedIn company page + IG/TikTok slideshow.
- No secrets in client; admin gated; service-role tables never client-exposed.

## Deferred (not in this plan)
- Phase 5 auto-post (Ayrshare/Postiz), Phase 6 go-live tuning — see `docs/content-automation-spec.md`.
- Voice exemplars must be supplied before Phase 2 produces on-brand copy.
