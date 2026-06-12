# LLM Council Verdict — Thesis Layer Iteration

Date: 2026-06-11. Subject: full iteration — Danny's (Mucker Capital) feedback, thesis-layer pivot, design, ICP, timeline. Five advisors (Contrarian, First Principles, Expansionist, Outsider, Executor) + anonymized peer review + chairman synthesis.

## Where the Council Agrees
- **2/49 Plaid connections is the elephant.** Activation/trust is the binding constraint; thesis layer as originally specced sat behind a wall 96% of signups never cross. (Resolved: spec amended — theses are Plaid-optional, attach to manual portfolio holdings too.)
- **Trust mechanics are genuinely right.** Verbatim citations, rules-derived status, quiet-state-as-hero got unanimous credit. Design sound.
- **"CFO sold $4M" is the killer artifact.** Outsider: "the first thing I'd screenshot and text a friend."
- **Danny is an N-of-1 confound** — flagged by every advisor. (Evan's ruling, 2026-06-11: at pre-seed stage, tailoring to investor vision is priority #1, seconded only by user maintenance + bug fixes. Capital extends runway. Critique stands only where it threatens demo credibility.)

## Where the Council Clashes
- **Build-first vs validate-first.** Executor + Expansionist: ship. Contrarian/First-Principles/Outsider: 10 user calls first; "validation scheduled after the build is the tell." Resolution: build AND run ICP calls in parallel this week — nailing ICP was Danny's ask #1, so calls ARE tailoring to Danny.
- **ICP contradiction.** RSU holders are stock receivers, not pickers — their thesis is inertia. Counter: concentrated holders' real need is "don't get blindsided"; RSU pillar = "no reason to diversify yet," evidence against it is the product.
- **$4.99 consumer vs $500/seat pro.** Expansionist: professional tool in consumer costume — RIAs/family-office analysts/fund juniors maintain thesis docs in Notion and get blindsided by Form 4s. Retail is the demo, pro is the business. Use as TAM trajectory on the Danny call; don't pivot now.

## Blind Spots Caught (peer review round)
1. **10b5-1 false positives kill the product.** Most $4M CFO sales are scheduled-plan noise. One wrong "thesis broken" on a routine Form 4 destroys credibility — Danny will run this on his own portfolio and spot it instantly. (Resolved: spec amended — Form 4 parser reads 10b5-1 checkbox/footnotes; scheduled sales default to `context` materiality, can never alone flip status.)
2. **Nobody priced Danny's actual commitment.** "Show me another iteration" costs him nothing; modal pre-seed outcome is a pass even on a great demo. Build is rational because it's dual-use (right product direction regardless).
3. **Manual entry dissolves the activation wall.** Manual portfolio already shipped (migration 037). (Resolved: spec amended.)
4. **Decouple scoring from the 60s cron day one.** LLM scoring latency doesn't fit even at current scale. (Resolved: spec amended — separate `score-theses` route fired by daily cron.)
5. **Founder = permanent on-call QA for every verdict.** Hand-verifying citations doesn't scale past demo phase; acknowledge as demo-phase-only.
6. **Serial sprint-to-audience pattern.** Wrapped → homepage rewrite → thesis layer, each built to impress an audience; no kill-criteria closing prior loops (what happened to Wrapped virality / SEO moat hypotheses?). Process risk, not product risk.
7. **Deliverable format unexamined.** Investor who builds his own tooling may be equally impressed by clickable prototype + user-call transcripts as by fragile live build.
8. **Scanning loop unit economics unpriced.** Per-user-per-day LLM + EDGAR cost at 50 users × 10 theses on $110/mo budget — check before scale.

## The Recommendation
Build it, amended (all spec amendments applied, commit b2509c6):
1. 10b5-1 handling in Form 4 parsing — mandatory
2. Theses work on manual portfolios, not just Plaid
3. Scoring decoupled from daily cron from day one
4. ICP calls (5-10 RSU holders) run in parallel this week, not post-ship — show up to the Danny call with "talked to 8 RSU holders, here's what they said"
5. Frame pro-tool trajectory ($500/seat RIA/analyst market) as TAM story on the call

## The One Thing to Do First
**EDGAR Form 4 spike:** parse 12 months of Form 4s for one real holding end-to-end, including the 10b5-1 flag. One day validates the only unknown-difficulty tech AND the false-positive killer before any UI exists.
