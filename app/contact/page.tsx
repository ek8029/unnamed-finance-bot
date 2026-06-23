import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { HelmMark } from '@/components/helm-mark';
import { LegalFooter } from '@/components/legal-footer';
import { ContactForm } from './contact-form';

export const metadata: Metadata = {
  title: 'Contact | Helm Terminal',
  description:
    'Get in touch with the Helm Terminal team. Questions, feedback, or partnership inquiries.',
  alternates: {
    canonical: 'https://helmterminal.dev/contact',
  },
  openGraph: {
    title: 'Contact | Helm Terminal',
    description: 'Get in touch with the Helm Terminal team.',
    url: 'https://helmterminal.dev/contact',
  },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
      {/* Nav */}
      <nav className="border-b border-[var(--color-border-subtle)]">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <HelmMark size={24} />
            <span className="font-semibold text-[15px] tracking-[0.12em] group-hover:text-[var(--color-gold)] transition-colors">
              HELM
            </span>
          </Link>
          <Link
            href="/signup"
            className="h-9 px-5 rounded-full bg-[var(--color-gold)] text-[var(--color-text-inverse)] text-[14px] font-semibold flex items-center gap-1.5 hover:brightness-110 transition-all"
          >
            Open terminal
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </nav>

      <main id="main-content" className="max-w-3xl mx-auto px-6 py-20">
        {/* Eyebrow */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-px bg-[var(--color-gold)]" />
          <span className="font-mono text-[10px] tracking-[0.2em] text-[var(--color-gold)] uppercase">
            Contact
          </span>
        </div>

        <h1 className="text-[clamp(28px,4vw,44px)] font-bold leading-[1.1] tracking-tight mb-4">
          Get in touch.
        </h1>
        <p className="text-[15px] text-[var(--color-text-muted)] leading-relaxed mb-12 max-w-md">
          Questions, feedback, partnership inquiries -- we read everything and
          respond within 24 hours.
        </p>

        <ContactForm />

        {/* Direct email fallback */}
        <div className="mt-10 pt-8 border-t border-[var(--color-border-subtle)]">
          <p className="text-[15px] text-[var(--color-text-muted)]">
            Or email us directly at{' '}
            <a
              href="mailto:support@helmterminal.dev"
              className="text-[var(--color-gold)] hover:underline underline-offset-2"
            >
              support@helmterminal.dev
            </a>
          </p>
        </div>
      </main>

      <LegalFooter />
    </div>
  );
}
