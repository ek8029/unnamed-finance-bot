# Helm Terminal -- SEO & Content Strategy

**Document version:** 2026-03-25
**Scope:** Turn the free /analyze tool into a sustainable organic acquisition engine.
**Honest timeline:** Expect 3-6 months for measurable organic traffic gains. Programmatic pages will index within weeks, but ranking takes quarters.

---

## 1. Keyword Strategy

### Methodology

Keywords are organized into four intent buckets. Volume and difficulty estimates are directional (based on typical fintech SaaS patterns from Ahrefs/Semrush ranges), not precise figures -- you should validate the top 20 with actual tool data before committing engineering resources.

### Head Terms (high volume, high difficulty -- brand + authority plays)

| # | Keyword | Volume | Difficulty | Target Page | Priority |
|---|---------|--------|------------|-------------|----------|
| 1 | AAPL stock analysis | High | High | /analyze/AAPL | P1 |
| 2 | TSLA stock analysis | High | High | /analyze/TSLA | P1 |
| 3 | NVDA stock analysis | High | High | /analyze/NVDA | P1 |
| 4 | MSFT stock analysis | High | Med | /analyze/MSFT | P1 |
| 5 | AMZN stock analysis | High | Med | /analyze/AMZN | P1 |
| 6 | META stock analysis | Med | Med | /analyze/META | P1 |
| 7 | GOOGL stock analysis | Med | Med | /analyze/GOOGL | P1 |
| 8 | JPM stock analysis | Med | Med | /analyze/JPM | P2 |
| 9 | stock analysis tool | High | High | /analyze | P1 |
| 10 | AI stock analysis | Med | Med | /analyze | P1 |

### Long-Tail (lower volume, lower difficulty -- high conversion intent)

| # | Keyword | Volume | Difficulty | Target Page | Priority |
|---|---------|--------|------------|-------------|----------|
| 11 | is Apple stock a good buy 2026 | Med | Low | /analyze/AAPL | P1 |
| 12 | should I buy NVDA stock | Med | Low | /analyze/NVDA | P1 |
| 13 | Tesla stock forecast 2026 | Med | Med | /analyze/TSLA | P1 |
| 14 | AAPL earnings analysis | Med | Low | /analyze/AAPL | P2 |
| 15 | NVDA bull vs bear case | Low | Low | /analyze/NVDA | P2 |
| 16 | is Amazon stock overvalued | Med | Low | /analyze/AMZN | P2 |
| 17 | Microsoft stock buy or sell | Med | Low | /analyze/MSFT | P2 |
| 18 | best tech stocks to buy 2026 | High | High | /blog/best-tech-stocks-2026 | P1 |
| 19 | META stock analyst rating | Low | Low | /analyze/META | P3 |
| 20 | JPMorgan stock analysis 2026 | Low | Low | /analyze/JPM | P3 |
| 21 | AAPL P/E ratio analysis | Low | Low | /analyze/AAPL | P3 |
| 22 | TSLA bear case 2026 | Low | Low | /analyze/TSLA | P2 |
| 23 | NVDA stock price target 2026 | Med | Med | /analyze/NVDA | P2 |
| 24 | AMZN revenue growth analysis | Low | Low | /analyze/AMZN | P3 |
| 25 | GOOGL valuation analysis | Low | Low | /analyze/GOOGL | P3 |

### Informational (educational intent -- blog targets)

| # | Keyword | Volume | Difficulty | Target Page | Priority |
|---|---------|--------|------------|-------------|----------|
| 26 | how to analyze a stock | High | Med | /blog/how-to-analyze-a-stock | P1 |
| 27 | fundamental analysis explained | Med | Med | /blog/fundamental-analysis-guide | P1 |
| 28 | how to read financial statements for stocks | Med | Med | /blog/reading-financial-statements | P2 |
| 29 | P/E ratio explained | High | High | /blog/pe-ratio-explained | P2 |
| 30 | what is analyst consensus | Low | Low | /blog/analyst-consensus-explained | P2 |
| 31 | bull vs bear case meaning | Low | Low | /blog/bull-vs-bear-case | P3 |
| 32 | how to use news sentiment for investing | Low | Low | /blog/news-sentiment-investing | P3 |
| 33 | stock valuation methods | Med | Med | /blog/stock-valuation-methods | P2 |
| 34 | earnings per share explained | Med | Med | /blog/eps-explained | P3 |
| 35 | how to find undervalued stocks | Med | Med | /blog/finding-undervalued-stocks | P2 |
| 36 | tax-loss harvesting guide | Med | Med | /blog/tax-loss-harvesting-guide (exists) | P1 |
| 37 | Bloomberg terminal alternatives | Med | Low | /blog/best-bloomberg-terminal-alternatives (exists) | P1 |
| 38 | RSU tax strategy | Med | Med | /blog/rsu-tax-strategy | P1 |
| 39 | portfolio concentration risk | Low | Low | /blog/portfolio-concentration-risk | P2 |
| 40 | how often to rebalance portfolio | Low | Low | /blog/portfolio-rebalancing-guide | P3 |

### Tool-Intent (user is actively looking for a tool -- highest conversion)

