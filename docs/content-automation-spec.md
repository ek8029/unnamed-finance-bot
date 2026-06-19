# Content Automation Pipeline — Build Spec

Date: 2026-06-18
Owner: Evan Kim
Status: DRAFT for review

## Goal

Automate daily multi-platform content from Helm's own data. Each day, find the single biggest
news/filing event that hits a thesis on a widely-owned ticker, and generate ready-to-post content
for: long-form X thread, LinkedIn (company page), and a 6-slide carousel that doubles as an X image
post, Instagram carousel, and TikTok photo-slideshow. A human approves before anything posts.

Target: 95% automated. Generation + rendering + queueing = 0 daily effort. One approval tap. Then post.

## Core principle

We are NOT generating content from nothing. The product already emits the raw material (thesis
pillars, EDGAR filings, news, verbatim dated cites). This pipeline is DB -> platform-native posts,
not "AI writes marketing." The verbatim SEC cite always comes from a stored DB field, never from the
LLM. That is the anti-slop moat.

---

## Content selection logic (the "what's today's post" decision)

1. **Ticker universe.** A curated set of ~40 widely-owned/searched tickers (NVDA, AAPL, TSLA, PLTR,
   AMD, MSFT, GOOGL, AMZN, META, etc.). Reuse a subset of INDEXABLE_TICKERS. Stored in
   `lib/content-universe.ts`.
2. **House theses.** Each universe ticker has 2-3 pillars (the reasons-to-own). MVP source: derive
   from the existing `analyze-stock` bullCase via a one-time LLM decomposition pass, stored in a
   `house_theses` table. Top ~10 hand-refined for quality.
3. **Daily gather.** For each ticker pull today's EDGAR filings (existing EDGAR integration) + top
   news (existing Nasdaq/Yahoo RSS). 
4. **Score.** Reuse the `score-theses` scoring function to score each item against the ticker's
   pillars (confirms / contradicts / neutral), keeping the verbatim excerpt + date + source URL.
5. **Rank.** newsworthiness = max(pillar impact) x ticker prominence x source weight
   (filing > major news > minor). Pick the top event. Keep a runner-up.
6. **Slow-news fallback.** If nothing material crosses a threshold: do NOT force a post. Options
   (configurable): (a) skip the day, (b) post an evergreen "thesis of the week" teardown from the
   backlog. Default: skip. Never fabricate significance.

Output of this stage: one `content_event` row = {ticker, pillar, verdict, verbatim_cite, cite_date,
source_url, summary}.

---

## Pipeline stages

```
[Vercel cron, daily]
   -> 1. SELECT   : gather + score + rank -> content_event
   -> 2. GENERATE : Claude formats event -> {x_thread, linkedin_post, caption, slide_copy[6]}
   -> 3. VALIDATE : verbatim-cite check + advice-language lint  (reject -> no queue)
   -> 4. RENDER   : @vercel/og -> 6 branded PNG slides
   -> 5. QUEUE    : write content_queue row, status='draft'
[Human, ~5 min/morning]
   -> 6. APPROVE  : /admin/content -> Approve / Edit / Reject
[On approve]
   -> 7. POST     : poster API schedules to X + LinkedIn + IG + TikTok
```

---

## Data model (Supabase)

- `house_theses` — ticker (PK), pillars jsonb (array of {id, claim}), updated_at
- `content_events` — id, date, ticker, pillar_id, verdict, verbatim_cite, cite_date, source_url,
  summary, newsworthiness numeric, selected bool
- `content_queue` — id, event_id (fk), status enum(draft|approved|rejected|posted), x_thread jsonb,
  linkedin_post text, caption text, slide_urls jsonb, disclaimer text, created_at, posted_at,
  poster_ref jsonb (returned post ids)

---

## Tech per layer (reuse existing stack)

- **Cron:** add a second daily Vercel cron (separate time from the 9:15 ET job, e.g. post-market so
  filings/news are in). Verify Vercel Pro cron count allows it.
