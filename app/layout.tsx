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
  title: 'Helm Terminal - AI-Powered Financial Intelligence',
  description: 'Institutional-grade financial analysis powered by AI. The personal Bloomberg terminal for modern investors.',
  openGraph: {
    title: 'Helm Terminal - AI-Powered Financial Intelligence',
    description: 'Institutional-grade financial analysis powered by AI. The personal Bloomberg terminal for modern investors.',
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
    title: 'Helm Terminal - AI-Powered Financial Intelligence',
    description: 'Institutional-grade financial analysis powered by AI.',
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
              sameAs: [
                'https://x.com/helmterminal',
                'https://www.linkedin.com/company/helmfintech',
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
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
                description: 'Free AI stock analysis for any US ticker. Paid plans available for portfolio features.',
              },
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
              aggregateRating: undefined,
              publisher: {
                '@type': 'Organization',
                name: 'Helm Terminal',
                url: 'https://helmterminal.dev',
              },
            }),
          }}
        />
      </head>
      <body className={`${manrope.variable} ${spaceGrotesk.variable} font-sans`}>
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