| # | Keyword | Volume | Difficulty | Target Page | Priority |
|---|---------|--------|------------|-------------|----------|
| 41 | free stock analyzer | Med | Med | /analyze | P1 |
| 42 | AI stock analysis tool | Med | Low | /analyze | P1 |
| 43 | free stock analysis tool | Med | Med | /analyze | P1 |
| 44 | stock analysis AI free | Low | Low | /analyze | P1 |
| 45 | best stock analysis tool 2026 | Med | Med | /blog/best-stock-analysis-tools | P1 |
| 46 | free stock research tool | Med | Med | /analyze | P2 |
| 47 | AI stock screener free | Low | Low | /analyze | P2 |
| 48 | stock fundamental analysis tool | Low | Low | /analyze | P2 |
| 49 | financial intelligence platform | Low | Low | / (homepage) | P3 |
| 50 | stock analysis with AI | Low | Low | /analyze | P2 |

### Priority Tiers Summary

- **P1 (do now):** Tool-intent keywords + top 8 ticker head terms + first 5 blog posts. These are the highest-leverage moves.
- **P2 (month 2-3):** Long-tail ticker variations + informational content that feeds internal links.
- **P3 (month 4+):** Low-volume long-tail. These come naturally once the content flywheel is spinning.

---

## 2. On-Page SEO Checklist for /analyze/[ticker] Pages

### Title Tag Template

**Current:** `${SYMBOL} Stock Analysis -- Helm Terminal`
**Recommended:** `${SYMBOL} Stock Analysis: ${COMPANY_NAME} Bull & Bear Case (${YEAR}) | Helm`

Why: Including the company name captures "[company name] stock analysis" queries. The year signals freshness. "Bull & Bear Case" adds keyword-rich differentiation. Keeping it under 60 characters requires abbreviating -- test both formats.

Implementation -- update `generateMetadata` in `app/analyze/[ticker]/page.tsx`:

```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase().replace(/[^A-Z]/g, '');
  const year = new Date().getFullYear();

  // Fetch analysis for company name (from cache if available)
  const { analysis } = await analyzeStock(symbol);
  const companyName = analysis?.companyName || symbol;
  const verdict = analysis?.verdict || 'Analysis';

  const title = `${symbol} Stock Analysis: ${companyName} (${year}) | Helm`;
  const description = `Free AI-powered ${symbol} analysis with real-time data. ${companyName} price, earnings, analyst consensus, bull & bear case, and news sentiment. Updated daily.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://helmterminal.dev/analyze/${symbol}`,
      siteName: 'Helm Terminal',
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: {
      canonical: `https://helmterminal.dev/analyze/${symbol}`,
    },
  };
}
```

### Meta Description Template

**Template:** `Free AI-powered ${SYMBOL} analysis with real-time data. ${COMPANY_NAME} price, earnings, analyst consensus, bull & bear case, and news sentiment. Updated daily.`

- 150-160 characters target
- Contains primary keyword (${SYMBOL} analysis)
- Contains benefit keywords (free, real-time, AI-powered)
- "Updated daily" signals freshness
- Includes entity-rich terms (earnings, analyst consensus, bull & bear case)

### H1/H2 Structure

The analysis pages currently render the analysis card as a client component without semantic heading structure visible to crawlers. Since the SSR fallback renders `StockAnalysisCard` directly, ensure the card component uses proper heading hierarchy:

```
H1: "${COMPANY_NAME} (${SYMBOL}) Stock Analysis"     <- one per page, in the server-rendered output
  H2: "Key Metrics"                                   <- metrics grid section
  H2: "Summary"                                       <- AI summary paragraph
  H2: "Bull Case"                                     <- bullCase content
  H2: "Bear Case"                                     <- bearCase content
  H2: "Analyst Recommendation"                        <- recommendation
  H2: "Recent News"                                   <- newsHighlights
  H2: "Analyze Another Stock"                         <- related tickers section
```

Implementation note: The `StockAnalysisCard` component in `components/analysis/analysis-cards.tsx` should use actual `<h1>`, `<h2>` elements rather than styled `<div>` elements. Even if visually the same, crawlers need the semantic markup.

Add to the server component (before `<AnalysisResultClient>`):

```tsx
<h1 className="sr-only">{analysis.companyName} ({symbol}) Stock Analysis</h1>
```

This gives crawlers an H1 even if the visual heading is inside the client component.

### Schema Markup (JSON-LD)

The current implementation has Article + BreadcrumbList schema. This is good but incomplete. Add the following additional schemas:

#### 1. Enhanced Article with Rating (replace existing Article schema)

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "${COMPANY_NAME} (${SYMBOL}) Stock Analysis",
  "description": "${analysis.summary}",
  "author": {
    "@type": "Organization",
    "name": "Helm Terminal",
    "url": "https://helmterminal.dev"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Helm Terminal",
    "url": "https://helmterminal.dev",
    "logo": {
      "@type": "ImageObject",
      "url": "https://helmterminal.dev/helm-logo.png"
    }
  },
  "datePublished": "${new Date().toISOString()}",
  "dateModified": "${new Date().toISOString()}",
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://helmterminal.dev/analyze/${SYMBOL}"
  },
  "about": {
    "@type": "Corporation",
    "name": "${COMPANY_NAME}",
    "tickerSymbol": "${SYMBOL}"
  }
}
```

