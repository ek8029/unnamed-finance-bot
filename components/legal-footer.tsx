import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';

interface LegalFooterProps {
  /** Use 'minimal' for auth pages, 'full' for landing/dashboard */
  variant?: 'full' | 'minimal';
}

export function LegalFooter({ variant = 'full' }: LegalFooterProps) {
  const links = [
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
    { label: 'Security', href: '/security' },
    { label: 'Data Deletion', href: '/data-deletion' },
  ];

  if (variant === 'minimal') {
    return (
      <footer className="py-4 px-6 text-center">
        <div className="flex items-center justify-center gap-4 flex-wrap">
          {links.map((link, i) => (
            <span key={link.href} className="flex items-center gap-4">
              <Link
                href={link.href}
                className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
              >
                {link.label}
              </Link>
              {i < links.length - 1 && (
                <span className="text-[var(--color-border-base)] text-[10px]">&middot;</span>
              )}
            </span>
          ))}
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-[var(--color-border-base)]">
      <div className="container mx-auto px-6 py-5 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <HelmMark size={16} />
          <p className="type-eyebrow text-[var(--color-text-muted)]">
            (c) {new Date().getFullYear()} Helm. Financial intelligence for individuals.
          </p>
        </div>
        <div className="flex items-center gap-5">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="type-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <a
            href="mailto:support@helmterminal.dev"
            className="type-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
          >
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
}
