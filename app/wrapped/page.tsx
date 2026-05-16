import type { Metadata } from 'next';
import { WrappedLanding } from '@/components/wrapped/wrapped-landing';

export const metadata: Metadata = {
  title: 'Your Investment Year in Review — Helm Wrapped',
  description:
    'See your portfolio returns, best trades, investor personality, and more. Free. Connect any brokerage and get your Wrapped in 30 seconds.',
  keywords: [
    'investment wrapped',
    'portfolio year in review',
    'stock portfolio recap',
    'investing recap 2025',
    'Spotify Wrapped for stocks',
    'portfolio performance review',
    'brokerage year in review',
  ],
  openGraph: {
    title: 'Your Investment Year in Review — Helm Wrapped',
    description:
      'See how your portfolio performed. Compare against the S&P 500. Share your results.',
    url: 'https://helmterminal.dev/wrapped',
    type: 'website',
    siteName: 'Helm Terminal',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Your Investment Year in Review — Helm Wrapped',
    description:
      'See your portfolio returns, best trades, and investor personality. Free — connect any brokerage.',
  },
  alternates: {
    canonical: 'https://helmterminal.dev/wrapped',
  },
};

export default function WrappedPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Helm Wrapped',
    url: 'https://helmterminal.dev/wrapped',
    description:
      'See your portfolio returns, best trades, investor personality, and more. Free year-in-review for any brokerage account.',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    creator: {
      '@type': 'Organization',
      name: 'Helm Terminal',
      url: 'https://helmterminal.dev',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <WrappedLanding />
    </>
  );
}
