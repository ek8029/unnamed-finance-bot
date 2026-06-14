# Helm Terminal - Mucker Reference

Last updated: June 14, 2026

This is a living reference for the Mucker conversation. It captures what Helm is, what we have built, the traction story, the wedge, and the roadmap. It is updated as the product moves.

---

## The one-liner

Helm Terminal is institutional-grade portfolio intelligence for self-directed individual investors. Not a budgeting app. Not a portfolio tracker. An intelligence layer over the money you already have, that watches the things that actually matter to your positions and tells you what changed and what to consider.

---

## The wedge

There are three existing categories, and a gap between them:

- **Passive trackers and net-worth apps:** aggregate your accounts, show you a number. No intelligence.
- **AI advisory platforms (for example Astor):** connect via Plaid, send filtered market updates and personalized ideas against stated goals.
- **Robo-advisors:** full black-box automation toward a preset allocation. No transparency, no agency.

Helm's wedge is the transparent full stack between advisory and robo. We provide intelligence, agency, and eventually transparent, human-approved action, while always showing the work: here is what happened, here is why, here is what we recommend, here is exactly how it would be done. You approve every step.

- **Versus robo:** transparency and user agency. Non-discretionary by design. The user approves each action, which is a lighter regulatory posture (the robo gap is discretion).
- **Versus advisory tools:** we go further toward transparent, grounded action, and we never fabricate. Every claim traces to a real source quote.

---

## The ICP

Danny's first ask was to nail the ICP, because "retail investors as a whole" is too broad. The honest answer is behavioral, not demographic.

**Narrow wedge (who we lead with):** informed, self-directed investors who have outgrown trading apps. They hold conviction positions across more than one brokerage, they have theses (stated or not) for why they own what they own, and they want the noise filtered and the signal that matters to their specific positions surfaced. They are closer to the high end of "informed retail."

**Proof point:** our first two real users are Edward Jones financial advisors using Helm for their personal books. They have access to the most up-to-date professional information and still could not find a tool like this. That is the top decile of informed retail telling us the gap is real.

**Broad vision (TAM):** all self-directed retail. The end-state Helm generates defensible enough theses to keep any investor perpetually informed about what matters to their holdings, drowns out the noise, and offers human-approved action. The wedge is narrow on purpose; the vision is not.

---

## Traction and how we got it

- ~49 signups, 2 paying, about $20 MRR. Pre-seed, solo founder. Monthly costs about $110.
- **The acquisition story is the interesting part.** Ben, our first real user, found Helm cold because Claude and other AI search surfaces cited it. He is an Edward Jones advisor, not in our network. He then referred Noah, the second user, who paid $4.99 himself.
- That is an **AI-citation acquisition channel plus a referral loop**, validated by exactly the informed-retail persona we want. A meaningful share of natural traffic comes from SEO and GEO (AI answer engines citing us).
- SEO and GEO moat: 510+ AI analysis pages, 30 compare pairs, free calculators, persona pages, llms.txt. This is why an AI assistant recommends Helm.

---

## What is shipped: the intelligence layer

The substrate the whole product stands on. Built and live on the working branch.

- **Aggregation:** Plaid (production), read-only, across 12,000+ institutions. Helm can never trade or move money.
- **Theses and pillars:** the user states why they own each position as structured "pillars" (one claim each).
- **Daily evidence pipeline:** for each pillar, the system gathers SEC filings, Form 4 insider activity, XBRL financials, news, and price moves, then judges each source against the pillar.
- **Grounded, no-fabrication discipline:** every piece of evidence carries a verbatim quote from the real source. A hard guard drops anything that cannot be quote-matched. We do not paraphrase facts into existence.
- **Honest status:** each pillar derives a rule-based status (intact, weakening, broken). Breaking requires convergence (independent material contradictions with a primary source), or a single severe primary event (for example a 20%-plus adverse move or withdrawn guidance).
- **Conviction history:** an honest 14-day replay reconstructs status as of each past date from the true publish dates, so the trend is real, not hindsight.
- **Cross-thesis synthesis:** finds hidden concentration where pillars from different tickers depend on the same underlying driver.

