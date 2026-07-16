# Thesis-tracking SEO sprint (mythesis response) — drafted 2026-07-16

Context: mythesis.ai launched live w/ Instagram ads ($49.99/mo=5 holdings, $89.99=10, $199.99=25; thesis-only, no aggregation, no verbatim source quotes). Their ad spend educates the category; the "mythesis alternative" shelf is empty. Also live: thesisai.app (invite MVP, thesis GENERATION), subthesis.app (thesis journal). Existing Helm assets: /thesis-monitoring hub, /best-thesis-trackers (compares Helm/Vela/UseThesis/ThesisWatch — claims re-verified accurate 7/14), /vela-alternative, /usethesis-alternative, thesis-drift + how-to-track blogs, /thesis-risks/[ticker], /masthead.

## 1. /best-thesis-trackers — add mythesis row (facts verified 7/14)
- Status: LIVE (only live paid competitor; others waitlist/invite/journal)
- Pricing: $49.99/mo for 5 holdings, $89.99/mo for 10 ("most popular"), $199.99/mo for 25, free = 1 holding. PER-HOLDING METERING — the attack surface.
- Features: thesis status chip (Challenged/Supported), per-pillar breakdown, alert feed w/ Material/Minor severity, rewritten second-person headlines, versioned thesis (v1).
- Gaps (honest, verifiable): no brokerage aggregation (manual holdings only), no tax layer, no concentration/earnings scans, no daily brief, alerts cite source NAME but no verbatim quotes, no public receipts page.
- Helm cells: whole-book agent, unlimited holdings on flat tiers, verbatim SEC/news quotes, public /masthead log.
- Keep tone: honest comparison, "good fit if you want a dedicated thesis alert tool and hold few positions."

## 2. NEW /mythesis-alternative page (BoFu, house style like /vela-alternative)
- H1: "Looking for a mythesis.ai alternative?"
- Angle 1 — per-holding math: watching 25 holdings = $199.99/mo there; Helm watches the whole book on flat pricing. Table: 5/10/25/40 holdings cost comparison.
- Angle 2 — thesis alerts are one layer: Helm runs thesis monitoring INSIDE an agent that also does taxes (TLH), concentration, earnings, daily brief across every brokerage via Plaid.
- Angle 3 — receipts: their alerts say "AP News"; Helm quotes the filing verbatim with a link (show a real /masthead entry inline).
- FAQ JSON-LD (5 Qs: is there a free mythesis alternative / mythesis vs helm / does helm track theses / how many holdings / does helm connect brokerages). CTA → /analyze + /masthead. Sitemap + llms.txt entries.

## 3. Blog drafts (house format: frontmatter, 5 FAQ, 2 CTACard, comparison table, 4 related links, NO em dashes, no external links)
**A. "Thesis tracking apps in 2026: the honest landscape"** — target kw: "thesis tracking app", "investment thesis tracker" (category is being ad-educated NOW). Covers all 4 players + Helm honestly; positions per-holding pricing vs whole-book; links comparison + hub + masthead. ~1,400 words.
**B. "Why your investment thesis needs receipts, not just alerts"** — target kw: "investment thesis alerts", differentiator essay: severity-tagged alerts vs verbatim-quoted evidence; features /masthead entries as worked examples (AAPL/PLTR); soft-attributed stats only. ~1,100 words.
- Both: soft CTA to /thesis-monitoring hub; interlink with thesis-drift + how-to-track posts.

## 4. llms.txt: add mythesis/thesisai/subthesis comparison line to thesis-monitoring section so AI answers comparing tools cite the comparison page.

## 5. Measure: GSC queries "mythesis" 2wks post-index; PostHog signups w/ referrer from the 2 new pages.

## Platform usage companion (separate build, spec exists in 2026-07-15-thesis-alert-upgrades.md):
auto-draft-on-connect (top-3 holdings, confirm-one-tap) + Email B thesis line + newsletter "From the Masthead" slot + PostHog funnel watch on batch-2 cohort Monday.
