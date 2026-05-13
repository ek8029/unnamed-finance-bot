import type { Metadata } from 'next';
import { WrappedLanding } from '@/components/wrapped/wrapped-landing';

export const metadata: Metadata = {
  title: 'Your Investment Year in Review — Helm Wrapped',
  description:
    'See your portfolio returns, best trades, investor personality, and more. Free. Connect any brokerage and get your Wrapped in 30 seconds.',
  openGraph: {
    title: 'Your Investment Year in Review — Helm Wrapped',
    description:
      'See how your portfolio performed. Compare against the S&P 500. Share your results.',
    url: 'https://helmterminal.dev/wrapped',
  },
};

export default function WrappedPage() {
  return <WrappedLanding />;
}
