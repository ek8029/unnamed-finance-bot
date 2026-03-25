# Helm Terminal: 90-Day User Acquisition Playbook

**Product:** helmterminal.dev — Institutional-grade financial intelligence terminal for individuals
**Target:** Founders, engineers with RSUs, finance professionals, HNW individuals
**Date:** March 25, 2026

---

## 1. Channel Prioritization Matrix

Ranked by expected ROI for Helm's specific audience and current product state.

| Rank | Channel | Effort | Cost/mo | Expected Yield (90d) | Time to Impact | Why |
|------|---------|--------|---------|----------------------|----------------|-----|
| 1 | **SEO — /analyze pages** | M | $0 | 2,000–5,000 visits/mo | 4–8 weeks | You already have dynamic `/analyze/[TICKER]` pages with OG tags. Every US stock is a landing page. This is your compounding moat. |
| 2 | **Organic X/Twitter** | M | $0 | 500–2,000 waitlist | 1–2 weeks | Fintwit is *the* audience. Terminal screenshots + hot-take analysis threads convert immediately for this demographic. |
| 3 | **Product Hunt launch** | L | $0 | 1,000–3,000 signups (spike) | 1 day (plan 3 weeks) | One-shot but high-intent. Terminal-aesthetic products crush PH. Time this with a feature milestone. |
| 4 | **LinkedIn organic** | M | $0 | 300–1,000 waitlist | 2–4 weeks | Founders and finance professionals live here. "I built X" founder journey posts + financial intelligence content. |
| 5 | **Hacker News / Show HN** | S | $0 | 500–2,000 signups (spike) | 1 day | Perfect audience fit. Engineer who built a personal Bloomberg. Time it with a technical blog post. |
| 6 | **SEO — Blog content** | M | $0 | 1,000–3,000 visits/mo | 6–12 weeks | Already have 2 posts ranking for high-intent terms. Scale to 8–12 posts. Each one is a permanent acquisition channel. |
| 7 | **Reddit (r/fatFIRE, r/investing, r/startups)** | S | $0 | 200–800 waitlist | 1–2 weeks | The audience literally self-selects into these communities. Must be authentic (share real analysis), never promotional. |
| 8 | **Referral loop optimization** | M | $0 | 15–30% boost on all channels | 2–4 weeks | You have the referral infra. It's under-incentivized. Fixing the reward structure is a force multiplier. |
| 9 | **Cold outreach to fintech newsletters** | M | $0 | 500–2,000 signups per feature | 3–6 weeks | Lenny's Newsletter, The Pragmatic Engineer, TLDR Finance all cover tools like this. One feature = massive spike. |
| 10 | **Paid — X/Twitter ads** | S | $500–1,500 | 200–600 signups | 1 week | Only after organic establishes messaging. Use /analyze screenshots as creative. Retarget /analyze visitors. |

**What NOT to do (yet):** TikTok/YouTube (wrong audience density, high effort), Google Ads (CPCs for finance keywords are $5–15, premature), Facebook/Instagram (audience mismatch), podcast sponsorships (expensive, hard to measure).

---

## 2. Week-by-Week 90-Day Plan

### Phase 1: Foundation (Weeks 1–4)

#### Week 1 — SEO Infrastructure + Social Launch

**SEO / /analyze:**
- Generate a sitemap that includes `/analyze/AAPL`, `/analyze/MSFT`, etc. for the top 200 US stocks by market cap. Right now you have 8 popular tickers hardcoded; Google can only discover pages that are linked. Create an `/analyze/all` or `/analyze/stocks` index page with links to every ticker.
- Add JSON-LD `FinancialProduct` structured data to each `/analyze/[ticker]` page. Google surfaces rich results for financial queries.
- Add internal links from each analysis page to related tickers (same sector, same market cap band). You currently show 6 popular tickers — replace with "Similar companies" based on sector.
- Write unique meta descriptions per ticker page using the company name and sector, not just "AI-powered analysis of {TICKER}."

**Content:**
- Publish blog post #3: "How I'd Manage a $500K RSU Portfolio in 2026" (targets engineers at FAANG, the exact ICP).
- Publish blog post #4: "The Weekly Financial Review Most People Skip (And Why It Costs Them Thousands)" (targets the core product value prop).

