import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing | Helm Terminal',
  description:
    'Free: portfolio dashboard, AI stock analysis, one monitored thesis. Pro: $20 a month or $149 a year adds more monitored theses, the agent and tax tools.',
  alternates: {
    canonical: 'https://helmterminal.dev/pricing',
  },
  openGraph: {
    title: 'Pricing | Helm Terminal',
    description:
      'Free portfolio dashboard, AI stock analysis, and one monitored thesis. Pro at $20/mo or $149/year. Flat pricing, zero percent of AUM.',
    url: 'https://helmterminal.dev/pricing',
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