- **Generate:** one Claude API call (structured output: the 4 formats in one JSON). Cheap.
- **Render slides:** `@vercel/og` / Satori — ALREADY in the Next 16 stack. One branded template
  component (tokens #060606 bg, gold #E6B94D, Space Grotesk / Manrope). Data fills it. Free.
- **Approval UI:** `/admin/content` page, gated to evank8029 (reuse isThesisUser-style allowlist).
  Shows thread + LI + slide previews + Approve/Edit/Reject.
- **Post:** single multi-platform API. Two options:
  - Ayrshare — one endpoint -> X/LinkedIn/IG/TikTok. Fastest. Paid (~$/mo, VERIFY current).
  - Postiz / Mixpost — open-source, self-host, $0. More setup.
  - Phase-0 fallback: NO API. Approval UI just shows copy-ready text + downloadable slide PNGs; Evan
    pastes manually. Zero cost, zero compliance/API risk. (Recommended starting point.)

---

## Guards (non-negotiable)

1. **Verbatim-cite integrity.** The SEC/news quote is interpolated as a literal string from the
   `content_events` row. The generate prompt is told to use it verbatim and forbidden from inventing
   numbers. VALIDATE step asserts the quoted substring exists in the source evidence; mismatch ->
   reject, no queue. One hallucinated cite = dead on FinTwit.
2. **Compliance / advice-language.** Fixed disclaimer appended ("Not investment advice. Helm surfaces
   the evidence; you decide."). Generation constrained to descriptive/analytical framing. A lint pass
   flags prescriptive words (buy/sell/should/must) -> reject for human edit. Ties to known RIA
   advice-language exposure; SEC Dec 2025 finfluencer alert judges impact on behavior, not size.
3. **Human gate before post.** Always. No unattended posting of market commentary.

---

## Platforms

- **X:** thread. API write access is the cost snag (free tier throttled, Basic ~$200/mo) — VERIFY.
  Cheaper: Typefully/Hypefury scheduler, or manual paste in Phase 0.
- **LinkedIn:** company page (@Helm) via org API (w_organization_social, needs app review). Personal
  profile intentionally excluded (founder rule).
- **Instagram + TikTok:** NO VIDEO NEEDED. Both support photo carousels / slideshows natively. The 6
  rendered slides post as IG carousel + TikTok photo-slideshow + X images from one asset.

---

## Build sequence (phased, each independently shippable)

- **Phase 0 — House theses.** Build universe list + derive/store pillars. Verify: ~40 tickers have
  pillars in `house_theses`.
- **Phase 1 — Selection job.** Cron: gather + score + rank -> `content_events`, top selected. Verify:
  each run produces one event with a real verbatim cite + source URL.
- **Phase 2 — Generation + validate.** Claude -> 4 formats; cite-integrity + advice lint. Verify:
  draft has thread+LI+caption+slide copy; rejects on bad cite.
- **Phase 3 — Slide render.** og template -> 6 on-brand PNGs. Verify: slides render, readable, branded.
- **Phase 4 — Approval UI.** `/admin/content` with previews + Approve/Edit/Reject; copy-ready + PNG
  download. Verify: can approve/reject; status flips. ** -> Ship here first. Post manually. **
- **Phase 5 — Auto-post.** Wire Ayrshare/Postiz; approve -> schedule. Verify: approved post lands on
  a test X + LinkedIn.
- **Phase 6 — Go live + monitor.** Cadence on, watch first week, tune thresholds.

RECOMMENDATION: ship Phases 0-4 first (daily auto-drafted, you paste). That removes ~90% of the work
with zero API cost and zero compliance risk. Add Phase 5 auto-posting only once the drafts are
consistently good and you trust them.

---

## Open decisions (confirm before build)

1. **Cadence** — daily auto-draft (you approve)? Confirmed daily, or daily-draft + weekly-only-post?
2. **Ticker universe** — approve a proposed ~40 list, or give your own?
3. **X identity** — personal handle (proof favors it) vs company @helmterminal only? Affects voice + posting target.
4. **Posting tool** — start manual-paste (Phase 4) [recommended], then Ayrshare (paid, fast) or Postiz (free, self-host)?
5. **Pillars** — derive from analyze bull/bear (fast) vs hand-author canonical theses for famous tickers (higher quality)? Recommend derive for MVP, refine top 10.
6. **Voice** — provide 2-3 sample posts in your target X voice so the generator matches it.

## Risks
- X API cost is the main blocker to full auto-post; manual Phase-0 sidesteps it.
- LinkedIn/TikTok/IG app review adds setup days (Ayrshare abstracts this).
- Slow-news days: must allow skip, never force.
- Generated voice reading as AI slop — mitigated by sample-voice priming + human edit gate.
