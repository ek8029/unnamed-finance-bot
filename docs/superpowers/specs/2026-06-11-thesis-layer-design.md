# Thesis Layer — Design Spec

Date: 2026-06-11. Status: approved decisions from brainstorm, formalized here.
Ship target: ~June 24, local testing only. NO production push without Evan's explicit go.
UI companion: `docs/thesis-layer-ui-brief.md` (visual design runs in a parallel Claude Design session; UI wires up last).

## 1. Problem and north star

Investor feedback (Danny, Mucker Capital): the daily brief and raw news lists are noise; the product needs an agentic intelligence layer that does continuous thesis-based research tied to positions.

North star: **"Helm reads every filing and headline on your positions and tells you only when something changes the reason you own them — with proof."**

Anti-goals:
- Never feel like an LLM wrapper. No chat box. Every feature must deepen state or vigilance.
- No dropdown/template thesis builders. Pillars are plain sentences the user owns.
- No invented numbers. No confidence percentages. One fabricated citation kills the deal.

## 2. Core concepts

- **Thesis**: one per (user, ticker). Container for pillars, freeform notes, and tracking state.
- **Pillar**: one plain-English claim, e.g. "Datacenter capex supercycle has 2+ years of runway." 2-4 typical per thesis. AI-drafted pillars arrive unconfirmed (ghosted in UI); nothing is "your thesis" until accepted, rewritten, or replaced. The system never edits a confirmed pillar.
- **Evidence item**: attached to exactly one pillar, never freestanding. Mandatory slots: What (quoted excerpt), Why (causal link to the pillar), What it means (verdict + materiality). Optional: What to consider (only when a genuine action exists). No excerpt = no evidence row (hallucination kill-switch).
- **Status**: derived by rules, never declared by the LLM. `unverified → intact → weakening → broken`. User-overridable.

Architecture note: this ships the structured-pillars model (option B) with the schema deliberately shaped for the narrative+extraction hybrid (option C) later — the `notes` column is the future narrative input, unscored today.

## 3. Data model

New migration: `supabase/migrations/039_thesis_layer.sql`. Three tables, all per-user with standard RLS (`auth.uid() = user_id`), service-role writes from cron.

### theses
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid | FK auth.users, RLS key |
| ticker | text | unique with user_id |
| notes | text null | freeform, unscored, "not scanned" in UI; future option-C narrative input |
| tracked | boolean default false | gating: free tier may track 1 thesis |
| last_scanned_at | timestamptz null | powers the "last scanned" trust stamp |
| created_at / updated_at | timestamptz | |

### thesis_pillars
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| thesis_id | uuid | FK theses, cascade delete |
| user_id | uuid | denormalized for RLS |
| claim | text | the sentence; non-empty |
| origin | text | `ai_draft` \| `user` |
| confirmed | boolean default false | ai_draft starts false; user rows true on creation |
| status | text default `unverified` | `unverified` \| `intact` \| `weakening` \| `broken` |
| status_override | text null | user override value; when set, display it and stop auto-transitions until cleared |
| status_changed_at | timestamptz null | |
| sort_order | int | |
| created_at / updated_at | timestamptz | |

### pillar_evidence
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| pillar_id | uuid | FK thesis_pillars, cascade delete |
| user_id | uuid | denormalized for RLS |
| verdict | text | `supports` \| `contradicts` \| `neutral` |
| materiality | text | `material` \| `context` |
| source_type | text | `filing` (10-K/Q, 8-K) \| `form4` \| `xbrl` \| `news` \| `price_move` |
| source_key | text | dedupe key: EDGAR accession number, news URL, or `price:TICKER:DATE`; unique with pillar_id |
| source_title | text | e.g. "10-Q filed 2026-05-02" |
| source_url | text | link target for citation footnote |
| source_published_at | timestamptz | |
| excerpt | text NOT NULL | quoted text from the source; enforced non-empty. For `price_move` and `xbrl` sources (no document to quote), the excerpt is a system-generated factual string from our own data (e.g. "NVDA fell 7.2% on 2026-06-10", "Q1 FY26 datacenter revenue $39.1B vs $18.4B prior year"), never LLM-generated. Verbatim-match verification applies to text sources (`filing`, `form4`, `news`) only |
| why | text | causal link to this pillar |
| what_it_means | text | verdict framing vs the user's position |
| consider | text null | only when a genuine action exists; most rows null by design |
| is_backfill | boolean default false | labeled "historical context" in UI; excluded from status rules |
| created_at | timestamptz | |

