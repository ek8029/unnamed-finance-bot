import { getDemoAnalyses } from '@/lib/demo-tickers';
import HomeContent from '@/components/homepage/home-content';

/**
 * Homepage — Server Component wrapper.
 * Fetches cached demo analyses at request time so the first analysis card
 * is SSR'd into the HTML (no loading state, good for SEO + bounce rate).
 * Times out after 3s to prevent hanging if Supabase is slow.
 */
export default async function HomePage() {
  let demoAnalyses: Awaited<ReturnType<typeof getDemoAnalyses>> = [];
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 3000)
    );
    demoAnalyses = await Promise.race([getDemoAnalyses(), timeout]);
  } catch {
    // Supabase slow or unavailable — render without demo analyses
  }

  return <HomeContent demoAnalyses={demoAnalyses} />;
}
