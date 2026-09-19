import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
const m = vi.hoisted(() => ({ db: null as unknown, model: vi.fn(), quota: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => m.db, createServiceClient: async () => m.db }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => m.db }));
vi.mock('openai', () => ({ default: class { chat = { completions: { create: m.model } }; } }));
vi.mock('@/lib/tier', () => ({ checkAnalysisQuota: m.quota, recordAnalysisUsage: vi.fn(), tierAtLeast: () => true }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: () => ({ allowed: true }), getClientIP: () => 'fixture' }));
import { POST as importHoldings } from '@/app/api/portfolio/import/route';
import { POST as analyze } from '@/app/api/ai/analyze/route';
import { POST as qa } from '@/app/api/ai/portfolio-qa/route';
import { generateDigest } from '@/lib/generate-digest';
import { scoreOneThesis, type Thesis } from '@/lib/score-theses';
import { composeWeeklyNote } from '@/lib/research/analyst-note';
import { getCachedClusters } from '@/lib/thesis-synthesis';
const userId = '11111111-1111-4111-8111-111111111111';
// Migration 074: one consent record per auth user, one choice timestamp.
// Unrelated reads/writes throw: a denied branch must not reach private inputs.
function deniedDb() {
  return { auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) },
    from: (table: string) => {
      if (!['user_ai_consents', 'thesis_clusters'].includes(table)) throw new Error('Unexpected private read: ' + table);
      const q = { select: () => q, eq: (key: string, value: unknown) => {
        expect(key).toBe('user_id'); expect(value).toBe(userId); return q;
      }, maybeSingle: async () => ({ data: null, error: null }) };
      return q;
    } } as unknown as SupabaseClient;
}
beforeEach(() => {
  vi.clearAllMocks(); m.db = deniedDb();
  vi.stubEnv('OPENAI_API_KEY', 'fixture');
  m.model.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ rows: [{ ticker: 'AAPL', shares: '2' }] }) } }] });
});
afterEach(() => vi.unstubAllEnvs());
const req = (body: unknown) => new NextRequest('http://local/api/fixture', { method: 'POST', body: JSON.stringify(body) });
describe('personal AI permission at real request and job boundaries', () => {
  it.each([analyze, qa])('denies personal Q&A before quota or model use', async route => {
    const result = await route(req({ query: 'My holdings', question: 'My holdings' }));
    expect(result.status).toBe(403);
    expect((await result.json()).code).toBe('AI_CONSENT_REQUIRED');
    expect(m.quota).not.toHaveBeenCalled(); expect(m.model).not.toHaveBeenCalled();
  });
  it('does not bypass paused consent through digest provider fallback', async () => {
    await expect(generateDigest(['AAPL'], userId)).rejects.toMatchObject({ name: 'AiConsentRequiredError' });
    expect(m.model).not.toHaveBeenCalled();
  });
  it('stops scoring before reading pillars or advancing the scan watermark', async () => {
    await expect(scoreOneThesis(m.db as SupabaseClient, { id: 'thesis', user_id: userId, ticker: 'AAPL' } as Thesis, []))
      .rejects.toMatchObject({ name: 'AiConsentRequiredError' });
    expect(m.model).not.toHaveBeenCalled();
  });
  it('stops the weekly note before reading portfolio context', async () => {
    await expect(composeWeeklyNote(m.db as SupabaseClient, userId)).rejects.toMatchObject({ name: 'AiConsentRequiredError' });
    expect(m.model).not.toHaveBeenCalled();
  });
  it('does not recompute a missing private synthesis cache while paused', async () => {
    const openai = { chat: { completions: { create: m.model } } };
    await expect(getCachedClusters(m.db as SupabaseClient, openai as never, userId, [
      { id: 'a', ticker: 'AAPL', claim: 'private a' }, { id: 'b', ticker: 'MSFT', claim: 'private b' },
    ])).rejects.toMatchObject({ name: 'AiConsentRequiredError' });
    expect(m.model).not.toHaveBeenCalled();
  });
  it.each([{ imageDataUrl: 'data:image/png;base64,YQ==' }, { csv: 'I own two shares of Apple' }])('blocks model import without this upload permission', async payload => {
    const result = await importHoldings(req(payload));
    expect(result.status).toBe(403); expect(m.model).not.toHaveBeenCalled();
  });
  it('structured CSV remains available without sending it to AI', async () => {
    const result = await importHoldings(req({ csv: 'Symbol,Quantity\nAAPL,2' }));
    expect(result.status).toBe(200); expect((await result.json()).rows).toHaveLength(1);
    expect(m.model).not.toHaveBeenCalled();
  });
  it('an explicitly permitted image reaches the extractor', async () => {
    const result = await importHoldings(req({ imageDataUrl: 'data:image/png;base64,YQ==', aiConsent: true }));
    expect(result.status).toBe(200); expect(m.model).toHaveBeenCalledTimes(1);
  });
});
