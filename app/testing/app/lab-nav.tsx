'use client';

// Sidebar nav for the lab shell. Lab pages read the shared account cookie; the
// deep-dive lab tools still take query params, so those links carry the email.
// Real-product links open the actual dashboard (auth required) for surfaces the
// lab doesn't replicate.

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const MONO = { fontFamily: 'var(--font-mono)' } as const;

export function LabNav({ email }: { email: string }) {
  const pathname = usePathname();
  const emailQ = email ? `?email=${encodeURIComponent(email)}` : '';

  const item = (href: string, label: string, note?: string) => {
    const active = pathname === href;
    return (
      <Link
        key={href}
        href={href}
        className={`flex items-baseline gap-2 px-5 py-2.5 text-[13.5px] transition-colors ${
          active ? 'text-[#E6B94D] bg-[rgba(230,185,77,0.06)]' : 'text-[#B8B8B8] hover:text-[#FAFAFA] hover:bg-white/[0.02]'
        }`}
      >
        <span>{label}</span>
        {note && <span className="ml-auto text-[9px] uppercase tracking-[0.12em] text-[#5F5F5F]" style={MONO}>{note}</span>}
      </Link>
    );
  };

  return (
    <nav className="py-3 overflow-y-auto">
      <div className="px-5 pb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#5F5F5F]" style={MONO}>
        New surfaces
      </div>
      {item('/testing/app/presence', 'Overview', 'presence')}
      {item('/testing/app/ledger', 'Brief', 'ledger')}
      {item('/testing/app/live-read', 'Live Read', 'connect')}
      {item('/testing/app/research', 'Research', 'v2')}
      {item('/testing/app/theses', 'Theses', 'v2')}
      {item('/testing/app/phone', 'Phone', 'mock')}

      <div className="px-5 pt-4 pb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#5F5F5F]" style={MONO}>
        Deep dives
      </div>
      {item(`/testing/thesis-v2`, 'Thesis density lab')}
      {item(`/testing/thesis-v2/compare`, 'Engine comparison')}
      <a
        href={`/testing/exposure${emailQ}`}
        className="flex items-baseline gap-2 px-5 py-2.5 text-[13.5px] text-[#B8B8B8] hover:text-[#FAFAFA] hover:bg-white/[0.02] transition-colors"
      >
        True exposure
      </a>

      <div className="px-5 pt-4 pb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#5F5F5F]" style={MONO}>
        The real site, as this account
      </div>
      <a href="/dashboard" className="flex items-baseline gap-2 px-5 py-2.5 text-[13.5px] text-[#B8B8B8] hover:text-[#FAFAFA] hover:bg-white/[0.02] transition-colors">
        <span>Dashboard</span>
        <span className="ml-auto text-[9px] uppercase tracking-[0.12em] text-[#5F5F5F]" style={MONO}>read-only</span>
      </a>
      <a href="/dashboard/chat" className="flex px-5 py-2.5 text-[13.5px] text-[#B8B8B8] hover:text-[#FAFAFA] hover:bg-white/[0.02] transition-colors">
        Research
      </a>
      <a href="/dashboard/theses" className="flex px-5 py-2.5 text-[13.5px] text-[#B8B8B8] hover:text-[#FAFAFA] hover:bg-white/[0.02] transition-colors">
        Theses
      </a>
      <a href="/dashboard/earnings" className="flex items-baseline gap-2 px-5 py-2.5 text-[13.5px] text-[#B8B8B8] hover:text-[#FAFAFA] hover:bg-white/[0.02] transition-colors">
        <span>Earnings</span>
        <span className="ml-auto text-[9px] uppercase tracking-[0.12em] text-[#5F5F5F]" style={MONO}>YoY EPS</span>
      </a>
    </nav>
  );
}
