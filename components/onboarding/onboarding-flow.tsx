'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Fingerprint, Layers, PenLine, X } from 'lucide-react';
import posthog from 'posthog-js';
import { HelmMark } from '@/components/helm-mark';
import { useDemo } from '@/contexts/demo-context';
import { ManualPortfolioForm } from '@/components/manual-portfolio-form';
import { PlaidLinkButton } from '@/components/plaid/plaid-link-button';
import { FirstRead } from '@/components/dashboard/first-read';

const ONBOARDING_KEY = 'helm_onboarding_dismissed';

export function OnboardingFlow({ onSettled, preview = false }: { onSettled?: () => void; preview?: boolean }) {
  const { enableDemo } = useDemo();
  const [show, setShow] = useState(false);
  const [phase, setPhase] = useState<'choose' | 'manual' | 'reading'>('choose');
  const [itemId, setItemId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const settled = useRef(onSettled);
  settled.current = onSettled;

  useEffect(() => {
    let cancelled = false;
    if (preview) { setShow(true); return; }
    if (localStorage.getItem(ONBOARDING_KEY) === '1' || sessionStorage.getItem(ONBOARDING_KEY) === '1') { settled.current?.(); return; }
    fetch('/api/onboarding/status', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(data => {
      if (cancelled) return;
      if (!data) { settled.current?.(); return; }
      if (data.hasSavedWork) { localStorage.setItem(ONBOARDING_KEY, '1'); settled.current?.(); }
      else { setShow(true); posthog.capture('onboarding_setup_viewed', { design: 'portfolio_first' }); }
    }).catch(() => { if (!cancelled) settled.current?.(); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (show && dialog.current && !dialog.current.open) dialog.current.showModal();
    else if (!show) dialog.current?.close();
  }, [show]);

  function finish(destination: string) {
    if (preview) { setShow(false); settled.current?.(); return; }
    localStorage.setItem(ONBOARDING_KEY, '1');
    // Keep pending checkout in sessionStorage. The destination mount consumes it
    // after seeing setup is complete, so the hard navigation cannot lose it.
    window.location.assign(destination);
  }
  function explore() {
    if (preview) { setShow(false); settled.current?.(); return; }
    sessionStorage.setItem(ONBOARDING_KEY, '1');
    enableDemo();
    posthog.capture('demo_explored', { source: 'onboarding' });
    setShow(false);
    settled.current?.();
  }

  function reopen() { if (dialog.current && !dialog.current.open) dialog.current.showModal(); }
  function connectionError(message: string) { setError(message); reopen(); }
  if (!show) return null;

  return <dialog ref={dialog} className="helm-setup-dialog" aria-labelledby={phase === 'reading' ? undefined : 'setup-heading'} aria-label={phase === 'reading' ? 'Your first portfolio read' : undefined} onCancel={(e) => { e.preventDefault(); explore(); }}>
    <div className="helm-setup-top"><div className="helm-wordmark"><HelmMark size={25} />HELM</div><span>YOUR FIRST POSITION STARTS THE PICTURE</span><button onClick={explore} type="button" aria-label="Explore demo instead"><X size={20} /></button></div>
    {phase === 'reading' ? <div className="helm-setup-body" onClickCapture={e => { const a = (e.target as HTMLElement).closest('a'); const href = a?.getAttribute('href'); if (href?.startsWith('/dashboard')) { e.preventDefault(); e.stopPropagation(); finish(href); } }}><FirstRead itemId={itemId} onDone={() => finish('/dashboard')} /></div> : phase === 'manual' ? <div className="helm-setup-body"><button className="helm-text-link" type="button" onClick={() => setPhase('choose')}><ArrowLeft size={16} /> Back to setup options</button><h1 id="setup-heading">One position is enough to start.</h1><p>Enter a ticker and your shares. Add cost basis when you have it to make the tax view more useful.</p><ManualPortfolioForm compact readOnly={preview} onComplete={() => { posthog.capture('onboarding_manual_completed'); finish('/dashboard/portfolio'); }} /></div> : <div className="helm-setup-body"><p className="helm-kicker">MAKE IT YOUR PORTFOLIO</p><h1 id="setup-heading">A clearer picture<br />starts with what you own.</h1><p>Choose the way that works for you. You can add more accounts and positions at any time.</p><div className="helm-setup-options"><article><Layers size={27} strokeWidth={1.4} /><h2>Connect your brokerage</h2><p>Bring in your holdings, balances and available cost basis. Keep them synced automatically.</p>{preview ? <button type="button" className="helm-button" onClick={() => setError('This local preview does not connect a brokerage.')}>Connect with Plaid <ArrowUpRight size={16} /></button> : <PlaidLinkButton className="helm-button" onOpen={() => { dialog.current?.close(); posthog.capture('onboarding_connection_started'); }} onExit={reopen} onSuccess={(id) => { setItemId(id ?? null); setPhase('reading'); reopen(); }} onError={connectionError} onLinkError={(_code, message) => connectionError(message)}>Connect with Plaid <ArrowUpRight size={16} /></PlaidLinkButton>}<small>Read-only. Helm cannot trade or move money.</small></article><article><PenLine size={27} strokeWidth={1.4} /><h2>Add a position yourself</h2><p>Start with a ticker and share count. Keep your brokerage unlinked and build at your own pace.</p><button className="helm-button helm-button-outline" type="button" onClick={() => { setPhase('manual'); setError(''); posthog.capture('onboarding_manual_started'); }}>Enter a position <ArrowUpRight size={16} /></button><small>No brokerage login needed.</small></article></div>{error && <p className="helm-form-error" role="alert">{error} You can also enter your positions manually.</p>}<div className="helm-setup-payoff"><Fingerprint size={20} /><p>Your holdings give Helm the context to show your exposure, connect relevant developments, and help you build your first investment thesis.</p></div></div>}
    {phase !== 'reading' && <div className="helm-setup-footer"><span>Not ready to add anything?</span><button onClick={explore} className="helm-text-link" type="button">Explore a sample portfolio <ArrowUpRight size={15} /></button></div>}
  </dialog>;
}
