import { getDemoAnalyses } from '@/lib/demo-tickers';
import HomeContent from '@/components/homepage/home-content';

/**
 * Homepage — Server Component wrapper.
 * Fetches cached demo analyses at request time so the first analysis card
 * is SSR'd into the HTML (no loading state, good for SEO + bounce rate).
 */
export default async function HomePage() {
  const demoAnalyses = await getDemoAnalyses();

  return <HomeContent demoAnalyses={demoAnalyses} />;
}
