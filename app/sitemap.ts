import type { MetadataRoute } from 'next';
import { getAllPosts } from '@/lib/blog';
import { INDEXABLE_TICKERS } from '@/lib/indexable-tickers';
import { THEMES } from '@/lib/themes';
import { HOUSE_THESES } from '@/lib/content/house-theses';
import { GLOSSARY } from '@/lib/glossary';
import { getTickerThesisData } from '@/lib/content/public-thesis';
import { createStaticServiceClient } from '@/lib/supabase/server';
import { COMPARISON_PAIRS } from '@/lib/comparison-pairs';
import { getApprovedCatches, catchUrl, catchDate } from '@/lib/content/masthead';

/**
 * Latest approved-catch date per house-thesis ticker, for sitemap lastModified.
 * One batched query (not one per ticker). Tickers with no catches yet are omitted
 * and fall back to "now" at the call site.
 */
async function latestEvidenceByTicker(): Promise<Record<string, string>> {
  try {
    const db = createStaticServiceClient();
    const { data } = await db
      .from('content_queue')
      .select('content_events!inner(ticker, cite_date, run_date)')
      .eq('status', 'approved');
    const out: Record<string, string> = {};
    for (const r of (data ?? []) as unknown as {
      content_events: { ticker: string; cite_date: string | null; run_date: string | null } | null;
    }[]) {
      const e = r.content_events;
      if (!e) continue;
      const d = (e.cite_date ?? e.run_date ?? '').slice(0, 10);
      if (!d) continue;
      if (!out[e.ticker] || d > out[e.ticker]) out[e.ticker] = d;
    }
    return out;
  } catch {
    return {};
  }
}

// Static marketing and legal pages. One date for the cluster, bumped when any of
// them changes: blunt, but it replaces a lastModified that read "today" every
// day, which Google discounts and which made every IndexNow sweep pick up the
// whole site. The programmatic clusters below (analyze, compare, thesis-risks,
// when-to-sell) keep new Date() because their prices and evidence do change daily.
const STATIC_UPDATED = new Date('2026-09-24T00:00:00Z');

// [slug, date of last content change]. Keep in step with edits to app/tools/<slug>.
const TOOL_PAGES: [string, string][] = [
  ['tlh-calculator', '2026-09-24'],
  ['rsu-calculator', '2026-09-24'],
  ['etf-overlap', '2026-09-24'],
  ['wash-sale-calculator', '2026-09-24'],
  ['capital-gains-calculator', '2026-09-16'],
  ['dividend-income-calculator', '2026-09-16'],
  ['portfolio-beta-calculator', '2026-09-16'],
  ['monte-carlo-retirement-calculator', '2026-09-16'],
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://helmterminal.dev';
  const evidenceDates = await latestEvidenceByTicker();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/analyze`, lastModified: STATIC_UPDATED, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/compare`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/app`, lastModified: STATIC_UPDATED, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/for`, lastModified: STATIC_UPDATED, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/pricing`, lastModified: STATIC_UPDATED, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/about`, lastModified: STATIC_UPDATED, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/blog`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/thesis-monitoring`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/portfolio-intelligence`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/glossary`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/masthead`, lastModified: STATIC_UPDATED, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/best-thesis-trackers`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/how-helm-detects-thesis-drift`, lastModified: STATIC_UPDATED, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/vela-alternative`, lastModified: STATIC_UPDATED, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/mythesis-alternative`, lastModified: STATIC_UPDATED, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/usethesis-alternative`, lastModified: STATIC_UPDATED, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/privacy`, lastModified: STATIC_UPDATED, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, lastModified: STATIC_UPDATED, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/security`, lastModified: STATIC_UPDATED, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/security/isp`, lastModified: STATIC_UPDATED, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/data-deletion`, lastModified: STATIC_UPDATED, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/wrapped`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/tools`, lastModified: new Date('2026-09-24T00:00:00Z'), changeFrequency: 'monthly', priority: 0.7 },
    // Tools carry the date of their last real content change, not now(). A
    // lastModified that is always "today" is a signal Google learns to ignore,
    // and the RSU calculator's 2026-09-11 retitle went five weeks without a
    // recrawl under it. Bump the date when the page's content changes.
    ...TOOL_PAGES.map(([slug, updated]) => ({
      url: `${base}/tools/${slug}`,
      lastModified: new Date(`${updated}T00:00:00Z`),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    { url: `${base}/for/engineers`, lastModified: STATIC_UPDATED, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/for/founders`, lastModified: STATIC_UPDATED, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/for/investors`, lastModified: STATIC_UPDATED, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/for/high-net-worth`, lastModified: STATIC_UPDATED, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/advisors`, lastModified: STATIC_UPDATED, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/llms.txt`, lastModified: STATIC_UPDATED, changeFrequency: 'monthly', priority: 0.2 },
    { url: `${base}/llms-full.txt`, lastModified: STATIC_UPDATED, changeFrequency: 'monthly', priority: 0.2 },
  ];

  const blogPosts: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: `${base}/blog/${post.slug}`,
    // A post edited after publication carries `updated` in its frontmatter,
    // and that is the date Google should see; the publish date never moves.
    lastModified: new Date(post.updated ?? post.date),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const tickerPages: MetadataRoute.Sitemap = [...INDEXABLE_TICKERS].map((ticker) => ({
    url: `${base}/analyze/${ticker}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  // One URL per approved catch. This is the only cluster that grows on its own,
  // roughly seven or eight a week from the cron, and every entry is a dated
  // verbatim quote from a primary source, which is the most citable object the
  // site has. lastModified is the catch's own date, not now(), so the freshness
  // signal is true.
  const catches = await getApprovedCatches(true);
  const catchPages: MetadataRoute.Sitemap = catches.map((c) => ({
    url: catchUrl(c),
    lastModified: catchDate(c) ? new Date(catchDate(c)) : new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
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

  // Only list theses the page itself will allow to be indexed. Use the SAME gate as
  // generateMetadata (health !== 'unverified') so the sitemap can never advertise a
  // noindex page. evidenceDates pre-filters to tickers with catches, keeping this to a
  // handful of reads.
  const evidencedTheses = HOUSE_THESES.filter((t) => evidenceDates[t.ticker]);
  const evidencedHealth = await Promise.all(
    evidencedTheses.map((t) => getTickerThesisData(t.ticker)),
  );
  const thesisPages: MetadataRoute.Sitemap = evidencedTheses
    .filter((_t, i) => evidencedHealth[i] != null && evidencedHealth[i]!.health !== 'unverified')
    .map((t) => ({
      url: `${base}/thesis/${t.ticker.toLowerCase()}`,
      lastModified: new Date(`${evidenceDates[t.ticker]}T00:00:00Z`),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    }));

  const glossaryPages: MetadataRoute.Sitemap = GLOSSARY.map((t) => ({
    url: `${base}/glossary/${t.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return [...staticRoutes, ...blogPosts, ...tickerPages, ...catchPages, ...comparePages, ...thesisRiskPages, ...whenToSellPages, ...themePages, ...thesisPages, ...glossaryPages];
}
