import type { Metadata } from "next";
import { Manrope, Space_Grotesk, Instrument_Serif } from 'next/font/google';
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

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  variable: '--font-display-serif',
  weight: ['400'],
  style: ['normal', 'italic'],
  display: 'swap',
});

import type { Viewport } from "next";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://helmterminal.dev'),
  title: 'Helm Terminal | Portfolio Intelligence for Individual Investors',
  description: 'See what your brokerage app won\'t show you. Concentration risk, tax-loss harvesting, earnings exposure, and AI stock analysis across all your accounts. Free.',
  openGraph: {
    title: 'Helm Terminal | Portfolio Intelligence for Individual Investors',
    description: 'Institutional-grade portfolio intelligence for individual investors. AI stock analysis, tax-loss harvesting, earnings tracking, and a unified view across all your accounts.',
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
    title: 'Helm Terminal | Portfolio Intelligence for Individual Investors',
    description: 'Institutional-grade portfolio intelligence for individual investors. AI stock analysis, tax-loss harvesting, and a unified view across your accounts.',
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
                'https://www.crunchbase.com/organization/helm-terminal',
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
                  description: 'Free. Full terminal, AI stock analysis, connected brokerages, daily brief, actions inbox, Wrapped',
                },
                {
                  '@type': 'Offer',
                  price: '20',
                  priceCurrency: 'USD',
                  description: 'Pro. Thesis monitoring with cited evidence, earnings exposure, tax center, conviction-led tailored brief',
                  priceSpecification: {
                    '@type': 'UnitPriceSpecification',
                    price: '20',
                    priceCurrency: 'USD',
                    billingDuration: 'P1M',
                  },
                },
                {
                  '@type': 'Offer',
                  price: '50',
                  priceCurrency: 'USD',
                  description: 'Max. Everything in Pro plus the agent, Thesis Builder, and factor lens',
                  priceSpecification: {
                    '@type': 'UnitPriceSpecification',
                    price: '50',
                    priceCurrency: 'USD',
                    billingDuration: 'P1M',
                  },
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
        {/* FAQPage schema moved to homepage only — see components/homepage/home-content.tsx */}
      </head>
      <body className={`${manrope.variable} ${spaceGrotesk.variable} ${instrumentSerif.variable} font-sans`}>
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
        <CookieConsent />
      </body>
    </html>
  );
}