---

## What is new: the agentic layer

Danny's second ask was a vision for an agentic intelligence layer that does research against your theses. We have now built the first version, as four composable pipelines. This is the 24/7 on-demand analyst over the interaction of the market, your portfolio, and your theses.

**Architecture principle:** every capability is a composable pipeline (a callable tool with clean inputs and outputs), not a one-off feature welded into a screen. The platform turns agentic when a reasoning loop orchestrates these tools. We are building the tools first, deliberately, then the loop.

**Feature 1 - Reasoned actions.** For each broken or weakening pillar, Helm produces a grounded, non-discretionary action: consider trimming, or harvest the loss for a tax benefit, or keep monitoring. Each is grounded in the real evidence and joined to your actual position (a loss becomes a tax-loss-harvesting suggestion; a gain becomes a trim). Nothing is executed. You decide.

**Feature 2 - Triggered investigation.** A real event (a severe drawdown, a new filing, a pillar breaking) triggers a grounded "what happened and why," linking the event to the affected pillars. Diagnosis, not just an alert. Example live in the demo: a position fell 28.7% in a day, and Helm tied the move to the energy-segment revenue miss and the solar-execution problems, and showed which pillars broke and which weakened.

**Feature 3 - Cross-thesis risk monitor.** The active version of the synthesis. When several theses ride the same underlying driver and that driver moves, Helm flags the shared exposure that you cannot see one position at a time. Neutral language, never advice.

**Feature 4 - Proactive daily brief.** The morning read, composed from thesis state: what moved against your theses in the last 14 days, what is intact, what needs a look. Honest framing, grounded in the real record.

**Guardrail that makes it fundable:** every action is non-discretionary. We recommend, the user approves, nothing is auto-executed. That keeps the regulatory posture light (per-trade consent sidesteps the discretion that defines a robo-advisor) until and unless we choose to register.

---

## The "just paste it into Claude" objection

The honest answer is durable, not dismissive.

- **Persistent grounded state.** A chat has no memory of your positions, your stated theses, or the record over time. Helm holds the structured thesis, watches it daily, and keeps an honest history. The value is the standing system, not a one-off answer.
- **The join.** The differentiated output comes from joining the market, your real portfolio (via Plaid), and your specific theses. A chat has none of those connected and current.
- **No fabrication by construction.** Helm's discipline is that every claim is quote-matched to a real filing or article. A general chat will confidently invent. For money, that difference is the product.
- **Distribution and trust.** The same AI surfaces that could substitute for us are currently the channel that recommends us. We are compounding a grounded data and provenance moat while that holds.

---

## Roadmap

- **Now:** let the four pipelines run for several days, gather real data, and watch how they behave before adding orchestration.
- **Next (post demo / fall runway):** the orchestration loop that composes the four tools into a true agentic analyst. Then a learning layer that infers the user's profile from what they accept, dismiss, and act on.
- **Later (deferred, regulation-heavy):** transparent execution. This is where registration and licensing enter, so it is intentionally last.

---

## The ask

$500K pre-seed. Building the intelligence and agentic layer that turns aggregation into a standing analyst for informed self-directed investors, with a validated AI-citation acquisition channel and the regulatory discipline to go further than advisory tools without becoming a robo.

---

## Quick facts

- Product: Helm Terminal, helmterminal.dev
- Founder: Evan Kim, solo, pre-seed
- Stack: Next.js, Supabase (Postgres, RLS), Plaid (production), SEC EDGAR plus market-data vendors, OpenAI for scoring and synthesis
- Incorporation: Helm Financial, Corp., Delaware C-corp
- Mucker: partner Danny, second call early July, fall applications close August 14