#### 2. FAQPage Schema (generate from analysis data)

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Is ${SYMBOL} stock a good buy right now?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "${analysis.recommendation}"
      }
    },
    {
      "@type": "Question",
      "name": "What is the bull case for ${SYMBOL}?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "${analysis.bullCase}"
      }
    },
    {
      "@type": "Question",
      "name": "What is the bear case for ${SYMBOL}?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "${analysis.bearCase}"
      }
    },
    {
      "@type": "Question",
      "name": "What do analysts say about ${SYMBOL} stock?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Based on current analyst consensus, ${analysis.recommendation}"
      }
    }
  ]
}
```

The FAQPage schema is high-value: it can surface rich results (accordion-style FAQ snippets in Google SERPs), which dramatically increases click-through rate. These questions also directly match long-tail search queries like "is AAPL stock a good buy."

#### 3. SoftwareApplication Schema (for the /analyze hub page)

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Helm Terminal Stock Analyzer",
  "applicationCategory": "FinanceApplication",
  "operatingSystem": "Web",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "description": "Free AI-powered stock analysis tool with real-time pricing, analyst consensus, earnings data, and news sentiment for any publicly traded stock.",
  "url": "https://helmterminal.dev/analyze",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "ratingCount": "150"
  }
}
```

**Important:** Only add `aggregateRating` once you actually have user ratings/reviews. Do NOT fabricate this. Remove the `aggregateRating` block until you have a real review system.

#### Implementation (full JSON-LD block for /analyze/[ticker]/page.tsx)

Replace the existing `jsonLd` const:

