'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRight, Copy, Check, Users,
} from 'lucide-react';

interface WaitlistResult {
  position?: number;
  referral_code?: string;
  referral_count?: number;
  already_registered?: boolean;
  referred_by?: string | null;
  error?: string;
}

export function WaitlistForm({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const defaultRef = searchParams.get('ref') || '';

  const [email, setEmail] = useState('');
  const [referralInput, setReferralInput] = useState(defaultRef);
  const [showReferral, setShowReferral] = useState(!!defaultRef);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<WaitlistResult>({});
  const [copied, setCopied] = useState(false);

  const referralLink = result.referral_code
    ? `https://helmterminal.dev?ref=${result.referral_code}`
    : '';

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareOnTwitter = () => {
    const text = `I just joined the Helm Terminal waitlist — institutional-grade financial intelligence for individuals. Join me:`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(referralLink)}`,
      '_blank'
    );
  };

  const shareOnLinkedIn = () => {
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`,
      '_blank'
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');

    try {
      const body: { email: string; referred_by?: string } = { email };
      if (referralInput.trim()) {
        body.referred_by = referralInput.trim();
      }

      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error && res.status >= 400) {
        setStatus('error');
        setResult({ error: data.error });
        return;
      }
      setStatus('success');
      setResult(data);
    } catch {
      setStatus('error');
      setResult({ error: 'Something went wrong. Try again.' });
    }
  };

  if (status === 'success') {
    return (
      <div className="space-y-4 text-left">
        <div className="flex items-center gap-2 text-[var(--color-positive)]">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-positive)]" />
          <span className="type-label">
            {result.already_registered ? 'Welcome back \u2014 you\u2019re already on the list' : 'You\u2019re on the list'}
          </span>
        </div>

        <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded p-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="type-eyebrow text-[var(--color-text-muted)]">Position</span>
            <span className="type-data text-lg">#{result.position}</span>
          </div>
          <div className="border-t border-[var(--color-border-subtle)]" />
          <div className="flex items-baseline justify-between">
            <span className="type-eyebrow text-[var(--color-text-muted)]">Your Referral Code</span>
            <span className="type-mono text-[var(--color-gold)]">{result.referral_code}</span>
          </div>
          {(result.referral_count ?? 0) > 0 && (
            <>
              <div className="border-t border-[var(--color-border-subtle)]" />
              <div className="flex items-baseline justify-between">
                <span className="type-eyebrow text-[var(--color-text-muted)]">Referrals</span>
                <div className="flex items-center gap-1.5">
                  <Users className="w-3 h-3 text-[var(--color-text-secondary)]" />
                  <span className="type-data">{result.referral_count}</span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="space-y-2">
          <div className="type-eyebrow text-[var(--color-text-muted)]">Share your link to move up</div>
          <div className="flex gap-2">
            <div className="flex-1 px-3 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded text-xs type-mono text-[var(--color-text-secondary)] truncate flex items-center">
              {referralLink}
            </div>
            <button
              onClick={() => copyToClipboard(referralLink)}
              className="px-3 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded hover:border-[var(--color-border-strong)] transition-colors flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] whitespace-nowrap"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[var(--color-positive)]" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={shareOnTwitter}
            className="flex-1 px-3 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded hover:border-[var(--color-border-strong)] transition-colors text-xs text-[var(--color-text-secondary)] flex items-center justify-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Share on X
          </button>
          <button
            onClick={shareOnLinkedIn}
            className="flex-1 px-3 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded hover:border-[var(--color-border-strong)] transition-colors text-xs text-[var(--color-text-secondary)] flex items-center justify-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            Share on LinkedIn
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id={id}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            className="flex-1 px-4 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)] transition-colors text-sm"
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className="px-6 py-3 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] font-semibold rounded transition-colors text-sm whitespace-nowrap disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {status === 'loading' ? 'Joining...' : 'Join the waitlist'}
            {status !== 'loading' && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>

        {!showReferral ? (
          <button
            type="button"
            onClick={() => setShowReferral(true)}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
          >
            Have a referral code?
          </button>
        ) : (
          <input
            type="text"
            value={referralInput}
            onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="Referral code (optional)"
            className="w-full sm:w-48 px-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)] transition-colors text-sm type-mono tracking-wider"
          />
        )}
      </form>
      {status === 'error' && (
        <p className="text-red-400 text-xs mt-2">{result.error}</p>
      )}
    </div>
  );
}

/** Static fallback shown during SSR before hydration */
export function WaitlistFormFallback() {
  return (
    <div>
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            disabled
            placeholder="you@example.com"
            className="flex-1 px-4 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] text-sm"
          />
          <button
            disabled
            className="px-6 py-3 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-semibold rounded text-sm whitespace-nowrap flex items-center justify-center gap-2"
          >
            Join the waitlist
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
