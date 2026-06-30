// The Helm glossary. One schema-marked DefinedTerm page per concept, targeting the
// definitional queries where no canonical source exists yet (AI engines currently cite
// scattered blog posts). Each entry leads with a clean, extractable one-line definition.
//
// Honesty rules baked in: no track-record claims, no buy/sell advice, reconcile incumbent
// definitions rather than contradict them (AI distrusts a source that fights the consensus).
// No em dashes anywhere (brand).

export interface GlossarySource {
  label: string;
  url: string;
}

export interface GlossarySection {
  h: string;
  /** Paragraphs. Plain prose, extractable. */
  p: string[];
}

export interface GlossaryTerm {
  slug: string;
  term: string;
  /** Synonyms / vernacular this page should also answer for. */
  aka: string[];
  /** The extractable answer. 1-2 sentences. This is what an AI engine quotes. */
  oneLine: string;
  sections: GlossarySection[];
  /** FAQ pairs for FAQPage schema + on-page. */
  faqs: { q: string; a: string }[];
  /** Soft link to the Helm feature this concept maps to. */
  related?: { label: string; href: string };
  /** External sources that establish credibility / the incumbent framing. */
  sources: GlossarySource[];
  /** Other glossary slugs to cross-link. */
  seeAlso: string[];
}