Status derivation (pure function over evidence, runs after each scoring pass):
- any non-backfill evidence exists → at least `intact`
- 1 material contradicting item in last 30d → `weakening`
- 2+ material contradicting items from independent sources in last 30d → `broken`. Independent = distinct `source_key`, and at least one must be a primary source (`filing`/`form4`/`xbrl`/`price_move`) — two rewrites of the same news story cannot break a thesis
- `status_override` set → no auto-transitions; show override
- transitions logged via `status_changed_at`; UI explains rule on hover ("2 contradicting filings within 30d")

## 4. Pipeline

All server-side work uses the existing service-role client pattern and lives in `lib/`. LLM calls follow the existing OpenAI wrapper pattern (`lib/generate-digest.ts` / `lib/analyze-stock.ts`).

### 4.1 EDGAR ingestion (extends lib/edgar.ts)
Existing: CIK mapping, recent filings, XBRL parsing. Add:
- **Form 4 insider transactions** per held ticker (the "CFO sold $4.2M" signal). Parse owner, role, transaction type, value, date.
- **XBRL company facts** pulls for held tickers (revenue, margins, segment data where available) — used as quotable facts, compared only against the company's own prior periods (no consensus data exists; never imply "beat expectations").
- **12-month backfill** per tracked ticker: filings + Form 4. Marked `is_backfill = true`, labeled "historical context." Honest framing only — backfilled LLM judgments are hindsight-contaminated and are never pitched as predictive validation. Backfill depth is the cut line if the schedule slips; citation grounding is never cut.
- **Backfill trigger:** runs when a thesis becomes tracked AND has at least one confirmed pillar (not in the 60s daily cron — it's a dedicated async route/job invoked at track time, scoped to that one thesis). Scores against confirmed pillars only, same as live scoring.
- Respect SEC fair-use: User-Agent header, ~10 req/s ceiling, cache aggressively (ticker map already cached 24h).

### 4.2 Seeding (AI-drafted pillars)
- For Plaid-connected users: pre-draft 2-4 pillars per holding (one batched job; ~30 holdings at current scale). Drafts are `origin = ai_draft, confirmed = false`.
- For everyone else: on-demand draft when they open a holding's thesis section.
- Drafting prompt gets: ticker, company profile, recent filings summary. Output: 2-4 short declarative claims. No numbers invented; claims must be checkable against future filings/news.
- Re-drafting only on explicit user "re-suggest." The system never touches confirmed pillars.

### 4.3 Evidence scoring (new step in the 9:15 cron)
Added to `app/api/cron/daily/route.ts` after insights generation. Per user, per tracked thesis, per confirmed pillar:
1. Gather new candidate sources since `last_scanned_at`: new EDGAR filings + Form 4 (always), `market_news` rows passing the existing relevance filter (`lib/free-news.ts` junk/primary-ticker filters), price moves > 5%.
2. LLM scores each candidate against the pillar set: verdict, materiality, why, what_it_means, consider (optional), excerpt (mandatory quoted text). The LLM must return the excerpt verbatim from supplied source text; rows whose excerpt is not found in the source are dropped.
3. Insert evidence rows (dedupe on `(pillar_id, source_key)`); recompute statuses by the rules in §3; update `theses.last_scanned_at`.
4. No candidates → just bump `last_scanned_at`. Silence is the product working.

Budget guard: cron has `maxDuration = 60`. Scoring must be batched (one LLM call per thesis covering all pillars and all new candidates, not per-pillar calls) and bounded (cap candidates per thesis per day). At current scale (2 Plaid users, ~30 holdings) this fits; if it grows, scoring moves to its own cron-triggered route. Failures per-thesis are caught and logged, never abort the cron.

### 4.4 Macro strip
0-2 items max, only true market-movers (Fed, CPI shock, war). Classified once in the daily cron during news ingestion (strict classifier; flag stored on `market_news`, e.g. a `macro_tier` column) — never an LLM call in the request path. The brief API reads flagged rows and frames each as: event → the user's portfolio exposure → materiality (exposure framing computed per-user at request time from holdings, no LLM). Absent on quiet days. No evidence rows.

## 5. Surfaces

### 5.1 The Current (brief API + page)
`app/api/dashboard/brief/route.ts` payload additions:
- `macroStrip`: 0-2 items
- `thesisIntelligence`: up to 3 evidence items/day, ranked materiality × position weight; each carries pillar claim, ticker, 4-slot content, citation, status-change flag
- `pillarSummary`: counts for the quiet/hero state ("All 12 pillars intact across 6 positions") + `lastScannedAt`
Headline lists are removed from The Current. Watchlist tape stays.

### 5.2 Holding detail — "Why I Own This"
Per the UI brief: pillar list with status chips and evidence counts, inline sentence editing, ghosted unconfirmed drafts with accept/edit/dismiss (+ accept all), expandable newest-first evidence timeline (neutral hidden behind "show all"), status-rule explanation on hover, user override ("keep intact — I disagree", logged via `status_override`), collapsed notes textarea ("Your notes (not scanned)").

API: new routes under `app/api/thesis/` for CRUD on theses/pillars (confirm, edit, dismiss, reorder, override, notes) and on-demand seeding. Standard user-scoped Supabase client + RLS.

### 5.3 Gating
- Free: 1 tracked thesis (default: largest holding). Untracked holdings show seeded ghost pillars + lock treatment ("Track all 6 positions — Pro"). Demo stays visible, never hidden.
- Pro (founding/annual/lifetime): unlimited. Enforced server-side via `getUserTier` (`lib/tier.ts`) on track/scan paths; cron scores only tracked theses within tier limits.
- No trial-wall pivot this sprint. Landing/hero redesign queued post-ship.

## 6. Hard rules (copy + grounding)

- Every evidence item carries a verbatim excerpt and a citation (source, date, link). No excerpt, no row.
- No invented percentages, confidence scores, or consensus claims. Qualitative tiers only (`material`/`context`). Compare only against the company's own prior periods.
- Status comes from rules over evidence, never from LLM declaration.
- No em dashes in UI copy. Verdict language declarative, sourced, calm.
- Quiet state framed positively ("Nothing threatens your theses today"), with last-scanned stamp.

## 7. Testing

- Unit: status-derivation function (pure; table-driven cases incl. override, backfill exclusion, 30d windows); excerpt-verification (reject rows whose excerpt isn't in source text); evidence dedupe.
- Integration (local): seed against Evan's real portfolio; run scoring manually via cron route with `?force=true` and CRON_SECRET; verify citations resolve to real EDGAR URLs by hand — every one, every time, before anything is shown to Ben/Noah or Danny.
- Backfill audit: sample 10 backfilled items, verify excerpt fidelity and "historical context" labeling.
- Tier gate: free account tracks 1, second track attempt rejected server-side.

## 8. Build order (detailed plan follows in implementation-plan doc)

1. Migration 039 (three tables + RLS + indexes)
2. EDGAR extensions (Form 4, XBRL facts, backfill)
3. Seeding job
4. Scoring step in daily cron + status rules
5. Brief API payload + The Current block
6. Holding detail "Why I Own This" + thesis CRUD routes (UI from design session)

Each phase verifiable before the next. Commits local only; push requires Evan's explicit go.
