// lib/thesis-synthesis.ts
// Cross-thesis clustering pipeline: find hidden concentration where pillars from
// 2+ different tickers depend on the same underlying driver. Single LLM pass,
// grounded (clusters may only reference real pillars) and neutral (describes
// concentration, never advises). Extracted from the synthesis route so both the
// route AND the cross-thesis risk monitor compose the same tool.

import OpenAI from 'openai';

export const SYNTHESIS_MODEL = 'gpt-4o';

export interface SynthPillarInput {
  id: string;
  ticker: string;
  claim: string;
}

export interface SynthCluster {
  driver: string;
  pillars: { ticker: string; claim: string; pillarId: string }[];
  rationale: string;
}

export const SYNTHESIS_SYSTEM_PROMPT = `You are an equity analyst finding HIDDEN CONCENTRATION across a user's investment theses. Each numbered pillar below is one reason the user holds a position. Pillars from DIFFERENT tickers often depend on the SAME underlying driver (for example: AI datacenter capex, the interest-rate path, consumer credit health, energy prices, GLP-1 demand). When several positions share a driver, one change in that driver moves them together, which is concentration the user may not see when tracking each position separately.

Identify clusters where pillars from 2 OR MORE DIFFERENT tickers depend on the same underlying driver.

Rules:
- Only group pillars that genuinely share a driver. Do not force connections.
- Every cluster MUST span at least 2 different tickers.
- Reference only the pillar numbers provided. Never invent pillars, tickers, facts, or numbers.
- driver: a short noun phrase naming a SPECIFIC EXTERNAL dependency. Valid drivers are a named end-market or customer segment (for example consumer discretionary spending, data-center capex, auto demand), a macro variable (the interest-rate path, oil prices), a named input cost or commodity, a regulation, or a specific technology demand (for example GLP-1 demand). Do NOT group on generic internal capabilities that every company has, such as operational efficiency, cost management, execution, margins, profitability, operating leverage, or capital allocation. Those are not shared drivers and must be omitted.
- rationale: 1 to 2 neutral sentences describing how the listed pillars depend on that driver and that they would tend to move together. Describe the concentration only. Do NOT give advice or recommendations. Never use buy, sell, hold, trim, reduce, add, rebalance, or diversify. No em dashes.
- Omit weak or single-ticker groupings entirely. If nothing genuinely connects, return an empty array.

Respond with JSON exactly in this shape:
{ "clusters": [ { "driver": "...", "pillar_indices": [<1-based pillar numbers>], "rationale": "..." } ] }`;

// Generic internal capabilities every company has. A "driver" that names one of
// these is not a shared external dependency; it is the LLM forcing a connection.
// Deterministic backstop to the prompt rule above.
const GENERIC_DRIVERS = [
  'operational efficiency',
  'operating efficiency',
  'operational excellence',
  'cost management',
  'cost control',
  'cost discipline',
  'cost reduction',
  'execution',
  'operating leverage',
  'profitability',
  'capital allocation',
  'margin expansion',
  'margin improvement',
];

function isGenericDriver(driver: string): boolean {
  const d = driver.toLowerCase();
  return GENERIC_DRIVERS.some((g) => d.includes(g));
}

/** Stable hash of a pillar set (ticker+claim), for caching. */
export function hashPillars(items: SynthPillarInput[]): string {
  const s = items.map((i) => `${i.ticker}|${i.claim}`).sort().join('\n');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return String(h);
}

/**
 * Validate + ground raw LLM cluster output against the real pillar inputs.
 * Pure: every referenced pillar must exist and each cluster must span 2+ tickers.
 */
export function groundClusters(
  raw: { clusters?: { driver?: unknown; pillar_indices?: unknown; rationale?: unknown }[] },
  inputs: SynthPillarInput[],
): SynthCluster[] {
  const clusters: SynthCluster[] = [];
  for (const c of raw.clusters ?? []) {
    if (typeof c.driver !== 'string' || typeof c.rationale !== 'string') continue;
    if (isGenericDriver(c.driver)) continue; // reject forced "operational efficiency" style groupings
    if (!Array.isArray(c.pillar_indices)) continue;
    const seen = new Set<string>();
    const members: SynthCluster['pillars'] = [];
    for (const idx of c.pillar_indices) {
      const n = typeof idx === 'number' ? idx : parseInt(String(idx), 10);
      const p = inputs[n - 1];
      if (!p || seen.has(p.id)) continue;
      seen.add(p.id);
      members.push({ ticker: p.ticker, claim: p.claim, pillarId: p.id });
    }
    const tickers = new Set(members.map((m) => m.ticker));
    if (tickers.size < 2) continue; // must be genuinely cross-ticker
    clusters.push({ driver: c.driver.trim(), pillars: members, rationale: c.rationale.trim() });
  }
  return clusters;
}

/** Full clustering tool: pillars in, grounded cross-ticker clusters out. */
export async function clusterPillars(
  openai: OpenAI,
  inputs: SynthPillarInput[],
): Promise<SynthCluster[]> {
  const distinctTickers = new Set(inputs.map((i) => i.ticker));
  if (distinctTickers.size < 2) return [];

  const pillarLines = inputs.map((p, i) => `${i + 1}. [${p.ticker}] ${p.claim}`).join('\n');

  let raw = '{}';
  try {
    const response = await openai.chat.completions.create({
      model: SYNTHESIS_MODEL,
      // Clustering is a grounding/classification task, not a generative one. Pin
      // temperature to 0 so the same pillar set yields the same clusters run to run
      // (stable synthesis + stable risk monitor) and the model does not force vague
      // connections.
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYNTHESIS_SYSTEM_PROMPT },
        { role: 'user', content: `Pillars:\n${pillarLines}` },
      ],
    });
    raw = response.choices[0]?.message?.content ?? '{}';
  } catch (err) {
    console.error('[synthesis] LLM error:', err instanceof Error ? err.message : err);
    return [];
  }

  let parsed: Parameters<typeof groundClusters>[0];
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  return groundClusters(parsed, inputs);
}
