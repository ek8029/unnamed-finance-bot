import type { Metadata } from 'next';

/**
 * Object form, not a plain string: a nested segment that sets `title: 'X'`
 * consumes the parent template and defines none of its own, which left
 * /portfolio/add and /portfolio/factors rendering bare tabs.
 */
export const metadata: Metadata = {
  title: {
    default: 'Portfolio',
    template: '%s | Helm Terminal',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
