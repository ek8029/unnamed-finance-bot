import type { Metadata } from 'next';

// Client component below, so metadata lives here. noindex: this page is only
// reachable with a one-time token and must never surface in search.
export const metadata: Metadata = {
  title: 'Choose a new password | Helm Terminal',
  description: 'Set a new password for your Helm Terminal account.',
  robots: { index: false, follow: false },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
