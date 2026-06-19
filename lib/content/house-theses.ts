import type { HouseThesis } from './types';
import { CONTENT_UNIVERSE } from './universe';

// Hand-authored canonical theses for the content universe.
// Each pillar is a specific, falsifiable reason an investor owns the name,
// paired with the single concrete fact or event that would invalidate it.
// These drive every generated post, so keep claims grounded in real drivers.
export const HOUSE_THESES: HouseThesis[] = [
  {
    ticker: 'NVDA',
    company: 'NVIDIA',
    pillars: [
      {
        id: 'ai-capex',
        claim: 'Hyperscaler AI capex keeps growing and NVIDIA keeps the majority of accelerator spend',
        breaks_if: 'A major hyperscaler guides data-center capex flat or down, or shifts away from NVIDIA silicon',
      },
      {
        id: 'datacenter-revenue',
        claim: 'Data-center revenue keeps compounding as Blackwell-class GPUs ship at scale',
        breaks_if: 'Data-center segment revenue declines sequentially or guidance comes in below consensus',
      },
      {
        id: 'gross-margin',
        claim: 'Gross margins stay in the mid-70s, proving pricing power on accelerators',
        breaks_if: 'Gross margin compresses materially toward the 60s on competition or supply costs',
      },
    ],
  },
  {
    ticker: 'AAPL',
    company: 'Apple',
    pillars: [
      {
        id: 'iphone-cycle',
        claim: 'iPhone remains the cash engine with a healthy upgrade cycle and stable unit demand',
        breaks_if: 'iPhone revenue declines year over year for multiple quarters, especially in China',
      },
      {
        id: 'services-growth',
        claim: 'Services revenue keeps growing double digits at high margin, lifting blended margins',
        breaks_if: 'Services growth decelerates to single digits or an antitrust ruling forces the Google search payment to end',
      },
    ],
  },
  {
    ticker: 'MSFT',
    company: 'Microsoft',
    pillars: [
      {
        id: 'azure-ai',
        claim: 'Azure keeps growing in the high 20s to low 30s as AI workloads drive cloud consumption',
        breaks_if: 'Azure growth decelerates sharply or guidance signals AI demand is not converting to cloud revenue',
      },
      {
        id: 'copilot-monetization',
        claim: 'Copilot seats convert into real per-seat revenue across the Microsoft 365 base',
        breaks_if: 'Management signals weak Copilot attach or pricing, or pulls Copilot revenue disclosure',
      },
    ],
  },
  {
    ticker: 'GOOGL',
    company: 'Alphabet',
    pillars: [
      {
        id: 'search-moat',
        claim: 'Search ad revenue keeps growing even as AI Overviews change the result page',
        breaks_if: 'Search revenue declines or management admits AI answers are cannibalizing query monetization',
      },
      {
        id: 'cloud-profit',
        claim: 'Google Cloud sustains growth and stays operating-profit positive',
        breaks_if: 'Cloud growth stalls or the segment swings back to an operating loss',
      },
      {
        id: 'antitrust',
        claim: 'Antitrust remedies stay manageable without forcing a breakup of core ad or Chrome assets',
        breaks_if: 'A court orders divestiture of Chrome, ad tech, or the default search distribution model',
      },
    ],
  },
  {
    ticker: 'AMZN',
    company: 'Amazon',
    pillars: [
      {
        id: 'aws-growth',
        claim: 'AWS reaccelerates on AI demand and remains the profit engine of the company',
        breaks_if: 'AWS growth decelerates below the low 20s or its operating margin compresses sharply',
      },
      {
        id: 'retail-margin',
        claim: 'Retail and advertising operating margins keep expanding on logistics efficiency',
        breaks_if: 'North America retail operating margin contracts or swings to a loss',
      },
    ],
  },
  {
    ticker: 'META',
    company: 'Meta Platforms',
    pillars: [
      {
        id: 'ad-engagement',
        claim: 'AI-driven recommendations keep ad engagement and pricing rising across the family of apps',
        breaks_if: 'Ad revenue growth stalls or average price per ad falls year over year',
      },
      {
        id: 'reality-labs-discipline',
        claim: 'Core app profitability funds Reality Labs without total margins collapsing',
        breaks_if: 'Reality Labs losses widen materially while overall operating margin contracts',
      },
    ],
  },
  {
    ticker: 'TSLA',
    company: 'Tesla',
    pillars: [
      {
        id: 'delivery-growth',
        claim: 'Vehicle deliveries return to growth as new lower-cost models launch',
        breaks_if: 'Annual deliveries decline again or new affordable models slip further',
      },
      {
        id: 'autonomy',
        claim: 'Robotaxi and full self-driving move from promise to revenue-generating deployment',
        breaks_if: 'A robotaxi rollout is halted by regulators or a major safety incident, or timelines slip again',
      },
      {
        id: 'auto-margin',
        claim: 'Automotive gross margin stabilizes after years of price cuts',
        breaks_if: 'Automotive gross margin (ex-credits) keeps falling toward break-even',
      },
    ],
  },
  {
    ticker: 'AMD',
    company: 'AMD',
    pillars: [
      {
        id: 'mi-accelerators',
        claim: 'Instinct MI-series GPUs win real data-center share as the credible NVIDIA alternative',
        breaks_if: 'AMD cuts its data-center GPU revenue outlook or a flagship customer drops the platform',
      },
      {
        id: 'server-cpu-share',
        claim: 'EPYC keeps taking server CPU share from Intel',
        breaks_if: 'Server CPU share gains stall or reverse against Intel or Arm-based designs',
      },
    ],
  },
  {
    ticker: 'AVGO',
    company: 'Broadcom',
    pillars: [
      {
        id: 'custom-silicon',
        claim: 'Custom AI accelerator (XPU) demand from hyperscalers drives semiconductor growth',
        breaks_if: 'A major custom-silicon customer pauses orders or AI semiconductor guidance is cut',
      },
      {
        id: 'vmware-integration',
        claim: 'VMware subscription conversion lifts software margins and cash flow',
        breaks_if: 'Infrastructure software revenue disappoints or large VMware customers churn off the new model',
      },
    ],
  },
  {
    ticker: 'SMCI',
    company: 'Super Micro Computer',
    pillars: [
      {
        id: 'ai-server-demand',
        claim: 'AI server demand keeps revenue growing as liquid-cooled GPU racks ship at volume',
        breaks_if: 'Revenue guidance is cut or order momentum for GPU servers clearly slows',
      },
      {
        id: 'accounting-trust',
        claim: 'Financial reporting stays clean and timely after prior filing delays restored confidence',
        breaks_if: 'The company misses a filing deadline again or discloses a new accounting issue or restatement',
      },
    ],
  },
  {
    ticker: 'ARM',
    company: 'Arm Holdings',
    pillars: [
      {
        id: 'royalty-mix',
        claim: 'Royalty revenue grows as newer higher-royalty-rate v9 and compute subsystem designs ramp',
        breaks_if: 'Royalty revenue growth stalls or the v9 and CSS royalty mix fails to lift the blended rate',
      },
      {
        id: 'datacenter-arm',
        claim: 'Arm-based CPUs win meaningful data-center and AI share beyond mobile',
        breaks_if: 'Data-center design wins fail to convert to royalties or a flagship licensee defects',
      },
    ],
  },
  {
    ticker: 'MU',
    company: 'Micron Technology',
    pillars: [
      {
        id: 'hbm-demand',
        claim: 'High-bandwidth memory for AI accelerators stays sold out and lifts blended pricing',
        breaks_if: 'HBM is no longer sold out, pricing rolls over, or a major customer qualification slips',
      },
      {
        id: 'memory-cycle',
        claim: 'The DRAM and NAND pricing cycle stays in an up-phase, expanding gross margins',
        breaks_if: 'DRAM or NAND average selling prices turn down and gross margin contracts',
      },
    ],
  },
  {
    ticker: 'TSM',
    company: 'Taiwan Semiconductor',
    pillars: [
      {
        id: 'leading-edge',
        claim: 'TSMC keeps a near-monopoly on leading-edge nodes for every major AI and mobile chip',
        breaks_if: 'A competitor reaches volume parity at the leading edge or a top customer moves advanced orders elsewhere',
      },
      {
        id: 'ai-revenue',
        claim: 'AI-related revenue keeps compounding and lifts full-year growth guidance',
        breaks_if: 'TSMC cuts its full-year revenue growth outlook or signals AI demand is softening',
      },
    ],
  },
  {
    ticker: 'MRVL',
    company: 'Marvell Technology',
    pillars: [
      {
        id: 'custom-ai-silicon',
        claim: 'Custom AI silicon and electro-optics for hyperscalers drive data-center revenue growth',
        breaks_if: 'A major custom-silicon program is delayed or lost, or data-center guidance is cut',
      },
      {
        id: 'datacenter-mix',
        claim: 'The shift toward higher-margin data-center revenue offsets weak legacy end markets',
        breaks_if: 'Data-center revenue stalls while legacy enterprise and carrier segments keep shrinking',
      },
    ],
  },
  {
    ticker: 'PLTR',
    company: 'Palantir',
    pillars: [
      {
        id: 'gov-revenue',
        claim: 'Government revenue stays sticky and keeps growing',
        breaks_if: 'A major government contract is cancelled, not renewed, or put under review',
      },
      {
        id: 'commercial-aip',
        claim: 'US commercial revenue accelerates as AIP deployments convert pilots into contracts',
        breaks_if: 'US commercial revenue growth decelerates or AIP customer count growth stalls',
      },
      {
        id: 'valuation-growth',
        claim: 'Rule-of-40 expansion and accelerating revenue justify a premium multiple',
        breaks_if: 'Revenue growth decelerates while the stock still trades at an extreme sales multiple',
      },
    ],
  },
  {
    ticker: 'COIN',
    company: 'Coinbase',
    pillars: [
      {
        id: 'crypto-volume',
        claim: 'Trading volume and transaction revenue rise with crypto market activity',
        breaks_if: 'A crypto bear market collapses trading volume and transaction revenue',
      },
      {
        id: 'subscription-revenue',
        claim: 'Subscription and services revenue (staking, stablecoin, custody) diversifies away from trading',
        breaks_if: 'A regulatory action curbs staking or stablecoin economics, cutting subscription revenue',
      },
    ],
  },
  {
    ticker: 'HOOD',
    company: 'Robinhood',
    pillars: [
      {
        id: 'arpu-growth',
        claim: 'Average revenue per user climbs as crypto, options, and Gold subscriptions expand',
        breaks_if: 'ARPU falls as trading activity or crypto revenue drops sharply',
      },
      {
        id: 'new-products',
        claim: 'New products like retirement, advisory, and futures broaden the wallet beyond trading',
        breaks_if: 'New product adoption stalls or net deposits turn negative',
      },
    ],
  },
  {
    ticker: 'SOFI',
    company: 'SoFi Technologies',
    pillars: [
      {
        id: 'member-growth',
        claim: 'Member and product growth compounds, cross-selling lending and financial services',
        breaks_if: 'Member growth decelerates sharply or products-per-member stops expanding',
      },
      {
        id: 'credit-quality',
        claim: 'Loan charge-offs stay contained as the bank charter funds lending cheaply',
        breaks_if: 'Net charge-off rates spike, signaling deteriorating credit on the loan book',
      },
    ],
  },
  {
    ticker: 'RIVN',
    company: 'Rivian',
    pillars: [
      {
        id: 'r2-launch',
        claim: 'The lower-cost R2 platform launches on time and unlocks volume growth',
        breaks_if: 'R2 production slips materially or its launch pricing breaks the volume thesis',
      },
      {
        id: 'gross-margin-path',
        claim: 'Per-vehicle costs fall enough to reach and hold positive gross margin',
        breaks_if: 'Gross margin turns negative again or the cash burn forces a dilutive raise',
      },
    ],
  },
  {
    ticker: 'LCID',
    company: 'Lucid Group',
    pillars: [
      {
        id: 'gravity-ramp',
        claim: 'The Gravity SUV ramps deliveries and lifts total volume beyond the Air sedan',
        breaks_if: 'Gravity production stalls or total annual deliveries fail to grow',
      },
      {
        id: 'funding-runway',
        claim: 'Saudi PIF backing keeps the company funded through the ramp without a collapse in cash',
        breaks_if: 'PIF support wavers or cash runway shortens to the point of a deeply dilutive raise',
      },
    ],
  },
  {
    ticker: 'RDDT',
    company: 'Reddit',
    pillars: [
      {
        id: 'data-licensing',
        claim: 'AI data-licensing deals add high-margin revenue on top of advertising',
        breaks_if: 'A major data-licensing partner does not renew or licensing revenue stops growing',
      },
      {
        id: 'ad-growth',
        claim: 'Advertising revenue and user growth compound as ad tooling and DAU expand',
        breaks_if: 'Daily active users stall or a Google search-algorithm change cuts referral traffic and engagement',
      },
    ],
  },
  {
    ticker: 'MSTR',
    company: 'MicroStrategy (Strategy)',
    pillars: [
      {
        id: 'bitcoin-proxy',
        claim: 'The company is a leveraged bitcoin holding vehicle whose value tracks its BTC stack',
        breaks_if: 'Bitcoin enters a sustained drawdown that drives the BTC holdings well below book',
      },
      {
        id: 'capital-access',
        claim: 'Access to equity and convertible markets lets it keep accumulating bitcoin accretively',
        breaks_if: 'Capital markets close to it or the stock trades at or below net asset value, ending accretive issuance',
      },
    ],
  },
  {
    ticker: 'AFRM',
    company: 'Affirm',
    pillars: [
      {
        id: 'gmv-growth',
        claim: 'Buy-now-pay-later GMV keeps growing through merchant partnerships and the Affirm Card',
        breaks_if: 'GMV growth decelerates sharply or a flagship merchant partner is lost',
      },
      {
        id: 'credit-funding',
        claim: 'Delinquencies stay contained and funding costs allow profitable unit economics',
        breaks_if: 'Delinquency rates rise materially or funding markets tighten enough to erase loan-economics',
      },
    ],
  },
  {
    ticker: 'DKNG',
    company: 'DraftKings',
    pillars: [
      {
        id: 'state-expansion',
        claim: 'Online sports betting and iGaming keep expanding into new states, growing the user base',
        breaks_if: 'A large state legalization stalls or a major state raises betting taxes enough to hurt margins',
      },
      {
        id: 'profitability',
        claim: 'Improving hold rates and promotional discipline drive sustained positive EBITDA',
        breaks_if: 'Adjusted EBITDA turns negative again or structural hold deteriorates',
      },
    ],
  },
  {
    ticker: 'GME',
    company: 'GameStop',
    pillars: [
      {
        id: 'cash-pivot',
        claim: 'The large cash and bitcoin treasury makes the company a capital-allocation story, not a retailer',
        breaks_if: 'The treasury is impaired or burned, or management abandons the capital-allocation pivot',
      },
      {
        id: 'retail-stabilization',
        claim: 'Cost cuts keep the core retail business at or near breakeven while the pivot plays out',
        breaks_if: 'Core retail losses widen again and burn through cash',
      },
    ],
  },
  {
    ticker: 'AMC',
    company: 'AMC Entertainment',
    pillars: [
      {
        id: 'box-office-recovery',
        claim: 'A recovering film slate drives attendance and revenue back toward pre-pandemic levels',
        breaks_if: 'The box office stalls or a thin release slate pushes attendance and revenue back down',
      },
      {
        id: 'debt-survival',
        claim: 'Refinancing and equity raises keep the heavy debt load serviceable',
        breaks_if: 'A debt maturity cannot be refinanced or interest costs threaten a restructuring',
      },
    ],
  },
  {
    ticker: 'DJT',
    company: 'Trump Media & Technology',
    pillars: [
      {
        id: 'platform-monetization',
        claim: 'Truth Social and new ventures begin generating meaningful revenue to back the valuation',
        breaks_if: 'Revenue stays negligible while operating losses keep widening',
      },
      {
        id: 'cash-runway',
        claim: 'A large cash and treasury position funds expansion without an imminent dilution crisis',
        breaks_if: 'The cash position is depleted or a large dilutive share issuance is announced',
      },
    ],
  },
  {
    ticker: 'CVNA',
    company: 'Carvana',
    pillars: [
      {
        id: 'unit-growth-margin',
        claim: 'Retail unit growth resumes while gross profit per unit holds at the higher post-restructuring level',
        breaks_if: 'Gross profit per unit falls sharply or retail unit sales decline year over year',
      },
      {
        id: 'debt-deleveraging',
        claim: 'Rising EBITDA steadily reduces the leverage left from the 2023 debt restructuring',
        breaks_if: 'Adjusted EBITDA rolls over or the debt load becomes unserviceable again',
      },
    ],
  },
  {
    ticker: 'SMR',
    company: 'NuScale Power',
    pillars: [
      {
        id: 'smr-orders',
        claim: 'Small modular reactor demand converts into firm, funded customer orders',
        breaks_if: 'A flagship deployment is cancelled or no firm commercial order materializes',
      },
      {
        id: 'regulatory-design',
        claim: 'NRC design approvals keep NuScale ahead as the most regulator-advanced SMR',
        breaks_if: 'A design certification is delayed or denied, or a rival overtakes its regulatory lead',
      },
    ],
  },
  {
    ticker: 'OKLO',
    company: 'Oklo',
    pillars: [
      {
        id: 'powerhouse-deployment',
        claim: 'The first Aurora powerhouse reaches construction and a path to commercial operation',
        breaks_if: 'The first plant timeline slips materially or its license application is rejected',
      },
      {
        id: 'customer-pipeline',
        claim: 'Signed power-purchase agreements with data centers turn the order pipeline into real demand',
        breaks_if: 'Major customer agreements are cancelled or fail to convert to binding contracts',
      },
    ],
  },
  {
    ticker: 'IONQ',
    company: 'IonQ',
    pillars: [
      {
        id: 'bookings-growth',
        claim: 'Quantum bookings and revenue keep growing as enterprise and government contracts expand',
        breaks_if: 'Bookings guidance is cut or revenue growth stalls',
      },
      {
        id: 'qubit-roadmap',
        claim: 'The company hits its algorithmic qubit and fidelity roadmap milestones on schedule',
        breaks_if: 'A key technical roadmap milestone is missed or pushed out significantly',
      },
    ],
  },
  {
    ticker: 'RGTI',
    company: 'Rigetti Computing',
    pillars: [
      {
        id: 'qubit-scaling',
        claim: 'Superconducting qubit count and two-qubit fidelity improve on the published roadmap',
        breaks_if: 'A milestone chip slips or fidelity targets are missed',
      },
      {
        id: 'funding-runway',
        claim: 'The cash position funds the multi-year roadmap without a near-term liquidity crisis',
        breaks_if: 'Cash runway shortens to the point of a deeply dilutive raise or going-concern doubt',
      },
    ],
  },
  {
    ticker: 'NFLX',
    company: 'Netflix',
    pillars: [
      {
        id: 'ad-tier',
        claim: 'The ad-supported tier and paid sharing keep growing revenue and members',
        breaks_if: 'Member growth turns negative or ad-tier monetization stalls',
      },
      {
        id: 'margin-expansion',
        claim: 'Operating margin keeps expanding as revenue outgrows content spend',
        breaks_if: 'Operating margin guidance is cut or content costs outpace revenue growth',
      },
    ],
  },
  {
    ticker: 'DIS',
    company: 'Walt Disney',
    pillars: [
      {
        id: 'streaming-profit',
        claim: 'Direct-to-consumer streaming stays profitable and grows operating income',
        breaks_if: 'The streaming segment slips back to an operating loss',
      },
      {
        id: 'parks-strength',
        claim: 'Parks and Experiences keep generating strong, growing operating income',
        breaks_if: 'Parks operating income declines on weak attendance or consumer spending',
      },
    ],
  },
  {
    ticker: 'BA',
    company: 'Boeing',
    pillars: [
      {
        id: 'production-rate',
        claim: '737 MAX and 787 production rates climb under the FAA-approved ramp, lifting deliveries',
        breaks_if: 'A new safety or quality issue caps production or the FAA freezes the rate increase',
      },
      {
        id: 'cash-flow-turn',
        claim: 'Rising deliveries turn free cash flow positive and stabilize the balance sheet',
        breaks_if: 'Free cash flow stays deeply negative or a new charge forces another capital raise',
      },
    ],
  },
  {
    ticker: 'UBER',
    company: 'Uber Technologies',
    pillars: [
      {
        id: 'profitable-growth',
        claim: 'Gross bookings keep growing while the company sustains GAAP profitability and free cash flow',
        breaks_if: 'Gross bookings growth decelerates sharply or the company falls back into operating losses',
      },
      {
        id: 'autonomy-partnerships',
        claim: 'Uber positions as the demand network for autonomous vehicles via partnerships rather than a threat',
        breaks_if: 'A major AV partner builds a competing rider network or pulls volume off the Uber platform',
      },
    ],
  },
  {
    ticker: 'SHOP',
    company: 'Shopify',
    pillars: [
      {
        id: 'gmv-takerate',
        claim: 'Merchant GMV keeps growing and merchant-solutions take rate rises with payments and lending',
        breaks_if: 'GMV growth decelerates sharply or merchant-solutions take rate contracts',
      },
      {
        id: 'free-cash-flow',
        claim: 'Operating discipline keeps free cash flow margin expanding after exiting logistics',
        breaks_if: 'Free cash flow margin contracts or operating expenses reaccelerate ahead of revenue',
      },
    ],
  },
  {
    ticker: 'SNAP',
    company: 'Snap',
    pillars: [
      {
        id: 'ad-rebuild',
        claim: 'The rebuilt direct-response ad platform reaccelerates advertising revenue',
        breaks_if: 'Advertising revenue growth stalls or turns negative again',
      },
      {
        id: 'user-monetization',
        claim: 'Daily active users keep growing and Snapchat+ subscriptions diversify revenue',
        breaks_if: 'Daily active users decline in core markets or subscription growth stalls',
      },
    ],
  },
  {
    ticker: 'PYPL',
    company: 'PayPal',
    pillars: [
      {
        id: 'branded-checkout',
        claim: 'Branded checkout reaccelerates and transaction margin dollars grow under the new strategy',
        breaks_if: 'Branded checkout volume keeps losing share or transaction margin dollars decline',
      },
      {
        id: 'venmo-monetization',
        claim: 'Venmo monetization and Buy Now Pay Later add profitable engaged-user revenue',
        breaks_if: 'Venmo monetization stalls or active accounts keep shrinking',
      },
    ],
  },
  {
    ticker: 'INTC',
    company: 'Intel',
    pillars: [
      {
        id: 'foundry-turnaround',
        claim: 'The 18A node and foundry strategy win external customers and a credible path to profitability',
        breaks_if: '18A yields disappoint, a flagship foundry customer walks, or the foundry losses keep widening',
      },
      {
        id: 'share-defense',
        claim: 'Intel defends enough x86 CPU share to fund the foundry buildout',
        breaks_if: 'CPU share losses to AMD or Arm accelerate, draining the cash needed for the turnaround',
      },
    ],
  },
];

export function missingTheses(): string[] {
  const have = new Set(HOUSE_THESES.map((t) => t.ticker));
  return CONTENT_UNIVERSE.filter((t) => !have.has(t));
}
export function getHouseThesis(ticker: string): HouseThesis | undefined {
  return HOUSE_THESES.find((t) => t.ticker === ticker.toUpperCase());
}
