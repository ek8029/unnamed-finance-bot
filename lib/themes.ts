// Hand-authored investment themes for /theme/[slug] programmatic SEO.
// Each theme is a thesis a sector rotator might hold: what has to be true,
// the chain of beneficiaries, and what would invalidate it. No AI generation.

export interface ThemeChainLink {
  layer: string;
  detail: string;
  tickers: string[];
}

export interface InvestmentTheme {
  slug: string;
  name: string;
  tagline: string;
  thesis: string;
  pillars: string[];
  chain: ThemeChainLink[];
  invalidations: string[];
  updated: string; // ISO date
}

export const THEMES: InvestmentTheme[] = [
  {
    slug: 'ai-capex',
    name: 'The AI Capex Cycle',
    tagline: 'Hyperscaler spending flows down a defined supply chain.',
    thesis:
      'The largest cloud providers are spending unprecedented amounts on AI infrastructure, and that capital flows in a predictable order: chips, then the systems and networking around them, then the power and real estate to house them. If hyperscaler capex keeps climbing, the chain benefits in sequence.',
    pillars: [
      'Hyperscaler capital expenditure keeps growing year over year, not just holding flat',
      'AI compute demand stays ahead of supply, so pricing power sits with the suppliers',
      'The buildout is investment, not a one-time stocking event that digests and stalls',
    ],
    chain: [
      { layer: 'Compute', detail: 'GPUs and accelerators, the first dollar spent', tickers: ['NVDA', 'AMD', 'AVGO'] },
      { layer: 'Foundry and equipment', detail: 'Who actually fabricates the chips', tickers: ['TSM', 'ASML', 'AMAT'] },
      { layer: 'Systems and networking', detail: 'Servers, switching, interconnect', tickers: ['DELL', 'SMCI', 'ANET'] },
      { layer: 'Power and cooling', detail: 'The constraint everyone hits next', tickers: ['VRT', 'ETN'] },
      { layer: 'Hyperscalers', detail: 'The spenders themselves', tickers: ['MSFT', 'GOOGL', 'AMZN', 'META'] },
    ],
    invalidations: [
      'A hyperscaler guides capex flat or down on an earnings call (the "digestion phase" the whole trade fears)',
      'AI compute supply catches up to demand and pricing power shifts to buyers',
      'A major customer signals AI projects are not converting to revenue, slowing the next order cycle',
    ],
    updated: '2026-06-17',
  },
  {
    slug: 'datacenter-power',
    name: 'Datacenter Power and the Grid',
    tagline: 'Compute is now a power problem.',
    thesis:
      'AI datacenters consume electricity at a scale the grid was not built for. The bottleneck for the AI buildout is increasingly power generation, transmission, and cooling, not chips. Capital and policy are rotating toward whatever can deliver reliable baseload power and move it efficiently.',
    pillars: [
      'Datacenter electricity demand keeps outgrowing available generation and transmission',
      'Utilities and independent power producers can actually add capacity and recover the cost',
      'Cooling and electrical efficiency stay a hard constraint, not a solved problem',
    ],
    chain: [
      { layer: 'Power generation', detail: 'Baseload and independent power producers', tickers: ['VST', 'CEG', 'NRG'] },
      { layer: 'Electrical equipment', detail: 'Transformers, switchgear, grid hardware', tickers: ['ETN', 'GEV', 'PWR'] },
      { layer: 'Cooling and thermal', detail: 'The datacenter heat problem', tickers: ['VRT'] },
    ],
    invalidations: [
      'AI capex slows and projected datacenter load forecasts get revised down',
      'Efficiency gains cut power-per-compute faster than demand grows',
      'Regulators block or delay the rate recovery utilities are counting on',
    ],
    updated: '2026-06-17',
  },
  {
    slug: 'reindustrialization',
    name: 'US Reindustrialization',
    tagline: 'Bringing manufacturing and supply chains back onshore.',
    thesis:
      'Policy and corporate strategy are pushing manufacturing, semiconductors, and critical supply chains back to the United States. The thesis is that reshoring drives a multi-year wave of factory construction, automation, and domestic industrial demand.',
    pillars: [
      'Reshoring incentives and policy support stay in place across administrations',
      'Companies follow through on announced domestic capacity, not just press releases',
      'The construction and automation spend shows up in industrial order books',
    ],
    chain: [
      { layer: 'Construction and engineering', detail: 'Who builds the factories', tickers: ['PWR', 'J', 'ACM'] },
      { layer: 'Automation', detail: 'What goes inside them', tickers: ['ROK', 'EMR', 'ETN'] },
      { layer: 'Industrials and materials', detail: 'Domestic capacity beneficiaries', tickers: ['CAT', 'NUE'] },
    ],
    invalidations: [
      'Reshoring incentives get cut or reversed by policy change',
      'Announced domestic projects get delayed or cancelled as rates bite',
      'Industrial order books soften, signaling the spend is not materializing',
    ],
    updated: '2026-06-17',
  },
  {
    slug: 'nuclear-smr',
    name: 'Nuclear and SMR Buildout',
    tagline: 'Baseload power for an electrified, AI-hungry grid.',
    thesis:
      'Rising electricity demand, decarbonization goals, and the need for reliable baseload are reviving nuclear, including small modular reactors. The thesis is that nuclear capacity, uranium supply, and reactor technology see sustained capital as the grid needs firm power.',
    pillars: [
      'Demand for firm, carbon-free baseload power keeps rising',
      'Policy and permitting actually enable new builds rather than stalling them',
      'Uranium supply stays tight relative to restarting and new reactor demand',
    ],
    chain: [
      { layer: 'Operators and utilities', detail: 'Existing nuclear fleets and restarts', tickers: ['CEG', 'VST'] },
      { layer: 'SMR and reactor tech', detail: 'Next-generation reactor developers', tickers: ['SMR', 'OKLO'] },
      { layer: 'Uranium and fuel', detail: 'The fuel supply chain', tickers: ['CCJ', 'UEC'] },
    ],
    invalidations: [
      'A safety incident or policy reversal stalls permitting and new builds',
      'SMR timelines slip materially or costs overrun the economics',
      'Power demand forecasts get cut, removing the need for new baseload',
    ],
    updated: '2026-06-17',
  },
  {
    slug: 'defense-rearmament',
    name: 'Global Defense Rearmament',
    tagline: 'Sustained defense budgets across allied nations.',
    thesis:
      'Geopolitical tension is driving multi-year increases in defense spending across the US and allied nations. The thesis is that prime contractors, munitions makers, and defense technology see durable order growth backed by government budgets.',
    pillars: [
      'Allied defense budgets keep rising and stay funded through cycles',
      'Munitions and equipment restocking continues beyond the initial surge',
      'Order backlogs convert to revenue without major program cancellations',
    ],
    chain: [
      { layer: 'Prime contractors', detail: 'Platforms and systems', tickers: ['LMT', 'RTX', 'NOC', 'GD'] },
      { layer: 'Defense technology', detail: 'Software, electronics, autonomy', tickers: ['PLTR'] },
    ],
    invalidations: [
      'A broad geopolitical de-escalation reduces the urgency to spend',
      'Budget fights cut or delay defense appropriations',
      'Major programs get cancelled or restructured, hitting backlogs',
    ],
    updated: '2026-06-17',
  },
  {
    slug: 'glp1-obesity',
    name: 'GLP-1 and the Obesity Wave',
    tagline: 'A new drug class with a very large addressable market.',
    thesis:
      'GLP-1 drugs for diabetes and obesity have a large and expanding addressable market. The thesis is that the makers, their supply chains, and adjacent beneficiaries grow as access widens, while some food and medical-device categories face pressure.',
    pillars: [
      'GLP-1 demand keeps expanding as indications and access widen',
      'Manufacturing capacity scales to meet demand without ceding share',
      'Pricing and insurance coverage hold up enough to sustain margins',
    ],
    chain: [
      { layer: 'Drug makers', detail: 'The branded GLP-1 franchises', tickers: ['LLY', 'NVO'] },
      { layer: 'Supply and devices', detail: 'Manufacturing, delivery, and tooling', tickers: ['TMO'] },
    ],
    invalidations: [
      'A new entrant or generic compresses pricing and share faster than expected',
      'Insurance coverage tightens, cutting real-world access and volume',
      'Safety or efficacy data emerges that slows adoption',
    ],
    updated: '2026-06-17',
  },
];

export function getTheme(slug: string): InvestmentTheme | null {
  return THEMES.find((t) => t.slug === slug) ?? null;
}
