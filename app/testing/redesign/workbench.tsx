'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardShell from '@/app/dashboard/dashboard-shell';
import Overview from '@/app/dashboard/page';
import Portfolio from '@/app/dashboard/portfolio/page';
import Brief from '@/app/dashboard/brief/page';
import Taxes from '@/app/dashboard/taxes/page';
import { ActionsClient } from '@/app/dashboard/actions/actions-client';
import Earnings from '@/app/dashboard/earnings/page';
import Accounts from '@/app/dashboard/accounts/page';
import Analyze from '@/app/dashboard/analyze/page';
import Transactions from '@/app/dashboard/transactions/page';
import Settings from '@/app/dashboard/settings/page';
import { ManualPortfolioForm } from '@/components/manual-portfolio-form';
import { usePreview } from '@/lib/preview-context';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';

const screens = [
  ['Overview', '/dashboard'], ['Portfolio', '/dashboard/portfolio'], ['Analyze', '/dashboard/analyze'], ['Daily Brief', '/dashboard/brief'],
  ['Taxes', '/dashboard/taxes'], ['Earnings', '/dashboard/earnings'], ['Actions', '/dashboard/actions'],
  ['Accounts', '/dashboard/accounts'], ['Activity', '/dashboard/transactions'], ['Manual entry', '/dashboard/portfolio/add'],
  ['Settings', '/dashboard/settings'], ['First-time setup', '/setup'],
] as const;

export default function DesignWorkbench() {
  const [ready, setReady] = useState(false);
  const [path, setPath] = useState('/dashboard');
  const [notice, setNotice] = useState('');
  const { setDataState } = usePreview();
  useEffect(() => {
    const previous = sessionStorage.getItem('helm_demo_mode');
    const previousState = localStorage.getItem('helm-preview-datastate');
    sessionStorage.setItem('helm_demo_mode', '1');
    setDataState('demo');
    setReady(true);
    return () => {
      if (previous === null) sessionStorage.removeItem('helm_demo_mode'); else sessionStorage.setItem('helm_demo_mode', previous);
      setDataState(previousState === 'demo' || previousState === 'empty' ? previousState : 'connected');
      if (previousState === null) localStorage.removeItem('helm-preview-datastate');
    };
  }, []);
  if (!ready) return <p className="p-8">Preparing sample portfolio…</p>;
  const page = path === '/dashboard' ? <Overview /> : path === '/dashboard/portfolio' ? <Portfolio /> : path === '/dashboard/brief' ? <Brief /> : path === '/dashboard/taxes' ? <Taxes /> : path === '/dashboard/earnings' ? <Earnings /> : path === '/dashboard/actions' ? <ActionsClient initialActions={[]} isPro /> : path === '/dashboard/accounts' ? <Accounts /> : path === '/dashboard/analyze' ? <Analyze /> : path === '/dashboard/transactions' ? <Transactions /> : path === '/dashboard/settings' ? <Settings /> : <div className="p-8 max-w-4xl mx-auto"><header className="helm-overview-heading"><div><span className="helm-label">BUILD YOUR PICTURE</span><h1>Start with what you own.</h1><p>Enter a ticker and shares. This preview does not save positions.</p></div></header><ManualPortfolioForm readOnly /></div>;
  return <div className="helm-platform helm-terminal helm-workbench">
    {path === '/setup' && <OnboardingFlow preview onSettled={() => setPath('/dashboard')} />}
    <div className="helm-workbench-bar"><Link href="/">Home page ↗</Link><label htmlFor="preview-screen">Local preview · sample portfolio</label><select id="preview-screen" value={path} onChange={e => { setPath(e.target.value); setNotice(''); }}>{screens.map(([label, url]) => <option value={url} key={url}>{label}</option>)}</select><Link href="/signup">Sign-up ↗</Link><Link href="/pricing">Pricing ↗</Link></div>
    {notice && <div className="helm-workbench-notice" role="status">{notice}<button onClick={() => setNotice('')} type="button">Dismiss</button></div>}
    <div onChangeCapture={e => {
      if ((e.target as HTMLElement).closest('.helm-settings-content')) { e.stopPropagation(); setNotice('Settings changes are disabled in this local preview.'); }
    }} onSubmitCapture={e => { e.preventDefault(); e.stopPropagation(); setNotice('Saving is disabled in this sample preview.'); }} onClickCapture={e => {
      const target = e.target as HTMLElement;
      if (target.closest('.helm-settings-content') && target.closest('button,input,select,textarea')) {
        e.preventDefault(); e.stopPropagation(); setNotice('Settings changes are disabled in this local preview.'); return;
      }
      const anchor = target.closest('a');
      if (anchor?.getAttribute('href')?.startsWith('/dashboard')) {
        e.preventDefault(); e.stopPropagation();
        const href = anchor.getAttribute('href')!.split(/[?#]/)[0];
        if (href === '/dashboard/settings') window.history.replaceState(null, '', window.location.pathname + (anchor.hash || ''));
        if (screens.some(([, url]) => url === href)) { setPath(href); setNotice(''); }
        else setNotice('This view uses an authenticated account. Open the normal terminal to review it with your own data.');
      }
      const button = target.closest('button');
      const text = [button?.textContent, button?.getAttribute('aria-label'), button?.getAttribute('title')].filter(Boolean).join(' ');
      if (button && /connect|sync|delete|remove|save|trial|upgrade|sign out|generate|create|send|upload|analy[sz]e|dismiss|sweep|run again|harvest|useful|archive|snooze/i.test(text)) {
        e.preventDefault(); e.stopPropagation(); setNotice('Account changes are disabled in this sample preview.');
      }
    }}><DashboardShell previewPath={path}>{page}</DashboardShell></div>
  </div>;
}
