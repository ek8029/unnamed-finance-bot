import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing | Helm Terminal',
  description:
    'Helm Terminal pricing. Free portfolio dashboard, AI stock analysis, and net worth tracking. Pro at $20/mo for thesis monitoring and tax intelligence. Max at $50/mo adds the agent.',
  alternates: {
    canonical: 'https://helmterminal.dev/pricing',
  },
  openGraph: {
    title: 'Pricing | Helm Terminal',
    description:
      'Free portfolio dashboard with AI stock analysis. Pro at $20/mo, Max at $50/mo.',
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