**Social — X/Twitter:**
- Create the @HelmTerminal account if not exists. Bio: "Institutional-grade financial intelligence. For individuals. Free stock analysis: helmterminal.dev/analyze"
- Post 1: Screenshot of a real /analyze report for NVDA with the caption: "We built a free stock analysis tool that gives you what Bloomberg charges $24K/year for. No signup required. helmterminal.dev/analyze/NVDA"
- Post 2: Thread — "I spent [X months] building a personal Bloomberg Terminal. Here's what I learned about what individual investors actually need vs. what Wall Street sells them." (5–7 tweets, end with CTA to /analyze)
- Post 3: Screenshot of the Helm dashboard with the caption: "Your brokerage shows you what happened. Helm tells you what it means. Join the waitlist."

**Product:**
- Add "Share this analysis" buttons (X, LinkedIn, copy link) to every `/analyze/[ticker]` result page. The `shareOnX` function exists in the client component but only shows after gate. Move share buttons to be visible for ALL users, gated or not, positioned above the fold.
- Add `?utm_source=share&utm_medium=twitter` to all shared URLs so you can track viral coefficient.

#### Week 2 — Referral Loop + Community Seeding

**Referral:**
- Implement the referral reward: "Refer 3 friends, skip to the front of the waitlist." The current system tracks `referral_count` and `position` but the position never changes. Build the position-bumping logic.
- Add a post-signup referral reminder email (if you have email infra via Supabase or Resend). Subject: "You're #[position] on the Helm waitlist. Here's how to skip ahead."
- Add referral count to the waitlist success state with a progress bar: "2 of 3 referrals — 1 more to unlock priority access."

**Social — X/Twitter (3–4 posts/week ongoing):**
- Post: Run /analyze on whatever stock is in the news that day (earnings, crash, acquisition). Screenshot the result. "Here's what Helm's AI thinks about $TSLA after today's earnings miss." This is reactive content — fast, relevant, high engagement.
- Post: "Most people's entire financial life is split across 4–7 apps. Your brokerage. Your bank. Mint (RIP). A spreadsheet. An advisor you email quarterly. Helm connects them into one intelligence layer."
- Engage with 10 fintwit accounts daily (reply to finance content with genuine insight, not promo).

**Community:**
- Post in r/fatFIRE: "I built a tool that automatically detects tax-loss harvesting opportunities across your entire portfolio. Open to feedback from this community." (Link to /analyze and the TLH blog post, not the homepage.)
- Post in r/ExperiencedDevs or r/cscareerquestions: "For those of you with RSU-heavy compensation, what tools are you using to track your overall financial position? I've been building something for this exact problem."

**SEO:**
- Submit sitemap to Google Search Console. Request indexing for the top 50 /analyze pages.
- Add FAQ schema to /analyze and /pricing (you already have it on /pricing — replicate pattern).

#### Week 3 — Content Scaling + LinkedIn

**Content:**
- Blog post #5: "NVDA Stock Analysis: What the Numbers Actually Say" — an SEO-optimized deep dive using real /analyze output. Target keyword: "NVDA stock analysis 2026." This pattern can be repeated for any high-search-volume ticker.
- Blog post #6: "How to Read a Stock Analysis Like a Professional" — educational content that naturally links to /analyze as the tool. Target: beginners searching "how to analyze stocks."

**LinkedIn:**
- Post 1: Founder story. "I used to pay $200/month for [financial tool]. Then I realized I was paying for data I could get for free and missing the analysis that actually mattered. So I built Helm." Include 2 dashboard screenshots.
- Post 2: "The 3 numbers that matter most in your financial life (and why your bank doesn't show you any of them)." End with CTA to helmterminal.dev.
- Connect with 20 people/day in target segments (founders, VPs of Eng at FAANG, CFOs, financial advisors who serve HNW clients).

**Product:**
- Add an OG image generator for /analyze pages. When someone shares `helmterminal.dev/analyze/AAPL` on Twitter/LinkedIn, the preview image should show the ticker, price, and Helm's verdict (bullish/bearish/neutral). This is a massive multiplier on social sharing. Use `@vercel/og` or `satori` — it works natively in Next.js App Router.

