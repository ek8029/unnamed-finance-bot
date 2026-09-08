import { SiteNav } from '@/components/site-nav';
import type { Metadata } from 'next';
import Link from 'next/link';
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
      <SiteNav />

      <main id="main-content" className="max-w-3xl mx-auto px-6 py-20">
        {/* Eyebrow */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-px bg-[var(--color-gold)]" />
          <span className="font-mono text-[10px] tracking-[0.2em] text-[var(--color-gold)] uppercase">
            Contact
          </span>
        </div>

        <h1 className="mb-4">
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
