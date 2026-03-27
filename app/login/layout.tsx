import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In - Helm',
  description: 'Sign in to your Helm financial intelligence terminal.',
  alternates: { canonical: 'https://helmterminal.dev/login' },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
