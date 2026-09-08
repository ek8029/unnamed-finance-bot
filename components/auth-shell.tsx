'use client';
import { type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight, Check, Fingerprint } from 'lucide-react';
import { HelmMark } from '@/components/helm-mark';
import { LegalFooter } from '@/components/legal-footer';

export function AuthShell({ subtitle, children }: { subtitle: string; children: ReactNode }) {
  const signup = usePathname() === '/signup';
  return <div className="helm-auth">
    <div className="helm-auth-nav"><Link href="/" className="helm-wordmark"><HelmMark size={29} /><span>HELM<span className="helm-wordmark-descriptor">TERMINAL</span></span></Link><Link href="/analyze" className="helm-text-link">Try a stock analysis <ArrowUpRight size={16} /></Link></div>
    <main id="main-content" className="helm-auth-grid">
      <aside className="helm-auth-story"><p className="helm-kicker">YOUR CAPITAL. YOUR PERSPECTIVE.</p><h2>Make sense<br />of everything<br /><span>you own.</span></h2><p>One view across your portfolio. Evidence behind the changes. A clearer place to start each day.</p><div className="helm-auth-proof">{['Bring your accounts into one picture', 'Keep the reasons you invest under review', 'Return to what changed, with the source'].map(t => <div key={t}><Check size={17} />{t}</div>)}</div><div className="helm-auth-security"><Fingerprint size={21} /><span>Connect read-only with Plaid, or add positions yourself.<br />Helm cannot trade or move money.</span></div></aside>
      <div className="helm-auth-form"><span className="helm-label">{signup ? 'START WITH HELM FREE' : 'YOUR INTELLIGENCE DESK'}</span><h1>{subtitle}</h1>{signup && <p className="helm-auth-subtitle">Create your account, then connect a brokerage or add your first position. No card required.</p>}<div className="helm-auth-fields">{children}</div><LegalFooter variant="minimal" /></div>
    </main>
  </div>;
}
