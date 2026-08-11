import type { Metadata } from 'next';

/**
 * The page itself is a client component, so it cannot export metadata. Without
 * this layout it inherited the root title and shipped an indexed SEO asset
 * under "Helm Terminal | Agentic Thesis Monitoring for Your Whole Portfolio",
 * identical to the homepage. Its sibling /tools/tlh-calculator is a server
 * component and carries its own metadata inline.
 */
export const metadata: Metadata = {
  title: 'RSU Tax Calculator | Helm Terminal',
  description:
    'Free RSU calculator. Enter your grant, vesting schedule and federal bracket to estimate tax at vesting and post-tax take-home. Built for employees holding restricted stock units.',
  openGraph: {
    title: 'RSU Tax Calculator | Helm Terminal',
    description:
      'Estimate tax at vesting and post-tax take-home on your restricted stock units. Free calculator for employees with equity compensation.',
    url: 'https://helmterminal.dev/tools/rsu-calculator',
    siteName: 'Helm Terminal',
    type: 'website',
  },
  alternates: { canonical: 'https://helmterminal.dev/tools/rsu-calculator' },
};

export default function RSUCalculatorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
