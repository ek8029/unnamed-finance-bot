import type { Metadata } from 'next';

// Client component below, so metadata lives here. noindex: a step inside the
// Wrapped flow, not a landing page. /wrapped itself stays indexable.
export const metadata: Metadata = {
  title: 'Connect a brokerage | Helm Terminal',
  description: 'Connect a brokerage read-only to build your Wrapped.',
  robots: { index: false, follow: false },
};

export default function WrappedConnectLayout({ children }: { children: React.ReactNode }) {
  return children;
}
