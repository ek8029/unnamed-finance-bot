import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';

interface LegalFooterProps {
  /** Use 'minimal' for auth pages, 'full' for landing/dashboard */
  variant?: 'full' | 'minimal';
}

const links = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Security', href: '/security' },
  { label: 'Data Deletion', href: '/data-deletion' },
  { label: 'Contact', href: '/contact' },
];

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const cls =
    'text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors font-mono';
  if (href.startsWith('mailto:')) {
    return <a href={href} className={cls}>{children}</a>;
  }
  return <Link href={href} className={cls}>{children}</Link>;
}

const socials = [
  {
    label: 'X',
    href: 'https://x.com/helmterminal',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/company/helmfintech',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
];

export function LegalFooter({ variant = 'full' }: LegalFooterProps) {
  if (variant === 'minimal') {
    return (
      <footer className="py-4 px-6 text-center space-y-2">
        <div className="flex items-center justify-center gap-4 flex-wrap">
          {links.map((link, i) => (
            <span key={link.href} className="flex items-center gap-4">
              <FooterLink href={link.href}>{link.label}</FooterLink>
              {i < links.length - 1 && (
                <span className="text-[var(--color-text-muted)] text-[10px] opacity-30">&middot;</span>
              )}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-center gap-3">
          {socials.map((s) => (
            <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer" className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors" aria-label={s.label}>
              {s.icon}
            </a>
          ))}
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-white/[0.06]">
      <div className="container mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <HelmMark size={16} />
          <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)] font-mono">
            &copy; {new Date().getFullYear()} Helm Terminal
          </p>
          <div className="flex items-center gap-2.5 ml-3">
            {socials.map((s) => (
              <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer" className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors" aria-label={s.label}>
                {s.icon}
              </a>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-5">
          {links.map((link) => (
            <FooterLink key={link.href} href={link.href}>{link.label}</FooterLink>
          ))}
        </div>
      </div>
    </footer>
  );
}
