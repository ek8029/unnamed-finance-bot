import type { Metadata } from 'next';

// Client component below, so metadata lives here. noindex: a password-reset
// form is never a useful search result and only dilutes the indexed set.
export const metadata: Metadata = {
  title: 'Reset your password | Helm Terminal',
  description: 'Request a password reset link for your Helm Terminal account.',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
