// /testing/outbound: layout candidates for the Helm Outbound page before any
// of them ships at /outbound. Dev-only (404s in production).
//
// Helm Outbound is a client-facing B2B service, not Helm Terminal, so the
// variants carry their own type, palette, header and footer. This wrapper adds
// nothing but a thin switcher bar.

import { notFound } from 'next/navigation';
import Link from 'next/link';

export const metadata = { title: 'Outbound lab', robots: { index: false, follow: false } };

const VARIANTS = [
  ['/outbound', 'Dawn (live page)'],
  ['/testing/outbound/proposal', 'Proposal'],
  ['/testing/outbound/worksheet', 'Work order'],
  ['/testing/outbound/firm', 'Quiet firm'],
];

export default function OutboundLabLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <>
      <nav
        aria-label="Lab variants"
        style={{ background: '#222', color: '#bbb', fontFamily: 'system-ui, sans-serif' }}
        className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-1.5 text-[11px]"
      >
        <Link href="/testing/outbound" style={{ color: '#fff' }}>Outbound lab</Link>
        {VARIANTS.map(([href, label]) => (
          <Link key={href} href={href} className="hover:underline">{label}</Link>
        ))}
      </nav>
      {children}
    </>
  );
}
