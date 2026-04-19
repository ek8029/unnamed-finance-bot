import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // NOTE: Cache-Control for /analyze/[ticker] is now set in middleware.ts
  // (only for anonymous visitors) because the page renders differently for
  // authenticated users (dashboard sidebar). Static next.config headers
  // can't vary by auth state, so we removed them here.
};

export default nextConfig;