#### Week 4 — Newsletter Outreach + Consolidation

**Outreach (send pitches this week):**
- **TLDR Newsletter** — Pitch: "Helm Terminal — Bloomberg Terminal for individuals. Free AI stock analysis for any ticker, no signup." Angle: the /analyze tool is the hook.
- **The Pragmatic Engineer** — Pitch: angle for engineers managing RSU-heavy comp packages. "First tool that actually treats personal finance like a system, not a budget."
- **Fintech Takes** — Pitch: product teardown angle. The terminal-first, intelligence-first approach vs. the Mint/budgeting-app approach.
- **Hacker Newsletter** — Submit the "I built a personal Bloomberg" blog post (write it this week if not yet done).
- **Ben's Bites / AI-focused newsletters** — Pitch the AI analysis engine angle.

**Metrics checkpoint (end of Week 4):**
- Target: 500+ waitlist signups, 2,000+ /analyze page views, 50+ backlinks to helmterminal.dev.
- Measure: referral rate (% of signups that share), /analyze to waitlist conversion rate, top referring channels.

---

### Phase 2: Amplification (Weeks 5–8)

#### Week 5 — Product Hunt Prep

**Product Hunt:**
- Lock in a hunter. Reach out to top PH hunters (Chris Messina, Kevin William David, etc.) 2 weeks before launch. DM on X with a short demo video or Loom.
- Prepare assets: tagline ("Bloomberg Terminal energy for your personal finances"), 6 product screenshots (dark mode dashboard, /analyze report, intelligence feed, portfolio view, actions inbox, mobile view if responsive), a 60-second demo GIF.
- Draft the PH description. First line: "Helm is an institutional-grade financial intelligence terminal for individuals." Include the free /analyze tool prominently — it's the no-friction hook.
- Set the launch date for Week 7 (Tuesday or Wednesday, 12:01 AM PT).

**Content:**
- Blog post #7: "The Real Cost of Not Monitoring Your Portfolio" — data-driven piece with specific dollar amounts lost to concentration risk, missed TLH, etc. Heavy CTA to sign up.
- Blog post #8: "[Top Trending Ticker] Deep Dive" — timely analysis post, SEO-optimized.

**Social:**
- Start a weekly "Helm Weekly Scan" thread on X. Every Monday: "This week's Helm scan across the S&P 500. Here's what stood out:" followed by 3–4 interesting findings from /analyze. This becomes a recurring content format people follow for.
- Share /analyze results for any stock that has a major earnings event that week. Tag the $TICKER cashtag.

#### Week 6 — Hacker News + Technical Content

**Hacker News:**
- Publish a technical blog post: "Building a Real-Time Financial Intelligence Engine with Next.js, Supabase, and Polygon.io" — genuine technical deep dive. Submit to HN as "Show HN: I built a personal Bloomberg Terminal."
- Engage authentically in comments. HN rewards technical depth and honest discussion of tradeoffs.

**SEO:**
- Expand the /analyze stock index to top 500 tickers. Add sector-based index pages: `/analyze/sector/technology`, `/analyze/sector/healthcare`, etc.
- Publish 2 more ticker-specific SEO blog posts targeting mid-volume keywords (e.g., "PLTR stock analysis," "SOFI stock analysis").

**Referral:**
- A/B test referral incentive messaging. Test "skip the line" vs. "unlock Pro features early" vs. "get [X] free months of Pro."

#### Week 7 — Product Hunt Launch Week

**Monday (day before):**
- Tease on X and LinkedIn: "Tomorrow we're launching Helm Terminal on Product Hunt. An institutional-grade financial intelligence terminal — for individuals, not institutions. Free stock analysis for any ticker. More details at midnight PT."
- Email the waitlist: "We're launching on Product Hunt tomorrow. Your support would mean everything. Here's the link: [upcoming page]. We'll also be giving early access to our top supporters."

**Tuesday (launch day):**
- Launch at 12:01 AM PT. First comment: detailed founder story + why you built this + what makes it different.
- Post on X every 2–3 hours with different angles (the free /analyze tool, the dashboard, the intelligence engine, a testimonial if you have one).
- Post on LinkedIn, Reddit (r/startups, r/SideProject, r/fintech), and Indie Hackers.
- Respond to every PH comment within 30 minutes.

