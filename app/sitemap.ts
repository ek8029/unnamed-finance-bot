import type { MetadataRoute } from 'next';
import { getAllPosts } from '@/lib/blog';
import { TOP_TICKERS } from '@/lib/top-tickers';

/** Popular comparison pairs for programmatic SEO. */
const COMPARISON_PAIRS = [
  'AAPL-vs-MSFT',
  'GOOGL-vs-META',
  'VOO-vs-VTI',
  'NVDA-vs-AMD',
  'TSLA-vs-RIVN',
  'JPM-vs-GS',
  'AMZN-vs-GOOGL',
  'SPY-vs-QQQ',
  'NFLX-vs-DIS',
  'CRM-vs-ADBE',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://helmterminal.dev';

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/analyze`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/compare`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/for`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/pricing`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/login`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/signup`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/security`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/security/isp`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/data-deletion`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/tools/tlh-calculator`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/for/engineers`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/for/founders`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/for/investors`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/for/high-net-worth`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/llms.txt`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.2 },
  ];

  const blogPosts: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: `${base}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const tickerPages: MetadataRoute.Sitemap = TOP_TICKERS.map((ticker) => ({
    url: `${base}/analyze/${ticker}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  const comparePages: MetadataRoute.Sitemap = COMPARISON_PAIRS.map((pair) => ({
    url: `${base}/compare/${pair}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));

  return [...staticRoutes, ...blogPosts, ...tickerPages, ...comparePages];
}
