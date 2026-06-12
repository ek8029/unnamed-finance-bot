import OpenAI from 'openai';
import { getCompanyProfileEdgar, getRecentFilings } from '@/lib/edgar';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const SEED_MODEL = 'gpt-4o-mini';

export interface SeededPillar {
  claim: string;
}

export async function draftPillars(ticker: string): Promise<SeededPillar[]> {
  try {
    const sinceDate = new Date();
    sinceDate.setFullYear(sinceDate.getFullYear() - 1);
    const isoDate12MonthsAgo = sinceDate.toISOString().split('T')[0];

    const [profile, filings] = await Promise.all([
      getCompanyProfileEdgar(ticker),
      getRecentFilings(ticker, isoDate12MonthsAgo),
    ]);

    const profileContext = profile
      ? `Company: ${profile.name}\nIndustry: ${profile.sicDescription ?? 'Unknown'}\nExchange: ${profile.exchange ?? 'Unknown'}`
      : `Ticker: ${ticker}`;

    const filingsContext =
      filings.length > 0
        ? filings
            .map(
              (f) =>
                `- ${f.form} filed ${f.filingDate}${f.items.length > 0 ? ` (items: ${f.items.join(', ')})` : ''}`
            )
            .join('\n')
        : 'No recent filings found.';

    const userPrompt = `${profileContext}\n\nRecent SEC filings (last 12 months):\n${filingsContext}\n\nDraft 2-4 thesis pillars for this stock.`;

    const response = await openai.chat.completions.create({
      model: SEED_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a fundamental equity analyst. Given company context and recent SEC filings, produce 2-4 short declarative thesis pillars explaining why an investor would own this stock.

Rules:
- Each pillar is a single declarative sentence (no hedging words: no "may", "could", "might", "potentially", "perhaps").
- Each pillar must be independently checkable against future filings or news.
- Do not invent numbers. Only include numbers explicitly present in the supplied context.
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
