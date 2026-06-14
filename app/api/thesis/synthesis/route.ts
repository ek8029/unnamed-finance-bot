// GET /api/thesis/synthesis - cross-thesis synthesis: finds hidden concentration
// where pillars from 2+ different tickers depend on the same underlying driver.
// Single LLM pass over the user's confirmed pillars; grounded (clusters may only
// reference real pillars) and neutral (describes concentration, never advises).
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const SYNTHESIS_MODEL = 'gpt-4o';
const MAX_CACHE_ENTRIES = 500; // bound memory; entries only churn when pillar sets change

interface PillarInput { id: string; ticker: string; claim: string }
interface Cluster { driver: string; pillars: { ticker: string; claim: string; pillarId: string }[]; rationale: string }

// Per-instance cache keyed by user + pillar-set hash. Recomputes only when the
// user's confirmed pillars change (add/edit/dismiss). A scan never alters clusters
// (they depend on claims, not evidence), so there is no time-based expiry.
const cache = new Map<string, { clusters: Cluster[]; generatedAt: string }>();

function hashPillars(items: PillarInput[]): string {
  const s = items.map((i) => `${i.ticker}|${i.claim}`).sort().join('\n');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return String(h);
}

const SYSTEM_PROMPT = `You are an equity analyst finding HIDDEN CONCENTRATION across a user's investment theses. Each numbered pillar below is one reason the user holds a position. Pillars from DIFFERENT tickers often depend on the SAME underlying driver (for example: AI datacenter capex, the interest-rate path, consumer credit health, energy prices, GLP-1 demand). When several positions share a driver, one change in that driver moves them together, which is concentration the user may not see when tracking each position separately.

Identify clusters where pillars from 2 OR MORE DIFFERENT tickers depend on the same underlying driver.

Rules:
- Only group pillars that genuinely share a driver. Do not force connections.
- Every cluster MUST span at least 2 different tickers.
- Reference only the pillar numbers provided. Never invent pillars, tickers, facts, or numbers.
- driver: a short noun phrase naming the shared dependency (for example "AI datacenter capex").
- rationale: 1 to 2 neutral sentences describing how the listed pillars depend on that driver and that they would tend to move together. Describe the concentration only. Do NOT give advice or recommendations. Never use buy, sell, hold, trim, reduce, add, rebalance, or diversify. No em dashes.
- Omit weak or single-ticker groupings entirely. If nothing genuinely connects, return an empty array.

Respond with JSON exactly in this shape:
{ "clusters": [ { "driver": "...", "pillar_indices": [<1-based pillar numbers>], "rationale": "..." } ] }`;

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: theses, error: thesesError } = await supabase
      .from('theses')
      .select('id, ticker')
      .eq('user_id', user.id);
    if (thesesError) {
      console.error('[synthesis] theses error:', thesesError);
      return NextResponse.json({ clusters: [], status: 'error' });
    }

    const tickerByThesis = new Map<string, string>();
    for (const t of theses ?? []) tickerByThesis.set(t.id, t.ticker);
    const thesisIds = [...tickerByThesis.keys()];
    if (thesisIds.length < 2) {
      return NextResponse.json({ clusters: [], status: 'insufficient' });
    }

    const { data: pillars, error: pillarsError } = await supabase
      .from('thesis_pillars')
      .select('id, thesis_id, claim, confirmed, lifecycle')
      .in('thesis_id', thesisIds)
      .eq('user_id', user.id)
      .eq('confirmed', true)
      .neq('lifecycle', 'dismissed');
    if (pillarsError) {
      console.error('[synthesis] pillars error:', pillarsError);
      return NextResponse.json({ clusters: [], status: 'error' });
    }

    const inputs: PillarInput[] = [];
    for (const p of pillars ?? []) {
      const ticker = tickerByThesis.get(p.thesis_id);
      if (ticker && typeof p.claim === 'string' && p.claim.trim()) {
        inputs.push({ id: p.id, ticker, claim: p.claim.trim() });
      }
    }

    // Need 2+ distinct tickers for a cross-ticker driver to exist.
    const distinctTickers = new Set(inputs.map((i) => i.ticker));
    if (distinctTickers.size < 2) {
      return NextResponse.json({ clusters: [], status: 'insufficient' });
    }

    // Cache
    const cacheKey = `${user.id}:${hashPillars(inputs)}`;
    const hit = cache.get(cacheKey);
    if (hit) {
      return NextResponse.json({ ...hit, status: 'ok', cached: true });
    }

    const pillarLines = inputs.map((p, i) => `${i + 1}. [${p.ticker}] ${p.claim}`).join('\n');

    let raw = '{}';
    try {
      const response = await openai.chat.completions.create({
        model: SYNTHESIS_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Pillars:\n${pillarLines}` },
        ],
      });
      raw = response.choices[0]?.message?.content ?? '{}';
    } catch (err) {
      console.error('[synthesis] LLM error:', err instanceof Error ? err.message : err);
      return NextResponse.json({ clusters: [], status: 'error' });
    }

    let parsed: { clusters?: { driver?: unknown; pillar_indices?: unknown; rationale?: unknown }[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ clusters: [], status: 'error' });
    }

    // Validate + ground: every referenced pillar must exist; cluster must span 2+ tickers.
    const clusters: Cluster[] = [];
    for (const c of parsed.clusters ?? []) {
      if (typeof c.driver !== 'string' || typeof c.rationale !== 'string') continue;
      if (!Array.isArray(c.pillar_indices)) continue;
      const seen = new Set<string>();
      const members: Cluster['pillars'] = [];
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

    const data = { clusters, generatedAt: new Date().toISOString() };
    cache.set(cacheKey, data);
    if (cache.size > MAX_CACHE_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    return NextResponse.json({ ...data, status: 'ok' });
  } catch (err) {
    console.error('[synthesis] unhandled error:', err);
    return NextResponse.json({ clusters: [], status: 'error' });
  }
}
