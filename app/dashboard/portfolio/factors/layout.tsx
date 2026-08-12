import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Factor Lens' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
