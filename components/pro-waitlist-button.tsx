'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'helm-pro-waitlist';

interface ProWaitlistButtonProps {
  email?: string;
  source?: string;
  variant?: 'gold' | 'outline';
  className?: string;
}

export function ProWaitlistButton({ email: prefilledEmail, source = 'pricing', variant = 'gold', className }: ProWaitlistButtonProps) {
  const [email, setEmail] = useState(prefilledEmail || '');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'already' | 'error'>('idle');
  const [showInput, setShowInput] = useState(!prefilledEmail);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) {
      setStatus('already');
    }
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');

    try {
      const res = await fetch('/api/pro-waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), source }),
      });
      const data = await res.json();
      if (data.already_registered) {
        localStorage.setItem(STORAGE_KEY, 'joined');
        setStatus('already');
      } else if (data.success) {
        localStorage.setItem(STORAGE_KEY, 'joined');
        setStatus('success');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  if (status === 'success' || status === 'already') {
    return (
      <div className={cn('text-center', className)}>
        <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)]">
          <span className="text-[15px] font-medium text-[var(--color-gold)]">
            {status === 'already' ? "You're already on the list" : "You're on the Pro waitlist"}
          </span>
        </div>
      </div>
    );
  }

  if (prefilledEmail) {
    return (
      <button
        onClick={() => handleSubmit()}
        disabled={status === 'loading'}
        className={cn(
          'w-full text-center text-[15px] font-medium py-2.5 rounded transition-colors disabled:opacity-50',
          variant === 'gold'
            ? 'bg-[var(--color-gold)] text-[var(--color-bg-base)] hover:bg-[var(--color-gold-hi)]'
            : 'border border-[var(--color-gold-border)] text-[var(--color-gold)] hover:bg-[var(--color-gold-surface)]',
          className,
        )}
      >
        {status === 'loading' ? 'Joining...' : 'Join Pro Waitlist'}
      </button>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      {showInput ? (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className="flex-1 px-3 py-2.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded text-[15px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)] focus:ring-2 focus:ring-[var(--color-gold)]/30 transition-colors"
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className="px-5 py-2.5 rounded bg-[var(--color-gold)] text-[var(--color-bg-base)] text-[15px] font-medium hover:bg-[var(--color-gold-hi)] transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {status === 'loading' ? 'Joining...' : 'Join'}
          </button>
        </form>
      ) : (
        <button
          onClick={() => setShowInput(true)}
          className={cn(
            'w-full text-center text-[15px] font-medium py-2.5 rounded transition-colors',
            variant === 'gold'
              ? 'bg-[var(--color-gold)] text-[var(--color-bg-base)] hover:bg-[var(--color-gold-hi)]'
              : 'border border-[var(--color-gold-border)] text-[var(--color-gold)] hover:bg-[var(--color-gold-surface)]',
          )}
        >
          Join Waitlist for Pro
        </button>
      )}
      {status === 'error' && (
        <p className="text-[var(--color-negative)] text-[13px] mt-2">Something went wrong. Try again.</p>
      )}
    </div>
  );
}