```typescript
const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${analysis.companyName} (${symbol}) Stock Analysis`,
    description: analysis.summary,
    author: { '@type': 'Organization', name: 'Helm Terminal', url: 'https://helmterminal.dev' },
    publisher: {
      '@type': 'Organization',
      name: 'Helm Terminal',
      url: 'https://helmterminal.dev',
      logo: { '@type': 'ImageObject', url: 'https://helmterminal.dev/helm-logo.png' },
    },
    datePublished: new Date().toISOString(),
    dateModified: new Date().toISOString(),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://helmterminal.dev/analyze/${symbol}`,
    },
    about: {
      '@type': 'Corporation',
      name: analysis.companyName,
      tickerSymbol: symbol,
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://helmterminal.dev' },
      { '@type': 'ListItem', position: 2, name: 'Stock Analysis', item: 'https://helmterminal.dev/analyze' },
      { '@type': 'ListItem', position: 3, name: `${symbol} Analysis`, item: `https://helmterminal.dev/analyze/${symbol}` },
    ],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `Is ${symbol} stock a good buy right now?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: analysis.recommendation,
        },
      },
      {
        '@type': 'Question',
        name: `What is the bull case for ${symbol}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: analysis.bullCase,
        },
      },
      {
        '@type': 'Question',
        name: `What is the bear case for ${symbol}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: analysis.bearCase,
        },
      },
    ],
  },
];
```

### Internal Linking Strategy

The analysis pages currently link to:
- `/analyze` (back to search)
- `/` (home, via nav)
- `/signup` (CTA)
- Related tickers (6 popular tickers via `RelatedTickers` component)

**Add these internal links:**

1. **Sector peers section:** After related tickers, add "More in [sector]" links. Example: AAPL page links to MSFT, GOOGL, AMZN (tech sector peers). This requires passing sector data from `analysis.companyName` or the Finnhub profile.

2. **Blog content links:** Below the analysis, add a "Related Reading" section linking to relevant blog posts. For example, any tech stock analysis should link to `/blog/best-tech-stocks-2026`. Any stock showing tax-loss opportunity should link to `/blog/tax-loss-harvesting-guide`.

3. **Cross-link from blog to /analyze:** Every blog post that mentions a specific ticker should link to `/analyze/${TICKER}`. The existing blog posts already do this partially via CTACard components.

4. **Footer link block:** Add a footer section to analysis pages with links like "How to Analyze a Stock" (blog), "Free Stock Analysis Tool" (/analyze), "Helm Terminal Dashboard" (/signup).

### Image Alt Text Patterns

The analysis pages are primarily text-based (no stock images), but apply these patterns:

- OG image alt (already set): `"Stock Analysis -- Helm Terminal"` -- update to `"${SYMBOL} ${COMPANY_NAME} AI Stock Analysis -- Helm Terminal"`
- Helm logo: `"Helm Terminal -- Financial Intelligence Platform"`
- If/when you add charts: `"${SYMBOL} ${METRIC_NAME} chart -- ${TIME_PERIOD}"`
- If/when you add company logos: `"${COMPANY_NAME} (${SYMBOL}) company logo"`

Update the OG image alt in `app/analyze/[ticker]/opengraph-image.tsx`:

```typescript
export const alt = 'Stock Analysis -- Helm Terminal';
// Change to dynamically include ticker:
// Since this is a static export, use a more descriptive default
export const alt = 'AI-Powered Stock Analysis with Real-Time Data -- Helm Terminal';
```

---

## 3. Programmatic SEO Plan

### The Opportunity

There are roughly 6,000-8,000 US-listed stocks. Each one is a potential landing page for "[TICKER] stock analysis" queries. Most have low to zero competition for the exact-match query. This is the single highest-leverage SEO play available.

### URL Structure

**Keep the current structure:** `/analyze/${TICKER}`

This is clean, crawlable, and matches user expectations. Avoid adding date slugs or nested paths.

- Canonical URL: `https://helmterminal.dev/analyze/${TICKER}` (uppercase ticker, already implemented)
- Redirect lowercase to uppercase: ensure `helmterminal.dev/analyze/aapl` redirects to `helmterminal.dev/analyze/AAPL` (or at minimum, the canonical points to uppercase). The current code uppercases via `ticker.toUpperCase()` and sets the canonical correctly.

### Content Template

Each programmatic page should render this content structure (most of this already exists):

```
[Breadcrumb: Home > Stock Analysis > ${SYMBOL}]

H1: ${COMPANY_NAME} (${SYMBOL}) Stock Analysis

[Verdict Badge: Bullish / Bearish / Neutral]

[Summary paragraph -- AI-generated, data-rich, 80-150 words]

[Metrics Grid: 4-6 key metrics with values, changes, context]
  - Current Price
  - P/E Ratio (TTM)
  - Revenue Growth YoY
  - Analyst Consensus
  - 52-Week Range
  - Market Cap

H2: Bull Case
[2-3 sentences with specific numbers]

H2: Bear Case
[2-3 sentences with specific numbers]

H2: Analyst Recommendation
[1 decisive sentence]

H2: Recent News
[2-4 news headlines with sentiment and dates]

H2: Frequently Asked Questions  <-- NEW (for FAQ schema)
  Q: Is ${SYMBOL} a good buy right now?
  A: [recommendation text]

  Q: What is ${SYMBOL}'s P/E ratio?
  A: [pulled from metrics]

  Q: What do analysts say about ${SYMBOL}?
  A: [consensus data]

[Inline Search: "Analyze another stock"]
[Related Tickers: sector peers + popular]
[Related Blog Posts: 2-3 contextual links]

[Footer: links to /analyze, /blog, /signup]
```

The **FAQ section** is the main addition. It serves dual purpose: visible content for users who scroll, and structured data for Google's FAQ rich results.

### Dynamic Meta Tags

Already mostly implemented. Enhancements:

```typescript
// In generateMetadata:
const title = `${symbol} Stock Analysis: ${companyName} (${year}) | Helm`;
const description = `Free AI analysis of ${companyName} (${symbol}). Current price, P/E ratio, earnings, analyst consensus, bull & bear case. Real-time data, updated daily.`;

// Add keywords meta (minor signal but free):
keywords: [
  `${symbol} stock analysis`,
  `${companyName} stock`,
  `${symbol} buy or sell`,
  `${symbol} earnings`,
  `${symbol} analyst rating`,
  'AI stock analysis',
  'free stock analysis',
],
```

### Sitemap Strategy

The current sitemap only includes static routes and blog posts. It does NOT include /analyze/[ticker] pages. This is the single biggest gap.

**Option A -- Pre-generated sitemap with top tickers (recommended for now):**

Create a curated list of 500-1000 high-traffic tickers and include them in the sitemap. This is low-effort and gets Google to discover the most valuable pages.

```typescript
// app/sitemap.ts -- updated
import type { MetadataRoute } from 'next';
import { getAllPosts } from '@/lib/blog';

// Top 500 most-traded US tickers (SP500 + popular small/mid caps)
// Store this in a separate file: lib/top-tickers.ts
import { TOP_TICKERS } from '@/lib/top-tickers';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://helmterminal.dev';

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/analyze`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/pricing`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/login`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/signup`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/security`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/data-deletion`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.2 },
  ];

  const blogPosts: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: `${base}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  // Programmatic analysis pages
  const analyzePages: MetadataRoute.Sitemap = TOP_TICKERS.map((ticker) => ({
    url: `${base}/analyze/${ticker}`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 0.8,
  }));

  return [...staticRoutes, ...blogPosts, ...analyzePages];
}
```

**Option B -- Database-driven sitemap (future, when you have cached analyses):**

Query the `analysis_cache` table for all tickers that have been analyzed and include those in the sitemap. This grows organically as users analyze more stocks.

```typescript
// Future: app/sitemap.ts with database query
const supabase = await createServiceClient();
const { data: cached } = await supabase
  .from('analysis_cache')
  .select('ticker')
  .order('created_at', { ascending: false });

