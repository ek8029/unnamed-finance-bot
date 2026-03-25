# Landing Page Content Expansion — Design Spec

**Date:** 2026-03-24
**Page:** `/landing-test`
**Goal:** Add 4 new sections to fill critical CRO gaps (product visuals, onboarding clarity, trust/security, social proof) while maintaining the cinematic terminal aesthetic.

---

## Current State

The landing page has a strong hero ("STEER. DON'T DRIFT."), live metrics strip, feature data rows, strikethrough comparisons, and a terminal-prompt CTA. It lacks product visuals, onboarding explanation, security messaging, and social proof — all critical for a fintech product that connects to bank accounts.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Content strategy | "Conversion Funnel" ordering | Mirrors buyer mental journey: intrigue → understand → trust → act |
| Dashboard preview | Hybrid mockup + live API data | Feels alive; reuses existing `/api/metrics/platform` endpoint |
| How it works | Terminal command sequence | Reinforces "terminal" branding; avoids generic 3-circle pattern |
| Trust & security | Terminal audit log | Consistent metaphor; `$ helm security --verify` is distinctive |
| Social proof | Terminal session excerpts | Shows outcomes not quotes; honest for early-stage product |

## Section-by-Section Design

### Section 3: Dashboard Preview (NEW — after Metrics Strip)

**Heading:** "Your Command Center."

**Implementation:** A stylized HTML/CSS mockup of the Helm dashboard rendered inside a browser-chrome frame (traffic-light dots + title bar). The frame has a subtle gold glow border and enters with a perspective tilt on scroll (using the existing `TiltCard` component or similar transform).

**Content inside the mockup:**
- 3 stat cards in a row: Net Worth (gold, from API), Actions count, Tax Savings (green)
- A placeholder area representing the portfolio chart
- Month-over-month change indicator

**Data source:** Fetches from the existing `/api/metrics/platform` endpoint (already returns `totalNetWorth` and `totalUsers`). The mockup displays this live data rather than hardcoded values. Additional aggregate stats (like total accounts) can be added to the endpoint if needed, or use static values for non-sensitive metrics.

**Animation:** Fade-in on scroll with slight upward motion. Stats inside the mockup can use the existing `CountUp` component.

---

### Section 5: How It Works (NEW — after What Helm Watches)

**Heading:** "Get Started."

**Implementation:** A single terminal-styled block with three lines that type in sequentially on scroll-reveal using the existing `TypingText` component or a staggered `FadeIn`.

**Content:**
```
→ helm connect  — link bank, brokerage, crypto via Plaid (90s)
→ helm analyze  — 7 engines scan positions, tax, risk, cash flow
→ helm act      — prioritized actions land in your inbox daily
```

**Styling:** Dark background (`rgba(10,10,10,0.8)`), 1px border (`rgba(255,255,255,0.06)`), rounded corners. Gold arrows (`→`), green command names, muted descriptions. Same terminal block styling used in the final CTA section.

**Animation:** Each line fades/types in with a staggered delay (e.g., 200ms between lines) triggered by scroll intersection.

---

### Section 7: Trust & Security (NEW — after Before Helm)

**Heading:** "Security."

**Implementation:** Terminal-styled block with a "command" header and 5 verification checkmarks.

**Content:**
```
$ helm security --verify

✓ read-only access       — cannot move money or execute trades
✓ AES-256 encryption     — bank-level, in transit + at rest
✓ plaid infrastructure   — same provider as Venmo, Robinhood, Coinbase
✓ zero data selling      — your data is never sold or shared. ever.
✓ full data deletion     — delete everything, anytime, no questions

All checks passed. System secure. ●
```

**Styling:** Same terminal block as "How It Works." Green checkmarks (`✓`), gold key phrases, muted descriptions. The `$ helm security --verify` line and closing `All checks passed.` line are at reduced opacity.

**Animation:** The `$` command types in first, then each `✓` line appears sequentially with a short stagger (150-200ms), simulating a real verification process. The closing line fades in last.

---

### Section 8: Social Proof — "What Helm Found." (NEW — after Trust & Security)

**Heading:** "What Helm Found."

**Implementation:** 2-3 terminal-styled blocks, each representing an anonymized "session excerpt" from an early-access user. Each block shows 2-3 specific outcomes Helm detected.

**Content (block 1):**
```
// session — early access user
→ flagged $2,847 tax-loss harvest in VXUS position
→ detected 38% concentration in single sector (tech)
→ surfaced $340/mo subscription creep — 3 flagged
```

**Content (block 2):**
```
// session — early access user
→ identified $1,200 dividend income not accounted for in planning
→ alert: AAPL earnings in 3 days — 34% of portfolio exposed
```

**Styling:** Same terminal blocks but slightly differentiated — each block has its own border. Gold arrows, green for dollar amounts/positive outcomes, gold for risk warnings, muted for context.

**Animation:** Blocks stagger in on scroll (first block, then second with a 200ms delay).

---

### Page Flow (Complete)

1. **Hero** — "STEER. DON'T DRIFT." (existing)
2. **Metrics Strip** — live net worth, accounts, engines, status (existing)
3. **Dashboard Preview** — hybrid mockup with live data (NEW)
4. **What Helm Watches** — 3 horizontal data rows (existing)
5. **How It Works** — terminal command sequence (NEW)
6. **Before Helm** — strikethrough comparisons (existing)
7. **Trust & Security** — terminal audit log (NEW)
8. **What Helm Found** — terminal session excerpts (NEW)
9. **Final CTA** — terminal prompt email input (existing)
10. **Footer** — enhanced (existing)

### Visual Rhythm

The page alternates between section types to avoid monotony:
- Cinematic → Strip → **Mockup frame** → Data rows → **Terminal** → Comparisons → **Terminal** → **Terminal** → CTA prompt

The only back-to-back terminal pair (Security → What Helm Found) is acceptable because they use different content patterns (checkmarks vs session logs) and can be separated by a gold divider if needed during implementation.

## Components to Build

| Component | Description | Reuses |
|-----------|-------------|--------|
| `DashboardMockup` | Browser-frame wrapper + stat cards with live data | `CountUp`, `FadeIn`, API fetch |
| `TerminalBlock` | Reusable styled terminal container | New, but styling matches existing CTA |
| `TerminalSequence` | Staggered line reveal inside a TerminalBlock | `FadeIn` or `TypingText` |

## API Changes

The existing `/api/metrics/platform` endpoint already returns `totalNetWorth` and `totalUsers`. No new endpoints are required. If we want to show "total accounts monitored" in the dashboard mockup as a live number, we'd add a count query to the existing endpoint — but this is optional and can use a static value instead.

## Out of Scope

- Real screenshot capture or screenshot pipeline
- FAQ/objection handling section (can be added later)
- Footer enhancement (links, legal, social) — separate task
- Nav link destinations — separate task
- Pricing section — not needed at this stage