**Rest of week:**
- Ride the PH traffic. Make sure /analyze has zero friction and loads fast. This is the first impression for 1,000+ potential users.
- Send a "thank you" email to everyone who signed up via PH with their waitlist position and referral code.

#### Week 8 — Post-Launch Optimization

**Data analysis:**
- Audit PH launch data. Which angles resonated? Which screenshots got the most engagement? What did commenters ask about?
- Analyze /analyze funnel: search/social -> /analyze page -> gate trigger -> email submit -> waitlist. Where's the biggest drop?

**Product tweaks based on data:**
- If /analyze gate conversion is below 15%: test lowering the free limit from 1 to 0 (require email on second analysis) or raising it to 3 (more usage, more sharing before gate).
- If referral sharing rate is below 10%: add in-app sharing prompts at moments of delight (e.g., after viewing a bullish analysis: "Share this analysis with a friend who holds $TICKER").

**Content:**
- Blog post #9: "Helm Product Hunt Launch — What We Learned" (builds transparency, attracts indie hacker audience).
- Blog post #10: Seasonal/topical piece (tax season angle: "Tax-Loss Harvesting Moves to Make Before Q2").

---

### Phase 3: Scale (Weeks 9–12)

#### Week 9 — Paid Acquisition Testing

**X/Twitter Ads (budget: $500):**
- Creative A: Screenshot of /analyze report with copy: "Free stock analysis. Institutional-grade. Any ticker. No signup." CTA: Try it free.
- Creative B: Dashboard screenshot with copy: "What if your financial life had a command center?" CTA: Join waitlist.
- Creative C: Social proof angle: "Join [X] people using Helm to manage [$ total net worth] in assets." CTA: Join waitlist.
- Target: followers of @Bloomberg, @YahooFinance, @unusual_whales, @theTerminal. Interest: fintech, investing, startups. Job titles: founder, engineer, VP.
- Measure CPA (cost per waitlist signup). Kill anything above $3 CPA. Scale anything below $1.50.

**Retargeting:**
- Pixel all /analyze page visitors. Run retargeting ads to anyone who viewed an analysis but didn't sign up. Creative: "You analyzed $TICKER on Helm. Want the full intelligence suite? Join the waitlist."

#### Week 10 — Partnership + Distribution Deals

**Co-marketing:**
- Reach out to 3–5 complementary fintech tools (Plaid-powered apps, tax tools like Harness or Column Tax, portfolio trackers) for content swaps or co-webinars. Angle: "We both serve HNW individuals. Let's cross-promote."
- Reach out to financial advisors / RIA firms. Offer a "recommended tools" partnership — they share Helm with clients, you give them Pro access.

**Content:**
- Blog posts #11–12: Two more ticker analysis SEO posts for trending stocks.
- Guest post pitch to 3 publications: TechCrunch (fintech angle), The Hustle (founder story), Investopedia (educational content with /analyze links).

#### Week 11 — Community Building

**Discord or private community:**
- Launch a private Helm community (Discord or Circle) for waitlist members. Position it as: "Early access to features + direct line to the founding team + financial intelligence discussions."
- Seed it with 50–100 of your most engaged waitlist members (highest referral counts).
- Post weekly: a "market scan" using Helm data, product roadmap updates, and polls for feature prioritization.

**User-generated content:**
- Prompt community members: "Run /analyze on a ticker you're considering buying. Share the result and your take." Best analyses get featured on the Helm blog/X.

#### Week 12 — Optimization + Q2 Planning

**Full funnel audit:**
- Map the complete funnel: impression -> click -> /analyze view -> analysis gate -> email submit -> waitlist -> referral share -> referred signup.
- Calculate conversion rate at every step. Identify the single biggest leak and fix it.

**What worked, what didn't:**
- Rank all channels by actual CPA and volume. Double down on the top 3. Kill the bottom 3.
- Document every growth experiment result (see Section 5) for institutional knowledge.