const analyzedTickers = cached?.map(r => r.ticker) || [];
```

### Index Management

**Index (doindex):**
- All /analyze/[ticker] pages for valid, liquid US stocks (S&P 500, Nasdaq 100, Russell 1000)
- The /analyze hub page
- All published blog posts
- Homepage, pricing, legal pages

**Noindex:**
- /analyze/[ticker] pages for invalid tickers (the 404 state) -- already handled by `notFound()`
- /dashboard/* (already blocked in robots.txt)
- /api/* (already blocked in robots.txt)
- /mfa-verify (already blocked in robots.txt)
- /login, /signup -- debatable; currently indexed. Consider noindexing since they have thin content

**Implementation for noindex on thin pages:**

```typescript
// In any page that should be noindexed:
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};
```

---

## 4. Blog Content Calendar

All posts target the blog at `/blog/[slug]`. Word counts are targets, not minimums. Quality over length. Match the existing voice: conversational, opinionated, data-rich.

### P1 -- Publish within 30 days (highest traffic potential)

| # | Title | Target Keyword(s) | Search Intent | Word Count | Internal Links | Priority |
|---|-------|--------------------|---------------|------------|----------------|----------|
| 1 | How to Analyze a Stock: The Complete Framework for 2026 | how to analyze a stock, stock analysis guide | Informational | 2,500 | /analyze, /analyze/AAPL, /analyze/MSFT | P1 |
| 2 | Best AI Stock Analysis Tools in 2026 (Free & Paid) | AI stock analysis tool, best stock analysis tool 2026, free stock analyzer | Tool comparison | 2,000 | /analyze (featured), /analyze/NVDA, /analyze/TSLA | P1 |
| 3 | NVDA Stock Analysis: Is Nvidia Still a Buy After the AI Boom? | NVDA stock analysis, should I buy NVDA | Transactional | 1,800 | /analyze/NVDA, /analyze/AMD, /analyze/AVGO | P1 |
| 4 | Understanding P/E Ratios: When They Matter and When They Lie | P/E ratio explained, price to earnings ratio | Informational | 1,500 | /analyze/TSLA, /analyze/AMZN (high P/E examples) | P1 |
| 5 | RSU Tax Strategy: A Software Engineer's Guide to Not Losing 40% | RSU tax strategy, RSU vesting taxes | Informational | 2,000 | /analyze (for checking your company stock), /blog/tax-loss-harvesting-guide | P1 |
| 6 | The Bull Case vs Bear Case Framework: How Wall Street Actually Thinks About Stocks | bull vs bear case, how to evaluate stocks | Informational | 1,500 | /analyze/AAPL, /analyze/TSLA, /analyze/AMZN | P1 |
| 7 | What Analyst Consensus Actually Tells You (And What It Doesn't) | analyst consensus meaning, analyst stock ratings | Informational | 1,500 | /analyze/AAPL, /analyze/GOOGL, /analyze/META | P1 |

### P2 -- Publish within 60 days (supports topical authority)

| # | Title | Target Keyword(s) | Search Intent | Word Count | Internal Links | Priority |
|---|-------|--------------------|---------------|------------|----------------|----------|
| 8 | How to Read a Company's Financial Statements (Without an Accounting Degree) | how to read financial statements, income statement explained | Informational | 2,200 | /analyze/AAPL (as example), /analyze/JPM | P2 |
| 9 | Stock Valuation Methods: DCF, Comparables, and When to Use Each | stock valuation methods, DCF analysis | Informational | 2,000 | /analyze/MSFT, /analyze/GOOGL | P2 |
| 10 | Portfolio Concentration Risk: When Your Biggest Winner Becomes Your Biggest Threat | portfolio concentration risk, position sizing | Informational | 1,500 | /analyze (check your holdings), /blog/tax-loss-harvesting-guide | P2 |
| 11 | How News Sentiment Moves Stock Prices (And How to Read It) | news sentiment investing, stock news analysis | Informational | 1,500 | /analyze/TSLA (volatile example), /analyze/NVDA | P2 |
| 12 | Earnings Season Guide: How to Trade Around Earnings Reports | earnings season guide, how to analyze earnings | Informational | 1,800 | /analyze/AAPL, /analyze/MSFT, /analyze/AMZN | P2 |
| 13 | The 5 Metrics That Actually Predict Stock Returns | stock metrics that matter, fundamental analysis metrics | Informational | 1,500 | /analyze (free tool), multiple /analyze/* links | P2 |
| 14 | Finding Undervalued Stocks: A Data-Driven Approach | how to find undervalued stocks, undervalued stocks 2026 | Informational | 2,000 | /analyze (run your own analysis), /analyze/JPM, /analyze/BAC | P2 |

### P3 -- Publish within 90 days (long-tail + topical depth)

| # | Title | Target Keyword(s) | Search Intent | Word Count | Internal Links | Priority |
|---|-------|--------------------|---------------|------------|----------------|----------|
| 15 | Tesla Stock: Everything You Need to Know Before Buying in 2026 | TSLA stock analysis 2026, Tesla stock buy or sell | Transactional | 2,000 | /analyze/TSLA, /analyze/RIVN, /analyze/NIO | P3 |
| 16 | How Often Should You Rebalance Your Portfolio? | portfolio rebalancing guide, when to rebalance | Informational | 1,200 | /analyze (check current allocations), /blog/portfolio-concentration-risk | P3 |
| 17 | EPS Explained: The Most Misunderstood Metric in Stock Analysis | EPS explained, earnings per share | Informational | 1,200 | /analyze/AAPL, /analyze/NVDA | P3 |
| 18 | Dividend Stocks vs Growth Stocks: The Real Math Behind the Debate | dividend vs growth stocks, dividend investing | Informational | 1,800 | /analyze/JPM (dividend), /analyze/NVDA (growth) | P3 |
| 19 | How Helm Terminal Works: Building an AI Stock Analysis Engine | AI stock analysis how it works, Helm Terminal | Brand awareness | 1,500 | /analyze, /pricing, /signup | P3 |
| 20 | Sector Rotation Strategy: Following the Money in 2026 | sector rotation strategy, sector analysis | Informational | 1,500 | /analyze/XLF, /analyze/XLK, /analyze/XLE | P3 |

### Content Production Notes

- **Voice:** Match existing blog posts -- first person, opinionated, specific. "I ran a scan" not "one should consider."
- **Every post must include:** At least 2 links to /analyze/[TICKER] pages and 1 link to the /analyze hub.
- **CTA pattern:** Use the existing `CTACard` MDX component in every post. Place one after the first major section and one at the end.
- **Publish cadence:** 2 posts per week is sustainable. P1 batch (7 posts) ships in 3-4 weeks.

---

## 5. Technical SEO Checklist (Next.js Specific)

### Sitemap Generation

**Status:** Partially implemented. Missing /analyze/[ticker] pages.

**Action items:**
- [ ] Create `lib/top-tickers.ts` with S&P 500 tickers (see Programmatic SEO section)
- [ ] Update `app/sitemap.ts` to include /analyze pages
- [ ] Verify sitemap renders at helmterminal.dev/sitemap.xml after deploy
- [ ] Submit sitemap to Google Search Console
- [ ] Submit sitemap to Bing Webmaster Tools
- [ ] If sitemap exceeds 50,000 URLs or 50MB, implement sitemap index (Next.js `generateSitemaps()`)

### robots.txt

**Status:** Well-configured. Already allows all crawlers including AI bots (GPTBot, PerplexityBot, ClaudeBot, etc.) while blocking /dashboard, /api, /mfa-verify.

**Action items:**
- [ ] Add `Disallow: /forgot-password` and `Disallow: /reset-password` (thin auth pages)
- [ ] Consider adding `Crawl-delay: 1` for non-Googlebot crawlers to protect server resources (optional, Google ignores it)
- [ ] Verify robots.txt renders correctly at helmterminal.dev/robots.txt

### Canonical URLs

**Status:** Implemented on all major pages. Correctly points to `https://helmterminal.dev/...`.

