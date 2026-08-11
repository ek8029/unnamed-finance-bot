import type { Metadata } from 'next';

// Client component below, so metadata lives here. noindex: a transient OAuth
// redirect target with no standalone content.
export const metadata: Metadata = {
  title: 'Signing you in | Helm Terminal',
  description: 'Completing sign-in.',
  robots: { index: false, follow: false },
};

export default function OAuthCallbackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