**Q2 planning:**
- If waitlist > 5,000: plan early access rollout. Invite top 100 by referral count, instrument everything, measure activation (link first account within 48h).
- If waitlist < 5,000: double down on SEO and /analyze expansion. The long game is the right game for this product.

---

## 3. Viral Loop Design

### Current State
The referral system works but is under-incentivized. Users get a referral code and share buttons (X, LinkedIn, copy). They can see their referral count. But there is no tangible reward for referring.

### Redesigned Loop

**Mechanic: "Priority Queue"**

```
Join waitlist -> Get position #N and referral code
-> Share referral link
-> Each referral moves you up 5 positions
-> At 3 referrals: unlock "Priority Access" (first batch of invites)
-> At 5 referrals: unlock "Pro Preview" (1 month free Pro when it launches)
-> At 10 referrals: unlock "Founding Member" badge (permanent, displayed in-app)
```

**Why this works for Helm's audience:**
- High-agency people respond to status and exclusivity, not discounts.
- "Priority Access" creates genuine FOMO — being in the first batch matters to people who see themselves as early adopters.
- "Founding Member" is a permanent flex. This demographic values being early to things.

**Implementation changes needed:**

1. **Waitlist API update:** When a referral is recorded, decrement the referrer's position by 5 (minimum position: 1). Update the `/api/waitlist` route to recalculate positions.

2. **Referral dashboard:** Replace the current simple referral count display with a progress bar showing tiers:
   ```
   [====------] 2 of 3 referrals
   Next unlock: Priority Access (first invites)
   ```

3. **Post-signup screen copy change.** Current: "Share your link to move up." New:
   ```
   YOUR REFERRAL DASHBOARD
   Position: #47 (started at #62 - moved up 15 spots)
   Referrals: 3 / 5

   [==========------] 3 of 5 referrals
   UNLOCKED: Priority Access
   NEXT: Pro Preview (1 month free) at 5 referrals

   Share your link: helmterminal.dev?ref=ABC123
   [Copy] [Share on X] [Share on LinkedIn]
   ```

4. **Pre-written share messages (make sharing effortless):**
   - X: "I just got priority access to Helm Terminal — a Bloomberg-grade financial intelligence tool for individuals. Analyze any stock for free: helmterminal.dev?ref={CODE}"
   - LinkedIn: "Found a seriously impressive financial intelligence platform — institutional-grade analysis that usually costs $24K/year, free for individuals. Worth checking out: helmterminal.dev?ref={CODE}"
   - DM/text: "Hey — check this out. Free AI stock analysis for any ticker, plus a financial intelligence dashboard. I'm on the early access list: helmterminal.dev?ref={CODE}"

5. **The /analyze share loop (the real viral mechanic):**
   After viewing a stock analysis, show:
   ```
   Share this $AAPL analysis:
   [Share on X] [Copy Link]

   helmterminal.dev/analyze/AAPL?ref={CODE}
   ```
   The analysis share URL includes their referral code. If the recipient signs up, it counts as a referral. This is the highest-leverage loop because the share has intrinsic value (a real stock analysis) — it's not just a "sign up for my thing" ask.

### Expected Impact
- Current viral coefficient (estimated): 0.1–0.2 (most people don't share because there's no reason to)
- Target viral coefficient: 0.4–0.6 (each user brings 0.4–0.6 new users on average)
- At 0.5 viral coefficient, every 1,000 direct signups become 2,000 total signups via the referral cascade.

---

## 4. Product-Led Growth: /analyze as Top-of-Funnel Engine

### The Opportunity
`/analyze/[ticker]` is Helm's most powerful growth asset. It's free, requires no signup, delivers immediate value, and is infinitely scalable (every US stock is a keyword). This is Canva's "free design tool" strategy applied to financial intelligence.

### SEO Plays

**1. Programmatic Ticker Pages (highest priority)**
- Create an index page at `/analyze/stocks` listing the top 500 US stocks by market cap, organized by sector. This gives Google a crawl path to discover all ticker pages.
- Each `/analyze/[ticker]` page already has dynamic metadata. Enhance it:
  - Title: `{COMPANY_NAME} ({TICKER}) Stock Analysis — Free AI Report | Helm Terminal`
  - Description: `Free institutional-grade analysis of {COMPANY_NAME} ({TICKER}). Real-time price: ${PRICE}. AI verdict, financials, analyst consensus, earnings, and news.` (Include the live price to make the description dynamic and compelling in search results.)
