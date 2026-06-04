'use client';

import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';

export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setErrorMsg(data.error || 'Something went wrong. Please try again.');
        return;
      }

      setStatus('success');
      setName('');
      setEmail('');
      setMessage('');
    } catch {
      setStatus('error');
      setErrorMsg('Network error. Please try again.');
    }
  };

  if (status === 'success') {
    return (
      <div className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] p-8 text-center">
        <div className="w-10 h-10 rounded-full bg-[var(--color-gold)]/10 flex items-center justify-center mx-auto mb-4">
          <Send className="w-4 h-4 text-[var(--color-gold)]" />
        </div>
        <p className="text-[15px] font-semibold text-[var(--color-text-primary)] mb-1">
          Message sent.
        </p>
        <p className="text-sm text-[var(--color-text-muted)]">
          We&apos;ll get back to you within 24 hours.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name */}
      <div>
        <label
          htmlFor="contact-name"
          className="block font-mono text-[11px] tracking-wider text-[var(--color-text-muted)] uppercase mb-2"
        >
          Name
        </label>
        <input
          id="contact-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full h-11 px-4 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded-lg font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)]/40 transition-colors"
          placeholder="Your name"
        />
      </div>

      {/* Email */}
      <div>
        <label
          htmlFor="contact-email"
          className="block font-mono text-[11px] tracking-wider text-[var(--color-text-muted)] uppercase mb-2"
        >
          Email
        </label>
        <input
          id="contact-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full h-11 px-4 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded-lg font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)]/40 transition-colors"
          placeholder="you@email.com"
        />
      </div>

      {/* Message */}
      <div>
        <label
          htmlFor="contact-message"
          className="block font-mono text-[11px] tracking-wider text-[var(--color-text-muted)] uppercase mb-2"
        >
          Message
        </label>
        <textarea
          id="contact-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={10}
          rows={5}
          className="w-full px-4 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded-lg font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)]/40 transition-colors resize-none"
          placeholder="How can we help?"
        />
      </div>

      {/* Error */}
      {status === 'error' && errorMsg && (
        <p className="text-sm text-[var(--color-negative)]">{errorMsg}</p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={status === 'submitting'}
        className="h-11 px-6 bg-[var(--color-gold)] text-black font-mono text-[13px] font-semibold tracking-wider uppercase rounded-lg hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
      >
        {status === 'submitting' ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Send className="w-3.5 h-3.5" />
            Send message
          </>
        )}
      </button>
    </form>
  );
}
