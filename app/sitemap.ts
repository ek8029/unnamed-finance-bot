import type { MetadataRoute } from 'next';
import { getAllPosts } from '@/lib/blog';
import { INDEXABLE_TICKERS } from '@/lib/indexable-tickers';
import { THEMES } from '@/lib/themes';

/** Popular comparison pairs for programmatic SEO. */
const COMPARISON_PAIRS = [
  // Original 10
  'AAPL-vs-MSFT', 'GOOGL-vs-META', 'VOO-vs-VTI', 'NVDA-vs-AMD',
  'TSLA-vs-RIVN', 'JPM-vs-GS', 'AMZN-vs-GOOGL', 'SPY-vs-QQQ',
  'NFLX-vs-DIS', 'CRM-vs-ADBE',
  // High-search additions
  'NVDA-vs-MSFT', 'AAPL-vs-GOOGL', 'AMZN-vs-MSFT', 'META-vs-GOOGL',
  'SCHD-vs-VYM', 'VOO-vs-SPY', 'VTI-vs-SPY', 'QQQ-vs-VOO',
  'NVDA-vs-AAPL', 'TSLA-vs-NVDA', 'AMD-vs-INTC', 'SOFI-vs-HOOD',
  'PLTR-vs-SNOW', 'COIN-vs-MARA', 'BA-vs-RTX', 'V-vs-MA',
  'UNH-vs-JNJ', 'XOM-vs-CVX', 'BND-vs-AGG', 'GLD-vs-SLV',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://helmterminal.dev';

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/analyze`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/compare`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/for`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/pricing`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/thesis-monitoring`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/best-thesis-trackers`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/how-helm-detects-thesis-drift`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/vela-alternative`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/usethesis-alternative`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/security`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/security/isp`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/data-deletion`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/wrapped`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/wrapped/demo`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/tools/tlh-calculator`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/tools/rsu-calculator`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/for/engineers`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/for/founders`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/for/investors`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/for/high-net-worth`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/llms.txt`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.2 },
    { url: `${base}/llms-full.txt`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.2 },
  ];

  const blogPosts: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: `${base}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const tickerPages: MetadataRoute.Sitemap = [...INDEXABLE_TICKERS].map((ticker) => ({
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

  const thesisRiskPages: MetadataRoute.Sitemap = [...INDEXABLE_TICKERS].map((ticker) => ({
    url: `${base}/thesis-risks/${ticker}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  const whenToSellPages: MetadataRoute.Sitemap = [...INDEXABLE_TICKERS].map((ticker) => ({
    url: `${base}/when-to-sell/${ticker}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  const themePages: MetadataRoute.Sitemap = THEMES.map((t) => ({
    url: `${base}/theme/${t.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [...staticRoutes, ...blogPosts, ...tickerPages, ...comparePages, ...thesisRiskPages, ...whenToSellPages, ...themePages];
}
