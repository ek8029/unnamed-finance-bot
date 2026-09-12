import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing | Helm Terminal',
  description:
    'Helm Terminal pricing. Free portfolio dashboard, AI stock analysis, and one monitored thesis with cited history. Pro at $20/mo or $149/year extends monitoring across your portfolio and adds the agent and detailed tax tools. Flat pricing, zero percent of AUM.',
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
