import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from 'next/font/google';
import Script from 'next/script';
import "./globals.css";
import { Providers } from '@/components/providers';
import { RecoveryRedirect } from '@/components/recovery-redirect';
import { CookieConsent } from '@/components/cookie-consent';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://helmterminal.dev'),
  title: 'Helm Terminal — Free Portfolio Intelligence for Investors',
  description: 'See your portfolio the way hedge funds see theirs. Concentration risk, tax-loss harvesting, earnings exposure, and AI stock analysis — free. No Bloomberg required.',
  openGraph: {
    title: 'Helm Terminal — Free Portfolio Intelligence for Investors',
    description: 'See your portfolio the way hedge funds see theirs. Concentration risk, tax-loss harvesting, earnings exposure, and AI stock analysis — free.',
    url: 'https://helmterminal.dev',
    siteName: 'Helm Terminal',
    type: 'website',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Helm Terminal - AI-Powered Financial Intelligence',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Helm Terminal — Free Portfolio Intelligence for Investors',
    description: 'Concentration risk, tax-loss harvesting, earnings exposure, and AI stock analysis — free.',
    images: ['/opengraph-image'],
  },
  alternates: {
    canonical: 'https://helmterminal.dev',
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: '/icon',
    apple: '/apple-icon',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Helm Terminal',
              url: 'https://helmterminal.dev',
              logo: 'https://helmterminal.dev/icon',
              description:
                'Institutional-grade financial intelligence terminal. AI-powered portfolio analysis, tax optimization, and wealth monitoring for individuals managing $50K–$2M+ across multiple accounts.',
              foundingDate: '2025',
              founder: {
                '@type': 'Person',
                name: 'Evan Kim',
                jobTitle: 'Founder',
                url: 'https://helmterminal.dev/about',
              },
              sameAs: [
                'https://x.com/helmterminal',
                'https://www.linkedin.com/company/helmfintech',
                'https://www.wikidata.org/wiki/Q139714123',
              ],
              knowsAbout: [
                'Portfolio Analysis',
                'Tax-Loss Harvesting',
                'Net Worth Tracking',
                'Financial Intelligence',
                'AI Stock Analysis',
                'Cash Flow Monitoring',
              ],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'Helm Terminal',
              applicationCategory: 'FinanceApplication',
              operatingSystem: 'Web',
              url: 'https://helmterminal.dev',
              description:
                'AI-powered stock analysis, portfolio intelligence, and tax-loss harvesting for retail investors. Live-refreshed analysis based on real-time market data.',
              offers: [
                {
                  '@type': 'Offer',
                  price: '0',
                  priceCurrency: 'USD',
                  description: 'Free — AI stock analysis, portfolio dashboard, net worth tracking, actions inbox',
                },
                {
                  '@type': 'Offer',
                  price: '14.99',
                  priceCurrency: 'USD',
                  description: 'Pro Monthly — tax-loss harvesting, earnings tracking, unlimited analyses',
                  priceSpecification: {
                    '@type': 'UnitPriceSpecification',
                    price: '14.99',
                    priceCurrency: 'USD',
                    billingDuration: 'P1M',
                  },
                },
                {
                  '@type': 'Offer',
                  price: '119',
                  priceCurrency: 'USD',
                  description: 'Pro Annual — everything in Pro, billed yearly (save 33%)',
                  priceSpecification: {
                    '@type': 'UnitPriceSpecification',
                    price: '119',
                    priceCurrency: 'USD',
                    billingDuration: 'P1Y',
                  },
                },
                {
                  '@type': 'Offer',
                  price: '249',
                  priceCurrency: 'USD',
                  description: 'Lifetime — one-time payment, locked-in forever',
                },
              ],
              featureList: [
                'Live AI stock analysis',
                'Portfolio sync via Plaid',
                'Tax-loss harvesting signals',
                'Real-time market data',
                'Risk intelligence and alerts',
                'Sector comparison',
                'Earnings exposure tracking',
                'Cash flow monitoring',
              ],
              publisher: {
                '@type': 'Organization',
                name: 'Helm Terminal',
                url: 'https://helmterminal.dev',
              },
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'Helm Terminal',
              url: 'https://helmterminal.dev',
              potentialAction: {
                '@type': 'SearchAction',
                target: {
                  '@type': 'EntryPoint',
                  urlTemplate: 'https://helmterminal.dev/analyze/{search_term_string}',
                },
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: [
                {
                  '@type': 'Question',
                  name: 'What is Helm Terminal?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Helm Terminal is a free, institutional-grade financial intelligence platform for individual investors. It aggregates brokerage and bank accounts via Plaid, runs deterministic rule-based analysis over your portfolio, and surfaces actionable insights like tax-loss harvesting opportunities, concentration risk, earnings exposure, and cash flow changes. It covers any US-listed stock or ETF on NYSE, NASDAQ, or AMEX.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'Is Helm Terminal free?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Yes. Helm Terminal offers a free tier that includes AI stock analysis (5 per day), a full portfolio dashboard with Plaid sync, net worth tracking, cash flow overview, concentration risk analysis, sector allocation, and an actions inbox. Pro plans starting at $14.99/month add tax-loss harvesting with wash-sale detection, earnings exposure tracking, and unlimited analyses.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'How does Helm Terminal compare to Bloomberg Terminal?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Bloomberg Terminal costs approximately $24,000 per year and is designed for institutional traders. Helm Terminal provides a subset of similar capabilities — portfolio analysis, real-time market data, AI-powered stock analysis, and risk alerts — for individual investors, starting at $0. It is not a Bloomberg replacement for professional trading desks, but it gives retail investors access to institutional-quality portfolio intelligence.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'Is Helm Terminal safe to use with my financial accounts?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Helm Terminal connects to your accounts through Plaid, a bank-grade financial data provider used by Venmo, Coinbase, and thousands of other apps. The connection is read-only — Helm can never move money, execute trades, or modify your accounts. All data is encrypted in transit (TLS 1.3) and at rest, with row-level security in the database.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'What data sources does Helm Terminal use?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Helm Terminal uses Finnhub for real-time stock quotes, Polygon.io for historical prices, dividends, and splits, and Plaid for account aggregation. AI stock analysis pages use GPT-4o-mini for narrative interpretation of structured financial data, clearly labeled as AI-generated. The rule-based intelligence engine (tax-loss harvesting, concentration alerts, etc.) uses no AI — it is fully deterministic and auditable.',
                  },
                },
              ],
            }),
          }}
        />
      </head>
      <body className={`${manrope.variable} ${spaceGrotesk.variable} font-sans`}>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-[var(--color-gold)] focus:text-[var(--color-bg-base)] focus:rounded focus:text-sm focus:font-semibold">
          Skip to main content
        </a>
        <RecoveryRedirect />
        <Providers>{children}</Providers>
        <Script
          src="https://plausible.io/js/pa-O3gPqcGXLE6Ju_7Ulgsf6.js"
          strategy="afterInteractive"
        />
        <Script id="plausible-init" strategy="afterInteractive">
          {`window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init()`}
        </Script>
        <Script id="apollo-tracker" strategy="afterInteractive">
          {`(function(){var n=Math.random().toString(36).substring(7),o=document.createElement("script");o.src="https://assets.apollo.io/micro/website-tracker/tracker.iife.js?nocache="+n;o.async=true;o.defer=true;o.onload=function(){window.trackingFunctions.onLoad({appId:"69df97bfa786e5001d3cd2c3"})};document.head.appendChild(o)})()`}
        </Script>
        <CookieConsent />
      </body>
    </html>
  );
}
