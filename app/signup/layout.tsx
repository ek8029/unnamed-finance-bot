import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Up - Helm',
  description: 'Create your Helm financial intelligence terminal account.',
  alternates: { canonical: 'https://helmterminal.dev/signup' },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
