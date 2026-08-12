import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Adopt a Thesis' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