- Target keywords per page: "{TICKER} stock analysis", "{COMPANY_NAME} stock analysis", "is {TICKER} a buy", "{TICKER} stock forecast". These are high-intent, high-volume queries.

**2. Sector Landing Pages**
- Create `/analyze/sector/technology`, `/analyze/sector/healthcare`, etc. Page content: "Top Technology Stocks — AI Analysis" with a table of tickers, current prices, and Helm's verdict (bullish/neutral/bearish). Link to each individual analysis page.
- Target keywords: "best tech stocks 2026", "healthcare stock analysis", etc.

**3. Topical Analysis Posts (blog)**
- Every time a major stock event happens (earnings beat/miss, acquisition, crash), publish a blog post within 24 hours using /analyze data: "NVDA After Earnings: Full AI Analysis." Link to the live /analyze page.
- These posts capture search traffic for breaking financial news queries and age into evergreen content.

**4. Comparison Pages**
- Create `/analyze/compare/AAPL-vs-MSFT` pages. "AAPL vs MSFT: Head-to-Head AI Analysis." This format captures comparison search queries ("AAPL vs MSFT stock") which have high intent and low competition.

### Social Sharing Mechanics

**1. OG Image Generation (Week 3 priority)**
When `/analyze/AAPL` is shared on any platform, the preview should show:
```
+--------------------------------------+
|  HELM TERMINAL                       |
|                                      |
|  AAPL — Apple Inc.                   |
|  $198.45  +2.3%                      |
|                                      |
|  AI Verdict: BULLISH                 |
|  Analyst Consensus: Strong Buy (4.2) |
|                                      |
|  Free analysis at helmterminal.dev   |
+--------------------------------------+
```
This turns every share into an ad. Use Next.js `opengraph-image.tsx` route handler with `@vercel/og`.

**2. Share Buttons on Every Analysis (pre-gate)**
Move the share functionality to be visible immediately, not just after the email gate. The analysis itself is the most shareable asset — don't hide the share buttons behind a wall.

Add a floating share bar:
```
[Share on X] [Share on LinkedIn] [Copy Link]
"Check out this free AI analysis of $AAPL"
```

**3. Embeddable Analysis Widget**
Build a lightweight embed: `<iframe src="helmterminal.dev/embed/AAPL" />` that bloggers and newsletter authors can drop into their content. Shows a compact version of the analysis with a "Powered by Helm Terminal" link. This is a backlink machine.

### Conversion Paths: /analyze -> Waitlist -> User

**Path 1: Gate after 1 analysis (current)**
- User views first analysis: full access.
- User views second analysis: blurred with email gate.
- After email: 5 more analyses unlocked, added to waitlist.

**Optimization:** Test gate timing. Current `FREE_LIMIT = 1` means the gate triggers on the second view. Test:
- `FREE_LIMIT = 2`: More usage before gate = more sharing before conversion. Better for viral coefficient.
- `FREE_LIMIT = 0`: Gate on first view of second unique ticker (let them re-view the same ticker freely). Maximizes email capture.

**Path 2: Contextual upgrade prompts (add these)**
On every ungated analysis page, add a subtle banner:
```
+------------------------------------------------------------------+
| Want this analysis for your actual portfolio positions?           |
| Helm monitors all your holdings and tells you what matters.      |
| [Join Waitlist]                                                   |
+------------------------------------------------------------------+
```

**Path 3: Analysis-to-dashboard bridge**
After someone signs up via the /analyze gate, redirect them to a "Your Portfolio, Analyzed" landing page that shows what the full dashboard looks like with their analyzed ticker highlighted. "Imagine this for every position in your portfolio. That's Helm."

---

## 5. Growth Experiments Backlog

