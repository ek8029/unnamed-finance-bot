'use client';

import { useDemo } from '@/contexts/demo-context';
import { PlaidLinkButton } from '@/components/plaid/plaid-link-button';
import { ShieldCheck } from 'lucide-react';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

/**
 * Contextual demo -> connect prompt. Renders ONLY while the user is viewing
 * demo/sample data (the measured drop-off: dashboard_viewed -> plaid_link_started).
 * Each screen passes copy tied to what the user is looking at, with the
 * read-only trust line right at the connect button.
 */
export function DemoConnectCta({ headline, sub }: { headline: string; sub: string }) {
  const { isDemo, disableDemo } = useDemo();

  if (!isDemo) return null;

  function handleConnected() {
    disableDemo();
    window.location.href = '/dashboard';
  }

  return (
    <div
      className="mb-5 rounded-md border px-5 py-[18px]"
      style={{
        borderColor: 'var(--color-gold-border)',
        background: 'var(--color-gold-surface)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
      }}
    >
      <div className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-[var(--color-gold)]" style={MONO}>
        Sample data
      </div>
      <div className="mb-[6px] text-[17px] font-semibold leading-[1.3] tracking-[-0.01em] text-[var(--color-text-primary)]">
        {headline}
      </div>
      <p className="m-0 mb-4 max-w-[60ch] text-[15px] leading-[1.55] text-[var(--color-text-secondary)]">
        {sub}
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <PlaidLinkButton
          onSuccess={handleConnected}
          className="inline-flex items-center justify-center rounded-[6px] bg-[var(--color-gold)] px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.08em] text-[#0A0A0A] transition-[filter] hover:brightness-110"
        >
          Connect your accounts
        </PlaidLinkButton>
        <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)]" style={MONO}>
          <ShieldCheck size={13} className="text-[var(--color-positive)]" />
          Read-only · Helm can never trade or move money · secured by Plaid
        </span>
      </div>
    </div>
  );
}
