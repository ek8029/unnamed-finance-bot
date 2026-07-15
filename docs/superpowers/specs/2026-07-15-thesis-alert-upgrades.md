# Thesis Alert Upgrades — spec (2026-07-15)

Four presentation-layer upgrades to the thesis/evidence surfaces, inspired by mythesis.ai's dashboard (screenshots reviewed 7/15) but built on Helm's existing evidence pipeline. Scope discipline: these deepen the tissue, they do NOT reposition Helm as a thesis product. Build window: after Jul 20 (trials + call week), fits the trust batch.

Ordering rationale: 1+2 share a migration and a scorer-prompt change (ship together); 3+4 are pure read-side and can ship independently in either order.

---

## Feature 1 — Second-person impact gloss on evidence

**What:** Every pillar_evidence row gets a one-line, second-person "what this means for your thesis" gloss rendered ABOVE the verbatim quote. Verbatim quote stays (trust signature — mythesis doesn't quote sources; we do; keep the moat). Example:
> **For your NVDA data-center pillar:** hyperscaler capex guidance keeps the demand leg intact.
> "We now expect data center capital expenditures of…" — 10-Q, Jul 2026 ↗

**Where it comes from:** `lib/score-theses.ts` judge already reasons about pillar relevance to produce supports/contradicts. Extend the judge output schema with `impact_gloss: string` (≤120 chars, second person, references the pillar claim, no advice verbs — "consider selling" forbidden; describes state, not action — RIA posture).

**Schema:** migration 055: `alter table pillar_evidence add column if not exists impact_gloss text;` (nullable — old rows render without gloss; no backfill required, optional backfill script over the ~1.4K existing rows later).

**Prompt change:** score-theses judge: add output field + 2 few-shot examples. Guardrails: must mention the pillar subject; must not introduce facts absent from the cited quote; falls back to null when the judge omits it (never block evidence insertion on gloss absence — insert with null).

**UI:** components that render evidence rows (thesis page evidence list, agent-activity expanded rows, /masthead public cards). Gloss = one line, gold-tinted lead-in ("For your X pillar:"), then existing quote block unchanged. /masthead public variant uses third person ("For the AAPL services pillar:") — no "your" on public pages.

**Tests:** unit: gloss ≤120 chars enforced at insert (truncate, don't reject); null gloss renders identical to today (snapshot); public page uses third-person transform. Integration: run scorer on a seeded pillar, assert gloss lands.

**Effort:** migration + prompt + 3 render sites ≈ half a day. **Risk:** prompt bloat degrading judge accuracy — mitigate by keeping gloss generation in the SAME call (no second model spend), watching eval on the 18 pillar-status tests.

---

## Feature 2 — Materiality grade + feed filter

**What:** Evidence/alerts graded `material | minor`, with direction already implied by supports/contradicts. Feed surfaces default to "material & above" with a toggle to show all. Kills the flat ranking where a 10-K item and a blog mention weigh the same.

**Grading rule (deterministic first, model second):**
- Source-class prior: SEC filings (10-K/10-Q/8-K) = material by default; news = judge-decided; roundup/comparison headlines (already filtered by isComparisonHeadline) never reach here.
- Judge field `materiality: 'material' | 'minor'` with definition: "material = would plausibly change the pillar's status or a reasonable holder's conviction; minor = context, incremental, or reiterates known state."
- Never null: default news→minor, filings→material when the judge omits the field.

**Schema:** same migration 055: `alter table pillar_evidence add column if not exists materiality text check (materiality in ('material','minor'));` Backfill: filings→material, news→minor (one UPDATE, honest approximation, no model spend).

**Where it bites:**
- Thesis page evidence list: filter chips [Material & above | All] — default Material.
- Brief/actions interlace: only material contradicting evidence may trigger the brief's thesis-alert line (today's noise-event guard becomes a materiality check — replaces heuristics).
- /masthead: material-only by default (raises public signal quality for the GEO play).
- Conviction math: contradicting-material counts 1.0, contradicting-minor 0.4 weight (exact weights behind one constant in financial-config; DO NOT silently change existing conviction outputs — feature-flag the reweighting, ship display first, reweight second after eyeballing deltas on the 18 tests).

**Tests:** grading defaults (filing→material, news→minor on omission); filter rendering; conviction unchanged while flag off.

**Effort:** shares migration with F1; prompt field + filter UI + masthead filter ≈ half a day. Reweighting = separate follow-up decision.

---

## Feature 3 — Holding-level "on balance" verdict chip + sentence

**What:** Per tracked thesis: a status chip — `Supported | Challenged | Mixed | Watching` — plus ONE auto-synthesized sentence: e.g. "On balance: the data-center pillar is strengthening while the margin pillar is being tested."

**Computation (pure, no model):** from existing pillar statuses/conviction in `lib/` (same primitive the Overview KPI and taxes chips consume):
- all pillars holding → Supported; ≥1 broke/contradicted-material → Challenged; both directions active → Mixed; insufficient evidence → Watching.
- Sentence assembled from pillar labels + directions via template ("X is strengthening", "Y is being tested", "no new evidence on Z this week"). Deterministic templates, not LLM — 18-tests style unit coverage, no spend, no hallucination surface.

**UI:** theses page card header (chip + sentence under title), analyze-page ThesisBridge ("Helm is watching — currently Challenged"), brief interlace reuses the sentence verbatim. Colors: existing status palette (green/red/gold), no new tokens.

**Tests:** pure-function table tests for all status combinations; sentence templates snapshot; empty-pillar theses → Watching.

**Effort:** ~3-4 hrs. Highest comprehension-per-line-of-code of the four. **Do this one first if sequencing solo.**

---

## Feature 4 — Thesis versioning

**What:** "Your thesis · v2 · edited Jul 15, 2026" provenance pill on thesis pages. Version bumps when the user materially edits (claim text or pillar add/remove/edit), not on agent evidence flow.

**Schema:** migration 055: `alter table theses add column if not exists version int not null default 1;` plus `alter table theses add column if not exists version_updated_at timestamptz;` Optional (defer): `thesis_versions` history table storing prior claim snapshots — NOT needed for the pill; add only when a diff view is wanted.

**Logic:** server actions that update thesis/pillar text increment version + stamp timestamp (single helper, called from the 2-3 mutation paths: builder edit, pillar confirm-with-edit, reassessment-accept). Agent-driven status changes do NOT bump.

**UI:** small mono pill next to thesis title; /masthead cards show "v{n}" subtly (public provenance = GEO trust signal).

**Tests:** edit bumps, evidence doesn't bump, new thesis = v1.

**Effort:** ~2 hrs.

---

## Cross-cutting

- **One migration (055)** carries F1+F2+F4 columns. All columns nullable/defaulted — zero backfill required to ship, zero breakage on old rows.
- **RIA posture:** gloss and sentences describe state, never prescribe action. Reuse the advice-language lint list from the systemic pass.
- **No new model spend:** F1+F2 ride the existing judge call; F3+F4 are model-free.
- **Rollout order:** F3 (verdict chip) → F4 (versioning) → migration 055 + F1/F2 together → conviction reweighting decision last, flag-gated.
- **Explicitly out of scope:** per-holding pricing/metering, thesis-only dashboards, any repositioning of thesis as the product (tissue rule), rewriting headlines themselves (we gloss beneath OUR verbatim quotes; we do not editorialize headlines like mythesis does — their approach loses source fidelity).
- **Success check:** demo-visible in the worklog/brief path within one session of shipping; /masthead cards gain gloss + materiality quietly (GEO freshness bump).
