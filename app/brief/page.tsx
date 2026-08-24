import type { Metadata } from 'next';
import { PublicBrief } from './public-brief';
import { getBatchQuotes } from '@/lib/financial-data';
import { getVixQuote } from '@/lib/vix';

export const metadata: Metadata = {
  title: 'The Current — Today\'s Market Brief | Helm Terminal',
  description: 'A daily market intelligence brief. What moved, what matters, what to watch. Free, no signup required.',
  openGraph: {
    title: 'The Current — Today\'s Market Brief | Helm Terminal',
    description: 'A daily market intelligence brief. What moved, what matters, what to watch.',
    url: 'https://helmterminal.dev/brief',
  },
};

export const revalidate = 300;

const TICKERS = ['SPY', 'QQQ', 'NVDA', 'AAPL', 'MSFT', 'GOOGL', 'META', 'AMZN', 'TSLA', 'AMD', 'AVGO', 'JPM'];

export default async function PublicBriefPage() {
  let quotes: { symbol: string; price: number; changePct: number; change: number }[] = [];
  let vix: { value: number; pricedDayPct: number } | null = null;

  try {
    const q = await getVixQuote();
    if (q) vix = { value: q.value, pricedDayPct: q.pricedDayPct };
  } catch {
    // the row simply does not render
  }

  try {
    const raw = await getBatchQuotes(TICKERS);
    quotes = TICKERS.map((t) => {
      const q = raw.get(t);
      return q
        ? { symbol: t, price: q.c, changePct: q.dp, change: q.d }
        : null;
    }).filter((q): q is NonNullable<typeof q> => q !== null && q.price > 0);
  } catch {
    // fallback in client
  }

  return <PublicBrief quotes={quotes} vix={vix} />;
}
