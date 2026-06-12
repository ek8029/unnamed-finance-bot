/**
 * SEC EDGAR XBRL Client
 *
 * Public-domain financial statement data straight from SEC filings.
 * No API key, no license restrictions, no redistribution limits.
 * Rate limit: 10 req/s. SEC requires a descriptive User-Agent.
 *
 * Replaces Finnhub /stock/financials-reported for the statements feature.
 */

export interface StatementLineItem {
  concept: string;
  label: string;
  unit: string;
  value: number;
}

export interface ReportedFinancials {
  year: number;
  endDate: string;
  form: string;
  ic: StatementLineItem[]; // income statement
  bs: StatementLineItem[]; // balance sheet
  cf: StatementLineItem[]; // cash flow
}

const UA = 'Helm Terminal hello@helmterminal.dev';

// ── In-memory cache ──

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// ── Ticker → CIK ──

interface TickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

const TICKER_MAP_TTL = 24 * 60 * 60 * 1000;

async function getCik(symbol: string): Promise<string | null> {
  const upper = symbol.toUpperCase();
  let map = getCached<Map<string, number>>('edgar:tickers');
  if (!map) {
    try {
      const res = await fetch('https://www.sec.gov/files/company_tickers.json', {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!res.ok) {
        console.error(`EDGAR company_tickers error: ${res.status}`);
        return null;
      }
      const data: Record<string, TickerEntry> = await res.json();
      map = new Map();
      for (const entry of Object.values(data)) {
        map.set(entry.ticker.toUpperCase(), entry.cik_str);
      }
      setCache('edgar:tickers', map, TICKER_MAP_TTL);
    } catch (error) {
      console.error('EDGAR company_tickers failed:', error);
      return null;
    }
  }
  const cik = map.get(upper);
  return cik != null ? String(cik).padStart(10, '0') : null;
}

// ── Curated concept lists ──
// companyfacts returns every XBRL concept ever filed; we map a curated set
// to readable statement line items. Arrays = fallback chain (filers differ).

type ConceptDef = { label: string; concepts: string[] };

const IC_CONCEPTS: ConceptDef[] = [
  { label: 'Revenue', concepts: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet'] },
  { label: 'Cost of revenue', concepts: ['CostOfGoodsAndServicesSold', 'CostOfRevenue', 'CostOfGoodsSold'] },
  { label: 'Gross profit', concepts: ['GrossProfit'] },
  { label: 'Research and development', concepts: ['ResearchAndDevelopmentExpense'] },
  { label: 'Selling, general and administrative', concepts: ['SellingGeneralAndAdministrativeExpense'] },
  { label: 'Total operating expenses', concepts: ['OperatingExpenses'] },
  { label: 'Operating income', concepts: ['OperatingIncomeLoss'] },
  { label: 'Interest expense', concepts: ['InterestExpense', 'InterestExpenseNonoperating'] },
  { label: 'Income before income taxes', concepts: ['IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest', 'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments'] },
  { label: 'Income tax provision', concepts: ['IncomeTaxExpenseBenefit'] },
  { label: 'Net income', concepts: ['NetIncomeLoss'] },
  { label: 'EPS, basic', concepts: ['EarningsPerShareBasic'] },
  { label: 'EPS, diluted', concepts: ['EarningsPerShareDiluted'] },
  { label: 'Shares outstanding, basic (weighted avg)', concepts: ['WeightedAverageNumberOfSharesOutstandingBasic'] },
  { label: 'Shares outstanding, diluted (weighted avg)', concepts: ['WeightedAverageNumberOfDilutedSharesOutstanding'] },
];

const BS_CONCEPTS: ConceptDef[] = [
  { label: 'Cash and cash equivalents', concepts: ['CashAndCashEquivalentsAtCarryingValue'] },
  { label: 'Short-term investments', concepts: ['MarketableSecuritiesCurrent', 'ShortTermInvestments', 'AvailableForSaleSecuritiesDebtSecuritiesCurrent'] },
  { label: 'Accounts receivable, net', concepts: ['AccountsReceivableNetCurrent'] },
  { label: 'Inventories', concepts: ['InventoryNet'] },
  { label: 'Total current assets', concepts: ['AssetsCurrent'] },
  { label: 'Property, plant and equipment, net', concepts: ['PropertyPlantAndEquipmentNet'] },
  { label: 'Goodwill', concepts: ['Goodwill'] },
  { label: 'Total assets', concepts: ['Assets'] },
  { label: 'Accounts payable', concepts: ['AccountsPayableCurrent'] },
  { label: 'Total current liabilities', concepts: ['LiabilitiesCurrent'] },
  { label: 'Long-term debt', concepts: ['LongTermDebtNoncurrent', 'LongTermDebt'] },
  { label: 'Total liabilities', concepts: ['Liabilities'] },
  { label: 'Retained earnings (accumulated deficit)', concepts: ['RetainedEarningsAccumulatedDeficit'] },
  { label: "Total stockholders' equity", concepts: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'] },
];

const CF_CONCEPTS: ConceptDef[] = [
  { label: 'Net income', concepts: ['NetIncomeLoss'] },
  { label: 'Depreciation and amortization', concepts: ['DepreciationDepletionAndAmortization', 'DepreciationAmortizationAndAccretionNet', 'DepreciationAndAmortization'] },
  { label: 'Share-based compensation', concepts: ['ShareBasedCompensation'] },
  { label: 'Cash from operating activities', concepts: ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'] },
  { label: 'Capital expenditures', concepts: ['PaymentsToAcquirePropertyPlantAndEquipment'] },
  { label: 'Cash from investing activities', concepts: ['NetCashProvidedByUsedInInvestingActivities', 'NetCashProvidedByUsedInInvestingActivitiesContinuingOperations'] },
  { label: 'Dividends paid', concepts: ['PaymentsOfDividends', 'PaymentsOfDividendsCommonStock'] },
  { label: 'Share repurchases', concepts: ['PaymentsForRepurchaseOfCommonStock'] },
  { label: 'Cash from financing activities', concepts: ['NetCashProvidedByUsedInFinancingActivities', 'NetCashProvidedByUsedInFinancingActivitiesContinuingOperations'] },
];

// ── companyfacts parsing ──

interface XbrlFact {
  end: string;
  val: number;
  fy: number;
  fp: string;
  form: string;
  filed: string;
  start?: string;
  frame?: string;
}

interface CompanyFacts {
  facts?: {
    'us-gaap'?: Record<string, { units: Record<string, XbrlFact[]> }>;
  };
}

const FACTS_TTL = 24 * 60 * 60 * 1000;

/**
 * Pick the annual (10-K, fp=FY) fact for a given fiscal year end date.
 * Duration concepts (revenue etc.) must span ~a year; instant concepts
 * (balance sheet) have no start. Prefers the most recently filed value.
 */
function pickAnnualFact(facts: XbrlFact[], endDate: string): XbrlFact | null {
  const candidates = facts.filter((f) => {
    if (!f.form.startsWith('10-K') || f.end !== endDate) return false;
    if (f.start) {
      const days = (new Date(f.end).getTime() - new Date(f.start).getTime()) / 86400000;
      if (days < 300 || days > 400) return false; // exclude quarterly durations
    }
    return true;
  });
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => (a.filed < b.filed ? 1 : -1));
  return candidates[0];
}

function unitToLabel(unit: string): string {
  if (unit === 'USD') return 'usd';
  if (unit === 'USD/shares') return 'usd/share';
  if (unit === 'shares') return 'shares';
  return unit.toLowerCase();
}

function buildStatement(
  defs: ConceptDef[],
  gaap: Record<string, { units: Record<string, XbrlFact[]> }>,
  endDate: string,
): StatementLineItem[] {
  const items: StatementLineItem[] = [];
  for (const def of defs) {
    for (const concept of def.concepts) {
      const conceptData = gaap[concept];
      if (!conceptData) continue;
      let found = false;
      for (const [unit, facts] of Object.entries(conceptData.units)) {
        const fact = pickAnnualFact(facts, endDate);
        if (fact) {
          items.push({ concept, label: def.label, unit: unitToLabel(unit), value: fact.val });
          found = true;
          break;
        }
      }
      if (found) break; // stop at first concept in fallback chain with data
    }
  }
  return items;
}

/**
 * Latest 3 annual (10-K) reports from SEC EDGAR, newest first.
 * Drop-in replacement for the Finnhub-backed getReportedFinancials.
 */
export async function getReportedFinancialsEdgar(symbol: string): Promise<ReportedFinancials[]> {
  const cacheKey = `edgar:statements:${symbol.toUpperCase()}`;
  const cached = getCached<ReportedFinancials[]>(cacheKey);
  if (cached) return cached;

  const cik = await getCik(symbol);
  if (!cik) return [];

  let factsData: CompanyFacts;
  try {
    const res = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error(`EDGAR companyfacts ${symbol} error: ${res.status}`);
      return [];
    }
    factsData = await res.json();
  } catch (error) {
    console.error(`EDGAR companyfacts ${symbol} failed:`, error);
    return [];
  }

  const gaap = factsData.facts?.['us-gaap'];
  if (!gaap) return [];

  // Find fiscal year end dates: 10-K annual net income facts are the most
  // reliably present concept across filers.
  const anchor = gaap['NetIncomeLoss'] || gaap['Revenues'] || gaap['Assets'];
  if (!anchor) return [];

  const fyEnds = new Map<string, number>(); // endDate → fy
  for (const facts of Object.values(anchor.units)) {
    for (const f of facts) {
      if (!f.form.startsWith('10-K')) continue;
      if (f.start) {
        const days = (new Date(f.end).getTime() - new Date(f.start).getTime()) / 86400000;
        if (days < 300 || days > 400) continue;
      }
      const existing = fyEnds.get(f.end);
      if (existing == null || f.fy > existing) fyEnds.set(f.end, f.fy);
    }
  }

  const latest = [...fyEnds.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, 3);

  // XBRL `fy` is the filing's fiscal year, not the period's — comparative
  // figures in a FY2025 10-K all carry fy=2025. Derive year from end date.
  const reports: ReportedFinancials[] = latest.map(([endDate]) => ({
    year: parseInt(endDate.slice(0, 4), 10),
    endDate,
    form: '10-K',
    ic: buildStatement(IC_CONCEPTS, gaap, endDate),
    bs: buildStatement(BS_CONCEPTS, gaap, endDate),
    cf: buildStatement(CF_CONCEPTS, gaap, endDate),
  }));

  const valid = reports.filter((r) => r.ic.length + r.bs.length + r.cf.length > 0);
  if (valid.length > 0) setCache(cacheKey, valid, FACTS_TTL);
  return valid;
}

// ── Company profile (submissions endpoint) ──

// ── Recent filings (8-K material events) ──

export interface EdgarFiling {
  form: string;
  filingDate: string; // YYYY-MM-DD
  items: string[]; // 8-K item numbers, e.g. ['2.02', '9.01']
  url: string;
}

const FILINGS_TTL = 60 * 60 * 1000; // 1 hour

async function fetchSubmissions(cik: string): Promise<any | null> {
  try {
    const res = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error(`EDGAR submissions CIK${cik} error: ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (error) {
    console.error(`EDGAR submissions CIK${cik} failed:`, error);
    return null;
  }
}

/**
 * Fetch a company's recent EDGAR filings (newest first), optionally
 * filtered to those on/after `sinceDate` (YYYY-MM-DD).
 */
export async function getRecentFilings(symbol: string, sinceDate?: string): Promise<EdgarFiling[]> {
  const cacheKey = `edgar:filings:${symbol.toUpperCase()}`;
  let filings = getCached<EdgarFiling[]>(cacheKey);

  if (!filings) {
    const cik = await getCik(symbol);
    if (!cik) return [];

    const data = await fetchSubmissions(cik);
    if (!data) return [];

    const recent = data.filings?.recent;
    if (!recent?.form) return [];

    const cikNum = String(Number(cik)); // strip leading zeros for archive URLs
    filings = [];
    for (let i = 0; i < recent.form.length && i < 100; i++) {
      const accession = (recent.accessionNumber?.[i] || '').replace(/-/g, '');
      const doc = recent.primaryDocument?.[i] || '';
      filings.push({
        form: recent.form[i],
        filingDate: recent.filingDate?.[i] || '',
        items: (recent.items?.[i] || '').split(',').map((s: string) => s.trim()).filter(Boolean),
        url: accession && doc
          ? `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accession}/${doc}`
          : `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=8-K`,
      });
    }
    setCache(cacheKey, filings, FILINGS_TTL);
  }

  return sinceDate ? filings.filter(f => f.filingDate >= sinceDate) : filings;
}

export interface EdgarCompanyProfile {
  name: string;
  sicDescription: string | null;
  exchange: string | null;
}

const PROFILE_TTL = 24 * 60 * 60 * 1000;

export async function getCompanyProfileEdgar(symbol: string): Promise<EdgarCompanyProfile | null> {
  const cacheKey = `edgar:profile:${symbol.toUpperCase()}`;
  const cached = getCached<EdgarCompanyProfile>(cacheKey);
  if (cached) return cached;

  const cik = await getCik(symbol);
  if (!cik) return null;

  const data = await fetchSubmissions(cik);
  if (!data) return null;

  const profile: EdgarCompanyProfile = {
    name: data.name || symbol.toUpperCase(),
    sicDescription: data.sicDescription || null,
    exchange: Array.isArray(data.exchanges) && data.exchanges[0] ? data.exchanges[0] : null,
  };
  setCache(cacheKey, profile, PROFILE_TTL);
  return profile;
}

// ── Form 4 (insider transactions) ──

export interface Form4Transaction {
  code: string;           // S, P, A, M, F, G...
  shares: number;
  pricePerShare: number | null;
  value: number | null;   // shares * price when price present
  date: string;           // YYYY-MM-DD
  isDisposition: boolean; // transactionAcquiredDisposedCode === 'D'
}

export interface ParsedForm4 {
  ownerName: string;
  ownerRole: string;      // "CEO", "Director", "10% owner", or "" — from officerTitle/relationship flags
  is10b51: boolean;
  transactions: Form4Transaction[];
}

export interface Form4Summary extends ParsedForm4 {
  accessionNumber: string;  // dedupe key (source_key)
  filedAt: string;
  url: string;              // human-viewable filing index URL
  totalSaleValue: number;   // sum of disposition S-code values
}

/** Extract the text content of a simple XML element, e.g. <foo>bar</foo> → "bar". */
function xmlText(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 's'));
  return m ? m[1].trim() : '';
}

/**
 * Extract all occurrences of a repeating block between <tag> and </tag>.
 * Used to pull individual <nonDerivativeTransaction> blocks.
 */
function xmlBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`, 'g');
  return xml.match(re) ?? [];
}

/**
 * Within a <transactionAmounts> block, get the first <value> child inside
 * <transactionPricePerShare> (may be absent when only footnoteId children exist).
 */
function xmlChildValue(block: string, outerTag: string): string {
  // Find the outer tag's inner content, then grab the first <value> inside it
  const outerMatch = block.match(new RegExp(`<${outerTag}[\\s\\S]*?<\\/${outerTag}>`));
  if (!outerMatch) return '';
  const innerMatch = outerMatch[0].match(/<value>([^<]*)<\/value>/);
  return innerMatch ? innerMatch[1].trim() : '';
}

/**
 * Parse a Form 4 ownershipDocument XML string into a structured object.
 * Uses regex/string extraction only — no XML parser dependency.
 */
export function parseForm4Xml(xml: string): ParsedForm4 {
  // Owner name
  const ownerName = xmlText(xml, 'rptOwnerName');

  // Owner role: prefer officerTitle, fall back to relationship flags
  let ownerRole = xmlText(xml, 'officerTitle');
  if (!ownerRole) {
    const isDirector = xmlText(xml, 'isDirector');
    const isTenPct = xmlText(xml, 'isTenPercentOwner');
    if (isDirector === '1' || isDirector === 'true') ownerRole = 'Director';
    else if (isTenPct === '1' || isTenPct === 'true') ownerRole = '10% owner';
  }

  // 10b5-1 detection: aff10b5One === 1/true OR any footnote text matches /10b5-1/i
  const aff = xmlText(xml, 'aff10b5One').toLowerCase();
  const hasAffFlag = aff === '1' || aff === 'true';
  const hasFootnote = /10b5-1/i.test(xml);
  const is10b51 = hasAffFlag || hasFootnote;

  // Parse nonDerivativeTransaction blocks only (derivative table is separate)
  // Isolate the nonDerivativeTable to avoid matching derivative transactions
  const ndTableMatch = xml.match(/<nonDerivativeTable[\s\S]*?<\/nonDerivativeTable>/);
  const ndXml = ndTableMatch ? ndTableMatch[0] : '';
  const txBlocks = xmlBlocks(ndXml, 'nonDerivativeTransaction');

  const transactions: Form4Transaction[] = [];
  for (const block of txBlocks) {
    const code = xmlText(block, 'transactionCode');
    if (!code) continue;

    const sharesStr = xmlChildValue(block, 'transactionShares');
    const shares = sharesStr ? parseFloat(sharesStr) : 0;
    if (!(shares > 0)) continue;

    const priceStr = xmlChildValue(block, 'transactionPricePerShare');
    const priceRaw = priceStr ? parseFloat(priceStr) : null;
    // Price of 0 is typically used for awards/gifts — treat as null (no dollar value)
    const pricePerShare = priceRaw != null && priceRaw > 0 ? priceRaw : null;
    const value = pricePerShare != null ? shares * pricePerShare : null;

    const dateStr = xmlChildValue(block, 'transactionDate');
    const date = dateStr || xmlText(block, 'transactionDate');

    const adCode = xmlChildValue(block, 'transactionAcquiredDisposedCode');
    const isDisposition = adCode === 'D';

    transactions.push({ code, shares, pricePerShare, value, date, isDisposition });
  }

  return { ownerName, ownerRole, is10b51, transactions };
}

/**
 * Fetch up to 25 most recent Form 4 filings for a symbol since sinceDate.
 * Serializes document fetches to stay under EDGAR's 10 req/s limit.
 */
export async function getForm4Filings(symbol: string, sinceDate: string): Promise<Form4Summary[]> {
  const cik = await getCik(symbol);
  if (!cik) return [];

  const cikNum = String(Number(cik)); // strip leading zeros for archive URLs

  const submissionsData = await fetchSubmissions(cik);
  if (!submissionsData) return [];

  const recent = submissionsData.filings?.recent;
  if (!recent?.form) return [];

  const forms = recent.form as string[];
  const dates = recent.filingDate as string[];
  const accessions = recent.accessionNumber as string[];

  // Collect Form 4s on/after sinceDate, newest first, cap at 25
  const candidates: Array<{ accDashed: string; accNoDashes: string; filedAt: string }> = [];
  for (let i = 0; i < forms.length && candidates.length < 25; i++) {
    if (forms[i] !== '4') continue;
    const filedAt = dates[i] || '';
    if (filedAt < sinceDate) continue;
    candidates.push({
      accDashed: accessions[i],
      accNoDashes: accessions[i].replace(/-/g, ''),
      filedAt,
    });
  }

  const results: Form4Summary[] = [];

  for (const { accDashed, accNoDashes, filedAt } of candidates) {
    try {
      // Fetch the filing index to find the raw XML file
      const indexUrl = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accNoDashes}/index.json`;
      const indexRes = await fetch(indexUrl, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!indexRes.ok) continue;

      const indexData = await indexRes.json();
      const items: Array<{ name: string }> = indexData.directory?.item ?? [];

      // Pick the .xml file not under xslF345X*/ path (that's the rendered stylesheet version)
      const xmlFile = items.find(
        (it) => it.name.endsWith('.xml') && !it.name.startsWith('xslF345X'),
      );
      if (!xmlFile) continue;

      const xmlUrl = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accNoDashes}/${xmlFile.name}`;
      const xmlRes = await fetch(xmlUrl, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!xmlRes.ok) continue;

      const xml = await xmlRes.text();
      const parsed = parseForm4Xml(xml);

      // Skip filings with no transactions (holdings-only filings)
      if (parsed.transactions.length === 0) continue;

      const totalSaleValue = parsed.transactions
        .filter((t) => t.code === 'S' && t.isDisposition && t.value != null)
        .reduce((sum, t) => sum + (t.value ?? 0), 0);

      const url = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accNoDashes}/${accDashed}-index.htm`;

      results.push({
        ...parsed,
        accessionNumber: accDashed,
        filedAt,
        url,
        totalSaleValue,
      });
    } catch (err) {
      console.warn(`Form4 parse failed for ${accDashed}:`, err);
    }
  }

  return results;
}
