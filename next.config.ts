import type { NextConfig } from "next";

const ANALYZE_CACHE_CONTROL = 'public, s-maxage=1800, stale-while-revalidate=86400';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        // /analyze/[ticker] pages serve the same AI-generated analysis to
        // every visitor for a given ticker — they are not user-specific and
        // should be cached at the edge.
        //
        // Next.js defaults dynamic routes to `private, no-store` because it
        // assumes they're personalized. For /analyze/[ticker] we want the
        // opposite: public cache for 30 minutes (matching the
        // analysis_cache market-hours TTL), then up to 24 hours of
        // stale-while-revalidate so Google/Vercel edge can serve the cached
        // HTML while a background refresh happens.
        //
        // Three cache-control keys intentional:
        //   - Cache-Control        → browsers + downstream caches
        //   - CDN-Cache-Control    → generic CDNs that read the CDN-prefix
        //   - Vercel-CDN-Cache-Control → Vercel edge (wins on Vercel when set)
        //
        // :ticker matches the dynamic segment and nothing else. /analyze by
        // itself and /analyze/[ticker]/summary (future) are not covered and
        // will use Next.js defaults.
        source: '/analyze/:ticker',
        headers: [
          { key: 'Cache-Control', value: ANALYZE_CACHE_CONTROL },
          { key: 'CDN-Cache-Control', value: ANALYZE_CACHE_CONTROL },
          { key: 'Vercel-CDN-Cache-Control', value: ANALYZE_CACHE_CONTROL },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // The public catch feed was renamed /caught → /masthead ("The Masthead").
      // Permanent (308) redirects preserve the SEO equity earned on the old URLs.
      { source: '/caught', destination: '/masthead', permanent: true },
      { source: '/caught/rss.xml', destination: '/masthead/rss.xml', permanent: true },
    ];
  },
};

export default nextConfig;
