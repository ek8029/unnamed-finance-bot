import OpenAI from 'openai';
import { getCompanyProfileEdgar } from '@/lib/edgar';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const SEED_MODEL = 'gpt-4o';

export interface SeededPillar {
  claim: string;
}

export async function draftPillars(ticker: string): Promise<SeededPillar[]> {
  try {
    const profile = await getCompanyProfileEdgar(ticker);

    const profileContext = profile
      ? `Company: ${profile.name}\nIndustry: ${profile.sicDescription ?? 'Unknown'}\nExchange: ${profile.exchange ?? 'Unknown'}`
      : `Ticker: ${ticker}`;

    const userPrompt = `${profileContext}\n\nDraft 2-4 thesis pillars for this stock.`;

    const response = await openai.chat.completions.create({
      model: SEED_MODEL,
      response_format: { type: 'json_object' },
      max_tokens: 600,
      messages: [
        {
          role: 'system',
          content: `You are a fundamental equity analyst. Draft 2-4 short thesis pillars: the core reasons a long-term investor would own this stock. Use your knowledge of the company's business, products, competitive position, and growth drivers.

Rules:
- Each pillar is a single declarative sentence about the BUSINESS: demand drivers, competitive position, product cycles, market share, margins, or capital allocation.
- Each pillar must be checkable against future SEC filings or news: a specific filing or headline could clearly support or contradict it.
- NEVER write pillars about SEC filing activity itself. Filing frequency, form types (8-K, 10-K, 13F, Form 144), or insider transaction filings are evidence sources, not reasons to own a stock.
- No hedging words: no "may", "could", "might", "potentially", "perhaps", "suggests".
- Do not invent specific numbers.
- No em dashes.
- Respond with JSON matching exactly: { "pillars": [{ "claim": "..." }] }`,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? '';
    const parsed = JSON.parse(raw) as unknown;

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('pillars' in parsed) ||
      !Array.isArray((parsed as Record<string, unknown>).pillars)
    ) {
      console.error('[thesis-seed] Unexpected response shape:', raw);
      return [];
    }

    const pillars = (parsed as { pillars: unknown[] }).pillars
      .filter(
        (p): p is { claim: string } =>
          typeof p === 'object' &&
          p !== null &&
          'claim' in p &&
          typeof (p as Record<string, unknown>).claim === 'string' &&
          ((p as Record<string, unknown>).claim as string).trim().length > 0
      )
      .map((p) => ({ claim: p.claim.trim() }))
      .slice(0, 4);

    return pillars;
  } catch (error) {
    console.error('[thesis-seed] draftPillars failed:', error);
    return [];
  }
}