**Action items:**
- [ ] Verify canonical is present on every page by auditing with Screaming Frog or similar
- [ ] Ensure /analyze/aapl and /analyze/AAPL resolve to the same canonical (currently the code uppercases, but verify redirect behavior)
- [ ] Add a middleware redirect for lowercase ticker URLs to uppercase:

```typescript
// middleware.ts addition
if (pathname.startsWith('/analyze/') && pathname !== pathname.replace(/\/analyze\/(.+)/, (_, t) => `/analyze/${t.toUpperCase()}`)) {
  const upper = pathname.replace(/\/analyze\/(.+)/, (_, t) => `/analyze/${t.toUpperCase()}`);
  return NextResponse.redirect(new URL(upper, request.url), 301);
}
```

### OG Tags

**Status:** Well-implemented. Custom `opengraph-image.tsx` generates dynamic OG images for each ticker. Title, description, URL, and siteName are set on all pages.

**Action items:**
- [ ] Add `og:locale` property: `locale: 'en_US'` in openGraph config
- [ ] Verify OG images render correctly with https://www.opengraph.xyz/
- [ ] Add `twitter:creator` tag if you have a Twitter/X account: `creator: '@helmterminal'`
- [ ] Test with Twitter Card Validator and Facebook Sharing Debugger

### Performance Optimizations

**Status:** Good baseline. Next.js App Router with server components. Analysis pages are SSR with caching.

**Action items:**
- [ ] Verify Core Web Vitals with PageSpeed Insights for /analyze/AAPL
- [ ] Largest Contentful Paint (LCP): The analysis card is the LCP element. Since it's server-rendered, this should be fast. Monitor for regressions.
- [ ] Cumulative Layout Shift (CLS): The email gate overlay could cause CLS when it appears. The current `!mounted` SSR fallback helps -- ensure the gated/ungated states have identical dimensions above the fold.
- [ ] First Input Delay (FID): Minimal JS on analysis pages (client component is lightweight). Good.
- [ ] Add `next/font` optimization if not already using it for the mono font
- [ ] Consider `loading="lazy"` on any below-fold images or charts added in the future
- [ ] Add `fetchPriority="high"` to the LCP element if it's an image
- [ ] Enable Next.js ISR (Incremental Static Regeneration) for /analyze pages:

```typescript
// In app/analyze/[ticker]/page.tsx
export const revalidate = 3600; // Revalidate every hour
```

This would serve static HTML for cached analyses, falling back to SSR for fresh ones. Dramatically improves TTFB for crawlers and repeat visitors.

### Mobile-First Considerations

**Status:** The existing UI uses responsive classes (max-w-3xl, px-6, grid-cols-2 sm:grid-cols-3). Appears mobile-friendly.

**Action items:**
- [ ] Test with Google's Mobile-Friendly Test tool
- [ ] Verify tap targets are at least 48x48px (the ticker buttons in RelatedTickers are 44px tall -- consider bumping)
- [ ] Ensure the email gate modal is usable on small screens (max-w-sm with mx-4 looks correct)
- [ ] Test the inline search form on mobile -- ensure the keyboard doesn't obscure the submit button
- [ ] Verify viewport meta tag is set (Next.js sets this by default)

### Additional Technical Items

