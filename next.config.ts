import type { NextConfig } from "next";

const ANALYZE_CACHE_CONTROL = 'public, s-maxage=1800, stale-while-revalidate=86400';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    // The product screenshots are 3600x2025 PNGs (~1MB each) because anything
    // smaller looks soft on a DPR-1 ultrawide. Keeping the source that size and
    // letting Next negotiate AVIF/WebP at the width actually being displayed is
    // what makes that affordable.
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 828, 1080, 1200, 1600, 1920, 2560, 3600],
  },
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