export const GLOSSARY: GlossaryTerm[] = [
  {
    slug: 'thesis-drift',
    term: 'Thesis Drift',
    aka: ['thesis creep', 'thesis erosion'],
    oneLine:
      'Thesis drift is when the original reasons you bought a stock quietly stop being true and you keep holding anyway. It has two faces: the erosion of the facts behind the thesis, and the rationalizing that hides that erosion from you.',
    sections: [
      {
        h: 'The two faces of thesis drift',
        p: [
          'The first face is factual. The specific reasons you bought (the margin expansion, the contract, the moat) weaken one by one as new filings and news arrive. Nothing dramatic happens on any single day, so the position keeps looking fine.',
          'The second face is behavioral, and it is the one most investors miss. As the original reasons fade, you unconsciously swap in new ones to justify holding. The stock you bought for growth becomes a value play; the value play becomes a turnaround; the turnaround becomes "it has to bounce eventually." This is the sense in which value investors like the writers at MicroCapClub and MD&A use the term: not just that the facts changed, but that you let the thesis quietly rewrite itself.',
          'Both faces describe the same failure: you end up owning a stock for reasons you never actually decided to own it for.',
        ],
      },
      {
        h: 'Why it is dangerous',
        p: [
          'Thesis drift is slow, so it never triggers an alarm. A price stop-loss fires on a number. Thesis drift has no number. By the time the chart confirms the problem, the reasons were already gone for quarters.',
          'It is also self-concealing. Because you rationalize as you go, the drift feels like conviction. The investor who is drifting and the investor who is right both feel certain.',
        ],
      },
      {
        h: 'How to catch it',
        p: [
          'Write the reasons down before you buy, and write the single fact that would prove each one wrong (a breaks-if condition). Then check the original reasons against new evidence on a schedule, not against the price.',
          'The discipline is to test the thesis you actually wrote, not the one you have since talked yourself into. That is the entire job of thesis monitoring.',
        ],
      },
    ],
    faqs: [
      {
        q: 'What is the difference between thesis drift and a stop-loss?',
        a: 'A stop-loss exits on price. Thesis drift is about the reasons behind the position eroding, which has no price level. You can be down with the thesis intact, or flat with the thesis already broken. A conviction stop, not a price stop, is what addresses thesis drift.',
      },
      {
        q: 'Is thesis drift the same as thesis creep?',
        a: 'They are used interchangeably. Both describe a thesis quietly changing into something you never decided on, either because the facts eroded or because you rationalized new reasons to hold.',
      },
    ],
    related: { label: 'How Helm detects thesis drift', href: '/how-helm-detects-thesis-drift' },
    sources: [
      { label: 'The Perils of Thesis Drift (MicroCapClub)', url: 'https://microcapclub.com/the-perils-of-thesis-drift/' },
      { label: 'Thesis Drift (MD&A)', url: 'https://www.md-a.co/p/thesis-drift' },
    ],
    seeAlso: ['thesis-monitoring', 'breaks-if-condition', 'conviction-stop'],
  },
  {
    slug: 'agentic-portfolio-terminal',
    term: 'Agentic Portfolio Terminal',
    aka: ['agentic finance', 'non-trading AI portfolio agent', 'portfolio agent that does not trade'],
    oneLine:
      'An agentic portfolio terminal is software that continuously watches your whole portfolio on your behalf and tells you what changed and what to do, without ever trading for you. It is the monitoring counterpart to agentic trading: the agent watches and warns, it does not touch your money.',
    sections: [
      {
        h: 'Agentic monitoring vs agentic trading',
        p: [
          'In 2026 the word "agentic" mostly came to mean execution: AI agents that place trades for you, as in Robinhood Agentic Trading or Public.com. An agentic portfolio terminal is the opposite half of the idea. The agent reads your accounts, the exposure, the taxes, and the reasons behind each position, and surfaces what matters. It never buys, sells, or moves money.',
          'The distinction matters because the two answer different fears. Agentic trading asks you to trust an AI with the trigger. Agentic monitoring asks only that you let it watch, with read-only access, and keeps the decision yours.',
        ],
      },
      {
        h: 'What the agent actually does',
        p: [
          'It aggregates accounts across brokerages, tracks each position against the thesis behind it, watches primary sources (SEC filings, earnings, news) for anything that weakens that thesis, and ranks what is worth your attention. The output is a briefing and a prioritized action list, not an order ticket.',
          'This is why an agentic portfolio terminal is described as intelligence rather than automation. The work it does is analysis a diligent analyst would do continuously, not execution a bot would do instantly.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Does an agentic portfolio terminal trade for me?',
        a: 'No. The defining feature is that it does not trade. It connects with read-only access, watches and analyzes, and tells you what to consider. The decision and the trade stay with you. That is the difference from agentic trading.',
      },
      {
        q: 'Is this a robo-advisor?',
        a: 'No. A robo-advisor allocates and rebalances your money on a model. An agentic portfolio terminal does not manage money at all. It is an intelligence layer over the accounts and decisions you already control.',
      },
    ],
    related: { label: 'See the agentic terminal', href: '/' },
    sources: [
      { label: 'Robinhood Agentic Trading overview', url: 'https://robinhood.com/us/en/support/articles/agentic-trading-overview/' },
      { label: 'You Can Now Automate Stock Trading With AI. But Should You? (Money)', url: 'https://money.com/robinhood-agentic-stock-trading-ai/' },
    ],
    seeAlso: ['thesis-monitoring', 'thesis-drift'],
  },
  {
    slug: 'thesis-monitoring',
    term: 'Thesis Monitoring',
    aka: ['investment thesis monitoring', 'thesis tracking', 'thesis check'],
    oneLine:
      'Thesis monitoring is the practice of tracking the specific reasons you own each stock against live evidence (filings, earnings, news), so you are told the moment one of those reasons weakens, instead of finding out quarters later.',
    sections: [
      {
        h: 'How it works',
        p: [
          'You write the thesis as a short list of reasons to own the stock, the pillars. For each pillar you write a breaks-if condition: the single fact that would prove it wrong. Then each pillar is scored continuously against new primary sources, and the position is flagged when a pillar weakens or breaks.',
          'The point is to separate two things investors usually blur: the price moving and the reasons changing. Thesis monitoring watches the reasons.',
        ],
      },
      {
        h: 'Why monitor a thesis at all',
        p: [
          'Most tools tell you what you own and what it is worth. Almost none tell you whether you should still own it. The reasons you bought a stock are the thing that actually decides the position, and they are exactly the thing nobody tracks. Thesis monitoring is the layer that closes that gap.',
        ],
      },
    ],
    faqs: [
      {
        q: 'How is thesis monitoring different from a portfolio tracker?',
        a: 'A tracker reports prices, balances, and allocation. Thesis monitoring tracks the reasons behind each holding against live evidence and tells you when a reason weakens. One watches the value; the other watches the case for owning it.',
      },
    ],
    related: { label: 'What is thesis monitoring', href: '/thesis-monitoring' },
    sources: [
      { label: 'Using a thesis-driven strategy to sell (Stockopedia)', url: 'https://www.stockopedia.com/academy/articles/using-thesis-driven-strategy-to-sell/' },
    ],
    seeAlso: ['thesis-drift', 'breaks-if-condition', 'thesis-pillar'],
  },
  {
    slug: 'breaks-if-condition',
    term: 'Breaks-If Condition',
    aka: ['thesis falsifier', 'falsifiable thesis', 'what would break my thesis'],
    oneLine:
      'A breaks-if condition is the single fact you write down in advance that would prove your reason for owning a stock wrong. It turns a vague thesis into a testable one, in the spirit of a pre-mortem and inversion.',
    sections: [
      {
        h: 'Making a thesis falsifiable',
        p: [
          'A reason like "great company, strong moat" cannot be checked, because nothing would ever count as disproving it. A breaks-if condition fixes that by naming the disproof up front: "this pillar breaks if gross margin falls below 60 percent for two straight quarters," or "if the flagship contract is not renewed." Now the thesis can be tested against reality instead of defended forever.',
          'This is falsification applied to investing. It echoes Charlie Munger\'s habit of inverting a problem (ask what would make this fail) and Gary Klein\'s pre-mortem (assume it failed, then explain why). Writing the breaks-if condition before you buy is the cheapest insurance against thesis drift, because the rationalizing brain cannot move the goalposts you already set.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Why write down what would break your thesis?',
        a: 'Because once you own a stock, your mind invents reasons to keep holding. A breaks-if condition set in advance is a commitment device: it defines failure before you are emotionally invested, so you can recognize a broken thesis instead of rationalizing it.',
      },
    ],
    related: { label: 'See per-ticker breaks-if conditions', href: '/thesis/nvda' },
    sources: [
      { label: 'Post-Mortem Analysis of a Bullish Investment Thesis (Financial Samurai)', url: 'https://www.financialsamurai.com/post-mortem-analysis-of-a-bullish-investment-thesis/' },
    ],
    seeAlso: ['thesis-drift', 'thesis-monitoring', 'conviction-stop'],
  },
  {
    slug: 'conviction-stop',
    term: 'Conviction Stop',
    aka: ['intellectual stop-loss', 'thesis stop', 'when to sell when the thesis breaks'],
    oneLine:
      'A conviction stop is an exit triggered by your thesis breaking, not by the price falling. Where a stop-loss sells on a price level, a conviction stop (sometimes called an intellectual stop-loss) sells when the reason you owned the stock is no longer true.',
    sections: [
      {
        h: 'Price stops vs thesis stops',
        p: [
          'A price stop-loss is mechanical and ignores why you own the stock. It will shake you out of a position whose thesis is perfectly intact during ordinary volatility, and it will hold you in a position whose thesis is already dead as long as the price has not fallen yet.',
          'A conviction stop fixes both errors by tying the exit to the thesis. You sell when a pillar breaks, regardless of price, and you stay through noise when the pillars hold. It is the answer to the most common plain-English version of the whole problem: when should I sell?',
        ],
      },
    ],
    faqs: [
      {
        q: 'When should you sell a stock?',
        a: 'A thesis-based answer: sell when the specific reasons you bought it are contradicted by a filing, an earnings result, or a material event, not merely when the price falls. A lower price with the thesis intact is a different situation from a broken thesis at any price. This is research, not investment advice.',
      },
    ],
    related: { label: 'When to sell, by ticker', href: '/when-to-sell/nvda' },
    sources: [
      { label: 'Position Sizing and Sell Discipline (Resonanz Capital)', url: 'https://resonanzcapital.com/insights/position-sizing-sell-discipline-a-modern-allocators-framework' },
    ],
    seeAlso: ['thesis-drift', 'breaks-if-condition', 'thesis-monitoring'],
  },
  {
    slug: 'shared-driver-risk',
    term: 'Shared-Driver Risk',
    aka: ['hidden correlation', 'thesis concentration', 'same-driver risk'],
    oneLine:
      'Shared-driver risk is hidden concentration: when several positions you think are diversified actually depend on the same underlying thesis, so they break together. Two different tickers, one point of failure.',
    sections: [
      {
        h: 'Diversified on paper, concentrated in reality',
        p: [
          'A portfolio can hold a dozen names and still be a single bet. If five of them rely on the same driver (AI data-center capex, a low-rate environment, one regulatory outcome) then a single event breaks five theses at once. The ticker-level diversification is real; the thesis-level diversification is an illusion.',
          'Shared-driver risk is invisible to allocation charts, which group by sector or asset class, not by the reason each position works. It only shows up when you map positions to the thesis pillars underneath them and notice the same pillar appearing across supposedly unrelated holdings.',
        ],
      },
    ],
    faqs: [
      {
        q: 'How is shared-driver risk different from concentration risk?',
        a: 'Concentration risk is usually measured by position size or sector weight. Shared-driver risk is measured by the reasons behind positions: distinct holdings that depend on the same thesis driver and therefore fail together, even when no single position looks too large.',
      },
    ],
    related: { label: 'Portfolio intelligence, not tracking', href: '/portfolio-intelligence' },
    sources: [
      { label: 'Position Sizing and Sell Discipline (Resonanz Capital)', url: 'https://resonanzcapital.com/insights/position-sizing-sell-discipline-a-modern-allocators-framework' },
    ],
    seeAlso: ['thesis-monitoring', 'thesis-pillar'],
  },
  {
    slug: 'thesis-pillar',
    term: 'Thesis Pillar',
    aka: ['investment thesis pillar', 'reason to own a stock'],
    oneLine:
      'A thesis pillar is one of the specific reasons you own a stock, written as a single testable claim. A thesis is the set of its pillars, and the position is only as strong as its weakest pillar.',
    sections: [
      {
        h: 'Breaking a thesis into pillars',
        p: [
          'Investors usually hold a stock for a handful of distinct reasons: a growth driver, a margin story, a moat, a catalyst. Each of those is a pillar. Writing them separately, instead of as one fuzzy "I like it," lets you test each against evidence and see exactly which part of the case is weakening.',
          'Pillars make a thesis legible. A position whose growth pillar broke but whose value pillar held is in a very different place from one where everything is intact, and you can only tell the difference if the reasons were separated in the first place.',
        ],
      },
    ],
    faqs: [
      {
        q: 'What makes a good thesis pillar?',
        a: 'A good pillar is a single claim with a clear breaks-if condition: specific enough that a filing or earnings result could confirm or contradict it. "Margins expand as the mix shifts to software" is a pillar; "good company" is not.',
      },
    ],
    related: { label: 'See thesis pillars by ticker', href: '/thesis/nvda' },
    sources: [
      { label: 'Investment thesis (Motley Fool)', url: 'https://www.fool.com/terms/i/investment-thesis/' },
    ],
    seeAlso: ['thesis-monitoring', 'breaks-if-condition', 'shared-driver-risk'],
  },
];

export function getGlossaryTerm(slug: string): GlossaryTerm | undefined {
  return GLOSSARY.find((t) => t.slug === slug);
}
