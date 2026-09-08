'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { HelmMark } from '@/components/helm-mark';
import posthog from 'posthog-js';

const links = [['Analyze', '/analyze'], ['The Masthead', '/masthead'], ['Compare', '/compare'], ['iPhone', '/app'], ['Pricing', '/pricing']];

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return <header className="helm-site-header">
    <nav className="helm-nav" aria-label="Main navigation">
      <Link href="/" className="helm-wordmark" aria-label="Helm home"><HelmMark size={28} /><span>HELM<span className="helm-wordmark-descriptor">TERMINAL</span></span></Link>
      <div className="helm-nav-links">{links.map(([label, href]) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>{label}</Link>)}</div>
      <div className="helm-nav-actions"><Link href="/login" className="helm-signin">Sign in</Link><Link href="/signup" className="helm-button helm-button-small" onClick={() => posthog.capture('home_cta_clicked', { cta: 'nav_signup' })}>Open terminal <ArrowUpRight size={15} /></Link><button className="helm-menu-toggle" type="button" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="helm-mobile-menu" onClick={() => setOpen(!open)}>{open ? <X size={22} /> : <Menu size={22} />}</button></div>
    </nav>
    {open && <div className="helm-mobile-menu" id="helm-mobile-menu">{links.concat([['Sign in', '/login']]).map(([label, href]) => <Link key={href} href={href} onClick={() => setOpen(false)}>{label}<ArrowUpRight size={16} /></Link>)}</div>}
  </header>;
}
