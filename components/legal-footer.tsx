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
  { label: 'Contact', href: 'mailto:support@helmterminal.dev' },
];

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const cls =
    'text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors font-mono';
  if (href.startsWith('mailto:')) {
    return <a href={href} className={cls}>{children}</a>;
  }
  return <Link href={href} className={cls}>{children}</Link>;
}

export function LegalFooter({ variant = 'full' }: LegalFooterProps) {
  if (variant === 'minimal') {
    return (
      <footer className="py-4 px-6 text-center">
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
