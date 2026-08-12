import type { Metadata } from 'next';

/**
 * Object form so /analyze/[ticker] keeps a template — a plain string title
 * here would consume the parent's and leave the ticker tab suffix-less.
 */
export const metadata: Metadata = {
  title: {
    default: 'Analyze',
    template: '%s | Helm Terminal',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
