import type { Metadata } from 'next';

/**
 * Admin has no shell of its own; this layout exists for the tab titles and to
 * keep the internal tools out of the index if one ever leaks past the gate.
 */
export const metadata: Metadata = {
  title: {
    default: 'Admin | Helm Terminal',
    template: '%s | Helm Admin',
  },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
