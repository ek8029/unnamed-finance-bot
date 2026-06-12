# Thesis Layer — UI Design Brief

For: Claude design session. Scope: UI only — data pipeline is specced separately.
Date: 2026-06-11. Ship target: ~June 24 (local testing only; NO production push without Evan's explicit go).

## Product context

Helm Terminal is pivoting its core around an agentic thesis-research layer: users state *why* they own each position as short claims ("pillars"), and Helm perpetually scans filings/news/prices and surfaces only what changes those claims — with proof. Investor feedback driving this (Danny, Mucker Capital): "retail investors" too broad as ICP, daily brief + raw news articles = noise, wants thesis-based continuous research surfacing insights tied to positions. North star sentence: **"Helm reads every filing and headline on your positions and tells you only when something changes the reason you own them — with proof."**

Anti-goal: must never feel like an LLM wrapper or a form-builder. No chat box. No dropdown mad-libs thesis builders.

## Design system (existing — do not invent new tokens)

- BG `#060606`, gold `#E6B94D`, green `#4ADE80`, red `#F87171`
- Fonts: Manrope (sans), Space Grotesk (mono), Instrument Serif (display accents)
- Existing CSS vars: `--color-bg-base`, `--color-bg-surface`, `--color-border-base`, `--color-border-subtle`, `--color-text-primary`, `--color-text-muted`, `--color-gold`, `--color-positive`, `--color-negative`
- Dark, dense, terminal aesthetic. Tabular-nums everywhere numbers appear. Existing dashboard patterns: bordered `bg-surface` cards, 11px mono uppercase tracking-wide labels.

## Core objects

**Pillar** — one plain-English sentence the user owns. e.g. "Datacenter capex supercycle has 2+ years of runway."
- Status chip (system-derived, never LLM-declared): `intact` (green) / `weakening` (gold) / `broken` (red) / `unverified` (muted)
- Origin: AI-drafted (arrives ghosted/unconfirmed, labeled "drafted from your holdings") or user-written. Nothing is "your thesis" until accepted, rewritten, or replaced. User can delete all drafts and write from blank — equally first-class.
- System NEVER edits a confirmed pillar. Re-drafts only on explicit "re-suggest" action.
- 2-4 pillars per holding typical. Plus one optional freeform unscored "notes" textarea per holding (narrative; future extraction input).

**Evidence item** — attached to a pillar, never freestanding. Schema (mandatory slots):
1. **What** — the fact, with quoted excerpt from source
2. **Why** — causal link to this specific pillar
3. **What it means** — verdict (`supports`/`contradicts`/`neutral`) + materiality tag (`material`/`context`) framed against the user's actual position size
4. **What to consider** — OPTIONAL, only when a genuine action exists (TLH window, thesis broken, concentration breach). Most items have none — deliberate. (Future: this slot becomes an approve-action button.)
- Citation = footnote under the item (source name, date, link icon), never the headline.
- Sources: SEC filings (10-K/Q, 8-K), Form 4 insider transactions ("CFO sold $4.2M" is exactly thesis-grade), filtered news, >5% price moves. Backfilled items labeled "historical context."

## Surfaces to design

### 1. The Current (daily brief) — new top-of-page hierarchy
Order: **macro strip → thesis intelligence block → existing watchlist tape**. Headline lists are removed from The Current entirely.

- **Macro strip:** 0-2 items max, only true market-movers (war, Fed, CPI shocks). Format: event → *your* portfolio exposure → materiality. Absent entirely on quiet days.
- **Thesis Intelligence block:** hard cap 3 items/day, ranked by materiality × position weight. Each item = the 4-slot schema above, pillar named, ticker chip, status-change visual if pillar flipped.
- **Quiet state is the hero state:** "All 12 pillars intact across 6 positions. Nothing material since Tuesday." + "last scanned" timestamp (trust element — proves vigilance, sells the absence of noise). Design this state as carefully as the active one.

### 2. Holding detail — "Why I Own This" section
- Pillar list: sentence + status chip + evidence count. Inline edit (click to edit text directly — it's a sentence, not a form). Add pillar = empty text input, nothing else.
- Unconfirmed AI drafts: ghosted treatment, accept (✓) / edit / dismiss (×) per pillar, plus one "accept all."
- Per pillar, expandable evidence timeline (newest first): 4-slot items, materiality tag, citation footnote. Neutral verdicts hidden behind "show all evidence."
- Status transitions explained on hover/tap ("2 contradicting filings within 30d → broken"). User override: "keep intact — I disagree" (autonomy; logged).
- Notes textarea: collapsed by default, "Your notes (not scanned)".

### 3. Gating states
- Free tier: 1 tracked thesis (suggest: defaults to largest holding). Other holdings show seeded ghost pillars + lock treatment with upgrade prompt ("Track all 6 positions — Pro"). Demo must stay visible/tantalizing, not hidden.
- Pro: unlimited.

## Copy rules (hard)
- No em dashes in UI copy. No invented percentages or confidence scores, ever. Qualitative tiers only (`material`/`context`).
- Never imply data we lack: no "beat expectations" (no consensus data) — compare vs company's own prior periods only.
- Verdict language: declarative, sourced, calm. "Q1 10-Q: datacenter revenue +112% YoY" not "Huge quarter!!"
- Silence framing: positive, not empty. "Nothing threatens your theses today" beats "No new items."

## Feel
Bloomberg-grade restraint, not AI-product exuberance. The user should feel: *someone competent read everything overnight and left me only what matters, with receipts.* Density over decoration. Gold reserved for emphasis/CTAs; green/red strictly for direction/verdicts.
