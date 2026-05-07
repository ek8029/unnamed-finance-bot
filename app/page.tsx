import { unstable_cache } from 'next/cache';
import { getDemoAnalyses } from '@/lib/demo-tickers';
import { getTickerTapeData } from '@/lib/ticker-tape';
import HomeContent from '@/components/homepage/home-content';

/** ISR — regenerate every 5 minutes */
export const revalidate = 300;

const getCachedDemoAnalyses = unstable_cache(
  () => getDemoAnalyses(),
  ['homepage-demo-analyses'],
  { revalidate: 300 }
);

const getCachedTickerTape = unstable_cache(
  () => getTickerTapeData(),
  ['homepage-ticker-tape'],
  { revalidate: 300 }
);

/**
 * Homepage — Server Component wrapper.
 * Data fetches wrapped in unstable_cache to enable ISR
 * (underlying fetches use no-store which would otherwise force dynamic).
 */
export default async function HomePage() {
  const timeout = <T,>(p: Promise<T>, ms: number, fallback: T) =>
    Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);

  const [demoAnalyses, tickerTape] = await Promise.all([
    timeout(getCachedDemoAnalyses(), 3000, []),
    timeout(getCachedTickerTape(), 3000, []),
  ]);

  return <HomeContent demoAnalyses={demoAnalyses} tickerTape={tickerTape} />;
}