- [ ] **Google Search Console:** Set up property for helmterminal.dev if not already done. Verify ownership. Submit sitemap.
- [ ] **Bing Webmaster Tools:** Set up and submit sitemap. Bing drives more traffic than people expect, and feeds results to DuckDuckGo.
- [ ] **Structured Data Testing:** Run every analysis page through Google's Rich Results Test (https://search.google.com/test/rich-results) to verify schema markup.
- [ ] **404 handling:** Verify that invalid tickers return proper HTTP 404 (the `notFound()` call in the page component does this via Next.js).
- [ ] **HTTPS redirect:** Verify http://helmterminal.dev redirects to https:// (Vercel handles this by default).
- [ ] **www redirect:** Verify www.helmterminal.dev redirects to helmterminal.dev (configure in Vercel dashboard).
- [ ] **Trailing slash:** Pick a convention and stick to it. Next.js defaults to no trailing slash. Verify no pages have trailing slash URLs indexed.
- [ ] **Page speed budget:** Set a target of < 2.5s LCP, < 100ms FID, < 0.1 CLS. Monitor with web-vitals package or Vercel Analytics.

---

## 6. Link Building Strategy

### Context

Helm is a fintech SaaS with a genuinely useful free tool. This is a strong position for link building because you're offering something of value, not just asking for links. The strategy leans heavily on the free tool as linkbait.

### 1. Product Directories and Launch Platforms

Submit Helm's free stock analyzer to:

