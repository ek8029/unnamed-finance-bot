import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Theses · Classic' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