| # | Experiment | Hypothesis | Primary Metric | Effort | Expected Impact |
|---|-----------|-----------|----------------|--------|-----------------|
| 1 | **Lower /analyze gate to FREE_LIMIT=2** | More free analyses = more sharing before gate, increasing viral coefficient at acceptable cost to conversion rate | Viral coefficient (shares per user) vs. gate conversion rate | S | M |
| 2 | **Add OG image generation to /analyze pages** | Rich preview images increase click-through rate on social shares by 2–3x | CTR on shared /analyze links (track via UTM) | M | L |
| 3 | **Referral tier rewards (3/5/10)** | Tangible, status-driven rewards increase referral sharing rate from ~5% to ~20% | Referral share rate, referrals per user | M | L |
| 4 | **Weekly "Helm Scan" X thread** | Recurring, data-driven content format builds a following faster than one-off posts | Follower growth rate, impressions per thread | S | M |
| 5 | **Stock analysis SEO index page (500 tickers)** | Giving Google a crawl path to 500+ pages increases organic traffic by 5–10x within 8 weeks | Indexed pages in Search Console, organic traffic to /analyze/* | M | L |
| 6 | **Sector landing pages (/analyze/sector/*)** | Sector-level pages capture mid-funnel "best [sector] stocks" queries | Organic impressions + clicks for sector keywords | M | M |
| 7 | **"Share this analysis" buttons above the fold (pre-gate)** | Making sharing frictionless on the ungated view increases organic distribution | Share clicks per analysis view | S | M |
| 8 | **Contextual "analyze your portfolio" banner on /analyze** | Connecting the free tool to the core product increases waitlist signup from organic /analyze traffic | /analyze visitor -> waitlist conversion rate | S | M |
| 9 | **Post-waitlist referral reminder email (24h after signup)** | A reminder with referral progress prompts sharing in users who intended to but forgot | Referral shares within 48h of signup | S | S |
| 10 | **Product Hunt launch** | A well-executed PH launch generates 1,000–3,000 signups in 48 hours | Total signups in 48h, sustained traffic after launch | L | L |
| 11 | **Show HN post with technical deep-dive** | HN audience (engineers, founders) is exact ICP. Technical authenticity drives engagement | HN points + referral traffic + signups | M | M |
| 12 | **A/B test waitlist CTA copy** | "Join the waitlist" vs. "Get early access" vs. "Request your terminal" — terminal language may resonate more with target audience | Waitlist form conversion rate | S | S |
| 13 | **Comparison pages (/analyze/compare/AAPL-vs-MSFT)** | Comparison queries have high intent and low SEO competition | Organic traffic to comparison pages | M | M |
| 14 | **Append referral code to /analyze share links** | Making every analysis share count as a referral touchpoint closes the loop between free tool usage and viral growth | Referral signups attributed to /analyze shares | S | L |
| 15 | **Embed widget for bloggers/newsletters** | An embeddable mini-analysis widget generates backlinks and brand impressions at scale | Number of embeds, backlinks, referral traffic from embeds | L | M |

### Experiment Prioritization

**Run first (Weeks 1–2):** #1, #5, #7, #8, #12 — all small effort, unlock the funnel.
**Run second (Weeks 3–4):** #2, #3, #9, #14 — medium effort, multiply sharing.
**Run third (Weeks 5–8):** #4, #6, #10, #11, #13 — larger bets with compounding payoff.
**Run last (Weeks 9–12):** #15 — high effort, needs traction first to be worth building.

---

## Appendix: Key Metrics to Track

| Metric | Target (90 day) | How to Measure |
|--------|-----------------|----------------|
| Waitlist signups | 5,000+ | Supabase `waitlist` table count |
| /analyze page views | 10,000+/month by day 90 | Vercel Analytics or Google Analytics |
| /analyze -> waitlist conversion rate | 15–25% | (waitlist signups from /analyze) / (unique /analyze visitors) |
| Viral coefficient | 0.4+ | (referred signups) / (total signups) |
| Referral share rate | 20%+ | (users who share referral link) / (total waitlist signups) |
| Organic search traffic | 3,000+/month by day 90 | Google Search Console |
| Social followers (X) | 2,000+ | X Analytics |
| Domain authority | 25+ | Ahrefs/Moz (driven by backlinks from PH, HN, blogs) |
| Cost per acquisition (paid) | <$2.00 | Ad spend / signups from paid |
| Activation rate (when invites begin) | 60%+ link first account within 48h | Supabase `plaid_items` table |
