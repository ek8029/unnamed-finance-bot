import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing | Helm Terminal',
  description:
    'Helm Terminal pricing — free portfolio dashboard, AI stock analysis, and net worth tracking. Pro plans from $4.99/mo for tax-loss harvesting and earnings tracking.',
  alternates: {
    canonical: 'https://helmterminal.dev/pricing',
  },
  openGraph: {
    title: 'Pricing | Helm Terminal',
    description:
      'Free portfolio dashboard with AI stock analysis. Pro plans from $4.99/mo.',
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
