import { SiteNav } from '@/components/site-nav';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, ArrowRight } from 'lucide-react';
import { LegalFooter } from '@/components/legal-footer';
import { TickerSearch } from './ticker-search';

export const metadata: Metadata = {
  title: 'Free AI Stock Analysis Tool — Analyze 500+ US Stocks | Helm Terminal',
  description:
    'Get free AI-powered analysis for any US stock. Real-time prices, financial metrics, and intelligent insights for AAPL, TSLA, MSFT, and 150+ more tickers.',
  openGraph: {
    title: 'Free AI Stock Analysis Tool — Analyze 500+ US Stocks | Helm Terminal',
    description:
      'Get free AI-powered analysis for any US stock. Real-time prices, financial metrics, and intelligent insights for AAPL, TSLA, MSFT, and 150+ more tickers.',
    url: 'https://helmterminal.dev/analyze',
    siteName: 'Helm Terminal',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free AI Stock Analysis Tool — Analyze 500+ US Stocks | Helm Terminal',
    description:
      'Get free AI-powered analysis for any US stock. Real-time prices, financial metrics, and intelligent insights for AAPL, TSLA, MSFT, and 150+ more tickers.',
  },
  alternates: {
    canonical: 'https://helmterminal.dev/analyze',
  },
};

const POPULAR_TICKERS = [
  ['AAPL', 'Apple'], ['MSFT', 'Microsoft'], ['GOOGL', 'Alphabet'], ['AMZN', 'Amazon'],
  ['NVDA', 'NVIDIA'], ['TSLA', 'Tesla'], ['META', 'Meta Platforms'], ['JPM', 'JPMorgan Chase'],
];

export default function AnalyzePage() {
  return (
    <div className="helm-discovery helm-analyze">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": "Free AI Stock Analysis Tool — Analyze 150+ US Stocks",
            "description": "Get free AI-powered analysis for any US stock. Real-time prices, financial metrics, and intelligent insights for AAPL, TSLA, MSFT, and 150+ more tickers.",
            "url": "https://helmterminal.dev/analyze",
            "isPartOf": { "@type": "WebSite", "name": "Helm Terminal", "url": "https://helmterminal.dev" },
            "provider": { "@type": "Organization", "name": "Helm Terminal" },
          }),
        }}
      />
      <SiteNav />
      <main id="main-content" className="helm-discovery-width">
        <section className="helm-analyze-hero" aria-labelledby="analysis-title">
          <div className="helm-analyze-copy">
            <p className="helm-kicker">THE RESEARCH STARTS HERE</p>
            <h1 id="analysis-title">One ticker.<br /><span>A fuller picture.</span></h1>
            <p className="helm-discovery-description">
              Free AI stock analysis that brings the numbers, the expectations, and both sides of the investment case into focus.
            </p>
            <div className="helm-discovery-search">
              <p className="helm-discovery-search-label">Which company is on your mind?</p>
              <TickerSearch size="lg" />
              <p className="helm-discovery-search-note">Start with a US stock ticker. Read your first analysis before creating an account.</p>
            </div>
          </div>
          <aside className="helm-analysis-index" aria-labelledby="report-contents">
            <div className="helm-analysis-index-top"><span>HELM RESEARCH</span><span>REPORT CONTENTS</span></div>
            <h2 id="report-contents">Understand the business.<br />Pressure-test the case.</h2>
            <ol>
              <li><span>01</span><div><h3>The fundamentals</h3><p>Pricing, valuation, financial metrics, and earnings data.</p></div></li>
              <li><span>02</span><div><h3>The market’s expectations</h3><p>Analyst consensus and the context behind the news.</p></div></li>
              <li><span>03</span><div><h3>Both sides of the thesis</h3><p>The bull case, the bear case, and an AI summary to bring it together.</p></div></li>
            </ol>
            <Link href="/compare" className="helm-text-link">Weighing two companies? Compare them <ArrowUpRight size={16} /></Link>
          </aside>
        </section>

        <section className="helm-discovery-popular" aria-labelledby="popular-analysis">
          <div className="helm-discovery-section-line"><h2 id="popular-analysis">A few places to begin</h2><span>POPULAR US STOCKS</span></div>
          <div className="helm-discovery-tickers">
            {POPULAR_TICKERS.map(([ticker, name]) => (
              <Link key={ticker} href={`/analyze/${ticker}`} prefetch={false}>
                <div><strong>{ticker}</strong><span>{name}</span></div><ArrowUpRight size={18} />
              </Link>
            ))}
          </div>
        </section>

        <section className="helm-discovery-next" aria-labelledby="next-step-title">
          <div>
            <p className="helm-kicker">FROM A SINGLE STOCK TO EVERYTHING YOU OWN</p>
            <h2 id="next-step-title">Make the intelligence personal.</h2>
            <p>Add your holdings to connect the research to your portfolio. Start with one position or link your accounts through Plaid.</p>
          </div>
          <div className="helm-discovery-next-actions">
            <Link href="/signup" className="helm-button">Build my portfolio view <ArrowRight size={17} /></Link>
            <span>Free to start. No card required.</span>
          </div>
        </section>
      </main>

      <LegalFooter />
    </div>
  );
}
