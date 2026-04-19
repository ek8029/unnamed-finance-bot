import { getDemoAnalyses } from '@/lib/demo-tickers';
import { getTickerTapeData } from '@/lib/ticker-tape';
import HomeContent from '@/components/homepage/home-content';

/**
 * Homepage — Server Component wrapper.
 * Fetches cached demo analyses + live ticker tape at request time.
 * Times out after 3s to prevent hanging if external services are slow.
 */
export default async function HomePage() {
  const timeout = <T,>(p: Promise<T>, ms: number, fallback: T) =>
    Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);

  const [demoAnalyses, tickerTape] = await Promise.all([
    timeout(getDemoAnalyses(), 3000, []),
    timeout(getTickerTapeData(), 3000, []),
  ]);

  return <HomeContent demoAnalyses={demoAnalyses} tickerTape={tickerTape} />;
}