- **Product Hunt:** Launch with the free stock analysis angle, not the full platform. Title: "Helm -- Free AI stock analysis for any ticker." Time it after the P1 blog content is live so the site has depth.
- **AlternativeTo:** List as alternative to Bloomberg Terminal, Yahoo Finance, Seeking Alpha, TipRanks.
- **SaaSHub / SaaSWorthy:** Fintech category listings.
- **ToolFinder / There's An AI For That / AI Tool Directory:** List under "AI Finance Tools" and "Stock Analysis Tools."
- **BetaList** (if you're still in beta/early access)
- **Capterra / G2:** Create profiles (even if you're free tier only initially)

**Expected impact:** 10-20 backlinks, DA 30-70 range. Low effort, moderate value.

### 2. Financial Tool Aggregators

Reach out to sites that curate lists of financial tools:

- Investopedia "Best Stock Analysis Tools" articles
- NerdWallet tool comparison pages
- Benzinga tool roundups
- The Motley Fool tool recommendations
- StockAnalysis.com (ironically, they list tools)
- Finviz alternatives lists

**Pitch angle:** "We built a free AI stock analysis tool that generates institutional-grade reports for any ticker in seconds. It's free, no account required. Would you consider including it in your [specific article name]?"

**Expected impact:** 2-5 high-authority backlinks (DA 60-90). High effort, very high value.

### 3. Content-Led Link Building (Linkable Assets)

Create content specifically designed to earn links:

- **"State of Retail Investing 2026" report:** Aggregate anonymized data from Helm users (portfolio composition, most-analyzed tickers, sector trends). Publish as a standalone report page. Journalists and bloggers link to original research.
- **"AI vs Human Stock Analysis" comparison:** Run Helm's AI analysis against analyst consensus for the S&P 500 over 6 months. Publish results. This is genuinely interesting content that finance media would cover.
- **Interactive tool embeds:** Create an embeddable widget version of the stock analyzer that bloggers can embed on their sites with a link back. (Lower priority, high engineering effort.)

**Expected impact:** 5-20 backlinks per asset, DA 40-80. High effort, very high value.

### 4. HARO / Journalist Outreach (now Connectively, or Qwoted)

Sign up for Connectively (formerly HARO), Qwoted, and Help a B2B Writer. Respond to queries in these beats:

- **Fintech:** "What tools do you use for stock analysis?" -- mention Helm.
- **Investing:** "How should beginners analyze stocks?" -- provide framework, mention the free tool.
- **AI/Tech:** "How is AI changing personal finance?" -- speak to the Helm approach.
- **Tax season:** "What tools help with tax-loss harvesting?" -- reference the blog post and tool.

**Pitch template for HARO:**
> As the founder of Helm Terminal (helmterminal.dev), a financial intelligence platform used by engineers and founders to analyze stocks, I can speak to [specific topic]. [2-3 sentence expert quote]. Helm offers a free AI stock analysis tool at helmterminal.dev/analyze that [relevant detail].

**Expected impact:** 3-10 mentions per quarter, DA varies widely. Medium effort, cumulative value.

### 5. Community Engagement (Earned Links)

Participate authentically in communities where your target users live. Do NOT spam links. Provide value first.

- **Hacker News:** Share blog posts like "Best Bloomberg Terminal Alternatives" or "RSU Tax Strategy for Engineers." HN traffic is enormous and links from Show HN posts carry weight. Time a Show HN for when the product is polished.
- **Reddit:** r/investing, r/stocks, r/personalfinance, r/fatFIRE, r/financialindependence. Answer questions and mention the free tool when genuinely relevant.
- **Twitter/X Finance:** Engage with FinTwit. Quote-tweet earnings results with Helm analysis screenshots. Build relationships with finance influencers.
- **Indie Hackers / Build in Public:** Share the growth story. The "free tool as acquisition channel" angle is interesting to other founders.

**Expected impact:** Variable. 2-5 high-quality backlinks per month from referral traffic and community shares. Low cost but requires consistent effort.

### 6. Guest Posts and Contributed Articles

Write guest posts for finance and fintech publications:

- **Target publications:** Fintech Magazine, The Financial Brand, Benzinga contributor program, Seeking Alpha contributor, Medium finance publications (The Startup, Better Programming).
- **Topic angles:** "How AI Is Replacing the Bloomberg Terminal for Retail Investors," "The Engineering Approach to Stock Analysis," "Why Most Stock Screeners Are Broken."
- **Link placement:** Author bio link to helmterminal.dev, in-content link to /analyze where contextually relevant.

**Expected impact:** 1-2 backlinks per post, DA 50-80. Medium effort.

### 7. University and Educational Partnerships

Finance and business programs need free tools for students.

- Reach out to university finance departments offering the free analyzer as a teaching tool.
- Create a "How to Use Helm for Class" guide.
- Student users become lifelong users.

**Expected impact:** .edu backlinks are extremely valuable. 1-3 links, but high domain authority.

### 8. Podcast Appearances

The founder's story (building institutional-grade tools for retail investors) is a compelling narrative for:

- Fintech podcasts (Bankless, The Pomp Podcast, Fintech Insider)
- Indie hacker / startup podcasts (My First Million, Indie Hackers Podcast, Software Social)
- Personal finance podcasts (Afford Anything, ChooseFI)

Each appearance typically generates a show notes page with a link.

**Expected impact:** 1 backlink per appearance, DA 30-60, plus brand awareness and direct traffic.

### 9. Open Source / Developer Relations

The tech stack is interesting to developers. Consider:

- Writing a technical blog post about building the analysis pipeline (Finnhub + OpenAI + caching architecture). Post on dev.to, hashnode, and the Helm blog.
- Contributing to Next.js ecosystem (example projects, Vercel templates).
- Open-sourcing a small component (like the OG image generator pattern) with attribution links.

**Expected impact:** Developer community backlinks, DA 40-70.

### 10. Competitive Analysis Link Gap

Use Ahrefs/Semrush to find sites linking to competitors (TipRanks, Simply Wall St, Stock Analysis) but NOT to Helm. Reach out with: "I noticed you linked to [competitor] in your article about [topic]. We've built a free alternative that [specific differentiator]. Would you consider mentioning us?"

**Expected impact:** Depends on the gap. Typically 5-15 opportunities worth pursuing per month.

---

## Implementation Roadmap

### Week 1-2: Technical Foundation
- Update meta tags on /analyze/[ticker] pages (title template, description template)
- Add FAQ schema markup
- Add H1 semantic heading
- Create lib/top-tickers.ts
- Update sitemap.ts to include analysis pages
- Add middleware redirect for lowercase tickers
- Submit sitemap to Google Search Console + Bing Webmaster Tools

### Week 3-4: Content Sprint
- Publish P1 blog posts #1-4 (how to analyze, best AI tools, NVDA analysis, P/E ratios)
- Submit to Product Hunt and 5 AI/SaaS directories
- Set up HARO/Connectively account

### Week 5-8: Scale Content + Links
- Publish P1 blog posts #5-7 (RSU tax, bull/bear framework, analyst consensus)
- Begin P2 blog posts
- Guest post pitches (3-5 publications)
- Reddit/HN community engagement (consistent, not one-off)
- Respond to 5-10 HARO queries

### Month 3-4: Measure and Iterate
- Audit Google Search Console data: which /analyze pages are indexing? Which queries driving impressions?
- Double down on keywords showing impressions but low CTR (optimize titles/descriptions)
- Publish P2 and P3 blog content
- Build first linkable asset (data report or comparison study)

### Month 5-6: Compound
- Expect to see /analyze pages ranking for long-tail ticker queries
- Blog posts should start ranking for informational queries
- Iterate on content based on Search Console data
- Consider expanding programmatic pages to cover ETFs, crypto

---

## Metrics to Track

| Metric | Tool | Baseline Target (Month 3) | Growth Target (Month 6) |
|--------|------|---------------------------|-------------------------|
| Organic sessions | Google Analytics | 500/month | 3,000/month |
| Indexed /analyze pages | Search Console | 200 | 500+ |
| Ranking keywords | Ahrefs/Semrush | 100 | 500+ |
| Referring domains | Ahrefs | 20 | 60+ |
| Blog organic traffic | Google Analytics | 200/month | 1,500/month |
| /analyze page organic traffic | Google Analytics | 300/month | 2,000/month |
| Email captures from /analyze gate | Internal analytics | 50/month | 300/month |
| Domain Authority / Rating | Ahrefs | 15 | 25+ |

### Honest expectations

SEO compounds. Months 1-2 will feel like nothing is happening. Month 3 you'll see indexing. Month 4-5 the long-tail starts hitting. Month 6+ is where the programmatic pages start earning real traffic. The blog posts will likely rank faster than the programmatic pages because they have more content depth.

The single highest-ROI action is getting the sitemap updated with /analyze pages and the FAQ schema markup added. That's 2-3 hours of engineering work that unlocks thousands of potential landing pages.
