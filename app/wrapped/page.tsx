import type { Metadata } from 'next';
import { WrappedLanding } from '@/components/wrapped/wrapped-landing';

export const metadata: Metadata = {
  title: 'Spotify Wrapped for Your Portfolio — Helm Wrapped | Free Investment Year in Review',
  description:
    'Spotify Wrapped but for investing. See your real portfolio return vs the S&P 500, best and worst trades, investor personality type, and more. Free. Connect any brokerage in 30 seconds.',
  keywords: [
    'Spotify Wrapped for stocks',
    'Spotify Wrapped for investing',
    'portfolio Spotify Wrapped',
    'investing Spotify Wrapped',
    'investment wrapped',
    'portfolio year in review',
    'stock portfolio recap',
    'investor personality type',
    'portfolio performance review',
    'brokerage year in review',
    'did I beat the S&P 500',
  ],
  openGraph: {
    title: 'Spotify Wrapped for Your Investment Portfolio — Free',
    description:
      'Your real return vs the S&P 500. Best trade, worst trade, investor personality. Connect any brokerage — free.',
    url: 'https://helmterminal.dev/wrapped',
    type: 'website',
    siteName: 'Helm Terminal',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Spotify Wrapped for Your Portfolio — Free',
    description:
      'Your real return vs the S&P. Best trade, worst trade, investor personality type. Free — any brokerage.',
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
