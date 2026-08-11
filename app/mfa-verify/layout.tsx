import type { Metadata } from 'next';

// Client component below, so metadata lives here. Already in the robots.ts
// DISALLOW list; the meta tag is the belt to that braces, since a disallowed
// URL can still be indexed if something links to it.
export const metadata: Metadata = {
  title: 'Verify it is you | Helm Terminal',
  description: 'Enter your two-factor code to finish signing in.',
  robots: { index: false, follow: false },
};

export default function MfaVerifyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
