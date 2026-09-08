'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowUpRight, Check, Fingerprint, Plus, Search, ArrowDownRight } from 'lucide-react';
import posthog from 'posthog-js';
import { SiteNav } from '@/components/site-nav';
import { ProductScreenshot } from '@/components/landing-lab/product-screenshot';
import { HomeResources, HomeFooter } from './home-resources';
import { signupUrlForIntent } from '@/lib/checkout-intent';
import type { TickerTapeItem } from '@/lib/ticker-tape';

type Catch = { ticker: string; company: string; verdict: string; pillarClaim?: string | null; verbatimCite: string; sourceLabel: string; dateISO: string; dateLabel: string };
const views = [
  { name: 'Overview', image: 'overview', title: 'Your whole portfolio. In perspective.', text: 'Every account, holding and movement, brought into one clear view.', href: '/portfolio-intelligence' },
  { name: 'Thesis monitoring', image: 'thesis', title: 'Keep your reasons under review.', text: 'The claims behind your positions, checked against filings and news.', href: '/thesis-monitoring' },
  { name: 'True exposure', image: 'exposure', title: 'Look through the ticker symbols.', text: 'See concentration and overlap across direct holdings and ETFs.', href: '/portfolio-intelligence' },
  { name: 'Daily Brief', image: 'brief', title: 'Start informed. Stay focused.', text: 'A written account of the developments that touch your portfolio.', href: '/brief' },
  { name: 'Tax intelligence', image: 'taxes', title: 'Put the numbers to work.', text: 'Harvestable losses and wash-sale windows across your linked accounts.', href: '/tools/tlh-calculator' },
] as const;

export default function HelmHome({ latestCatch, tickerTape }: { tickerTape: TickerTapeItem[]; latestCatch?: Catch | null }) {
  const [view, setView] = useState(0);
  const [ticker, setTicker] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const active = views[view];
  function analyze(event: React.FormEvent) {
    event.preventDefault();
    const symbol = ticker.trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol)) { setError('Enter a US stock ticker, such as NVDA.'); return; }
    posthog.capture('home_cta_clicked', { cta: 'hero_scan', ticker: symbol });
    startTransition(() => router.push(`/analyze/${encodeURIComponent(symbol)}`));
  }
  return <div className="helm-home">
    <SiteNav />
    <main id="main-content">
      <section className="helm-hero helm-width">
        <div className="helm-hero-copy">
          <p className="helm-kicker">FINANCIAL INTELLIGENCE. PERSONAL TO YOU.</p>
          <h1>Your portfolio.<br /><span>A clearer picture.</span></h1>
          <p className="helm-hero-description">Know what changed, why it matters, and where to look next. Across everything you own.</p>
          <div className="helm-hero-actions"><Link href="/signup" className="helm-button" onClick={() => posthog.capture('home_cta_clicked', { cta: 'hero_signup' })}>Get your portfolio intelligence <ArrowUpRight size={18} /></Link><a className="helm-text-link" href="#terminal">Explore the terminal <ArrowDownRight size={17} /></a></div>
        </div>
        <div className="helm-hero-note"><span className="helm-note-rule" /><p>The market never stops.<br />Your perspective shouldn’t either.</p><span>ONE BOOK. EVERY ANGLE.</span></div>
      </section>

      <section id="terminal" className="helm-terminal-stage helm-width" aria-label="Explore the Helm terminal">
        <div className="helm-terminal-top"><div><span className="helm-terminal-logo">H</span> Your intelligence desk</div><span>PRODUCT PREVIEW · SAMPLE PORTFOLIO</span></div>
        <div className="helm-view-tabs" role="tablist" aria-label="Terminal features">{views.map((item, i) => <button key={item.name} role="tab" type="button" id={`feature-tab-${i}`} tabIndex={view === i ? 0 : -1} aria-selected={view === i} aria-controls="feature-preview" onKeyDown={e => {
          const next = e.key === 'ArrowRight' ? (i + 1) % views.length : e.key === 'ArrowLeft' ? (i + views.length - 1) % views.length : e.key === 'Home' ? 0 : e.key === 'End' ? views.length - 1 : null;
          if (next !== null) { e.preventDefault(); setView(next); document.getElementById(`feature-tab-${next}`)?.focus(); }
        }} onClick={() => { setView(i); posthog.capture('home_product_viewed', { feature: item.name }); }}>{item.name}</button>)}</div>
        <div id="feature-preview" role="tabpanel" tabIndex={0} aria-labelledby={`feature-tab-${view}`} className="helm-product-image">
          <ProductScreenshot key={active.image} name={active.image} priority={view === 0} alt={`Current Helm ${active.name.toLowerCase()} interface showing a sample portfolio`} />
        </div>
        <div className="helm-preview-caption"><div><strong>{active.title}</strong><p>{active.text}</p></div><Link href={active.href} className="helm-text-link">Go deeper <ArrowUpRight size={17} /></Link></div>
      </section>

      <div className="helm-assurance helm-width"><span><Fingerprint size={18} /> Read-only connection through Plaid</span><span><Check size={17} /> Free to start. No card required.</span><span><Plus size={17} /> Prefer manual entry? Start with one position.</span></div>

      <section className="helm-section helm-width helm-value-section">
        <div className="helm-section-heading"><h2>More information isn’t the edge.<br /><span>Knowing what matters is.</span></h2><p>Your holdings are spread across accounts. The story behind them shouldn’t be. Helm connects the changes to the capital you have at stake.</p></div>
        <div className="helm-value-grid">
          <article className="helm-value-primary"><span className="helm-label">THE THESIS BEHIND THE TICKER</span><h3>You had a reason<br />to buy. Is it still true?</h3><p>Helm checks the pillars of your investment thesis against SEC filings, earnings and news. When the evidence changes, you get the source.</p><Link href="/thesis-monitoring" className="helm-text-link">How thesis monitoring works <ArrowUpRight size={17} /></Link><div className="helm-thesis-diagram" role="group" aria-label="Monitoring process"><span>Your investment thesis</span><i /><span>Filings · Earnings · News</span><i /><strong>What changed, with evidence <ArrowRight size={17} /></strong></div></article>
          <article className="helm-value-secondary"><span className="helm-label">YOUR ACTUAL EXPOSURE</span><h3>Different tickers.<br />The same underlying risk.</h3><p>See the shared drivers and overlapping positions hiding across your portfolio, including the stocks inside your ETFs.</p><Link href="/portfolio-intelligence" className="helm-text-link">See the whole picture <ArrowUpRight size={17} /></Link><div className="helm-exposure-visual" aria-hidden="true"><span>DIRECT HOLDINGS</span><span>ETFs & FUNDS</span><strong>One connected view</strong></div></article>
          <article className="helm-value-row"><div><span className="helm-label">TAX INTELLIGENCE</span><h3>Find the opportunity<br />inside the loss.</h3></div><p>Review harvestable losses using your cost basis, with wash-sale screening across accounts. Make the arithmetic part of your year.</p><Link href="/tools/tlh-calculator" className="helm-text-link">Try the calculator <ArrowUpRight size={17} /></Link></article>
        </div>
      </section>

      <section className="helm-evidence-section">
        <div className="helm-width helm-evidence-grid"><div><p className="helm-kicker">A POINT OF VIEW. A PAPER TRAIL.</p><h2>Don’t take<br />our word for it.<br /><span>Read the source.</span></h2><p>Every meaningful thesis update comes with evidence you can inspect. See what the agent found and make your own judgment.</p><Link href="/masthead" className="helm-text-link" onClick={() => posthog.capture('home_cta_clicked', { cta: 'catch_strip' })}>Read The Masthead <ArrowUpRight size={18} /></Link></div><article className="helm-evidence-paper"><div className="helm-paper-header"><span>{latestCatch ? latestCatch.ticker : 'THE EVIDENCE STANDARD'}</span><span>{latestCatch ? latestCatch.sourceLabel : 'PRIMARY SOURCES'}</span></div>{latestCatch ? <><p className="helm-paper-context">{latestCatch.company}{latestCatch.pillarClaim ? ` · ${latestCatch.pillarClaim}` : ''}</p><blockquote>“{latestCatch.verbatimCite}”</blockquote><div className="helm-paper-footer"><time dateTime={latestCatch.dateISO}>{latestCatch.dateLabel}</time><Link href="/masthead">Inspect the record <ArrowUpRight size={16} /></Link></div></> : <><h3>The claim.<br />The change.<br />The dated source.</h3><p>A thesis should be testable. Helm keeps the evidence attached so you can trace an update back to the document it came from.</p><Link href="/how-helm-detects-thesis-drift" className="helm-text-link">Explore the methodology <ArrowUpRight size={17} /></Link></>}</article></div>
      </section>

      <section className="helm-section helm-width helm-first-read"><div className="helm-section-heading"><h2>Start with a stock you know.<br /><span>See what you’ve been missing.</span></h2><p>Try a free AI stock analysis. No account or brokerage connection needed.</p></div><form onSubmit={analyze} className="helm-analysis-form"><Search size={21} aria-hidden="true" /><label className="sr-only" htmlFor="home-ticker">Stock ticker symbol</label><input id="home-ticker" value={ticker} onChange={e => { setTicker(e.target.value.toUpperCase()); setError(''); }} placeholder="Enter a ticker, e.g. NVDA" autoCapitalize="characters" autoComplete="off" maxLength={10} aria-invalid={!!error} aria-describedby={error ? 'ticker-error' : undefined} /><button className="helm-button" type="submit" disabled={pending} aria-busy={pending}>{pending ? 'Opening analysis' : 'Analyze stock'} <ArrowRight size={17} /></button></form>{error && <p className="helm-form-error" id="ticker-error" role="alert">{error}</p>}<div className="helm-stock-shortcuts"><span>Start here</span>{['NVDA', 'AAPL', 'MSFT', 'TSLA', 'AMZN'].map(t => <Link href={`/analyze/${t}`} key={t}>{t}<ArrowUpRight size={12} /></Link>)}</div></section>

      <section className="helm-section helm-width helm-routine"><div className="helm-routine-copy"><div><span className="helm-label">YOUR NEXT VISIT STARTS HERE</span><h2>A reason to check in.<br /><span>Not check everything.</span></h2></div><div><p>A written brief. The positions worth a closer look. The evidence that changed since your last visit. Your portfolio, already put into context.</p><Link href="/brief" className="helm-text-link">Read today’s brief <ArrowUpRight size={18} /></Link></div></div><div className="helm-routine-image"><ProductScreenshot name="brief" alt="Helm Daily Brief screen with illustrative portfolio commentary" /></div></section>

      <section id="pricing" className="helm-section helm-width"><div className="helm-section-heading"><h2>A clear view.<br /><span>A straightforward price.</span></h2><p>Start free. Expand your coverage when you’re ready. No percentage of your assets.</p></div><div className="helm-pricing-grid"><article className="helm-price-free"><span className="helm-label">HELM FREE</span><h3>Get your bearings.</h3><div className="helm-price">$0<span>/ forever</span></div><p>Your portfolio in one place, with intelligence you can use from day one.</p><ul>{['Brokerage sync and manual holdings', 'AI stock analysis and daily brief', 'One monitored thesis with its history'].map(t => <li key={t}><Check size={16} />{t}</li>)}</ul><Link href="/signup" className="helm-button helm-button-outline">Open your free terminal <ArrowUpRight size={17} /></Link><small>No card required.</small></article><article className="helm-price-pro"><div className="helm-price-pro-top"><span className="helm-label">HELM PRO</span><span>FULL PORTFOLIO COVERAGE</span></div><h3>Keep the whole picture.</h3><div className="helm-price">$20<span>/ month</span></div><p>Ongoing coverage of every position, with the tools to understand the connections.</p><ul>{['Everything in Free', 'Thesis monitoring across your positions', 'The agent, Thesis Builder and factor lens', 'Tax intelligence and earnings exposure'].map(t => <li key={t}><Check size={16} />{t}</li>)}</ul><Link href={signupUrlForIntent('pro')} className="helm-button">Start Pro <ArrowUpRight size={17} /></Link><small>$20/month, or $149/year. Eligible accounts get a 14-day trial, card required. Cancel before the trial ends to pay nothing.<br /><Link href="/pricing">Compare plans</Link></small></article></div></section>

      <section className="helm-width helm-security-band"><Fingerprint size={36} strokeWidth={1.2} /><div><h3>Your money stays yours.</h3><p>Read-only access through Plaid. Helm cannot place trades or move money. You can also add positions manually.</p></div><Link href="/security" className="helm-text-link">Security at Helm <ArrowUpRight size={17} /></Link></section>
      <section className="helm-final helm-width"><p className="helm-kicker">STEER. DON’T DRIFT.</p><h2>Take the Helm.</h2><Link href="/signup" className="helm-button" onClick={() => posthog.capture('home_cta_clicked', { cta: 'outro_primary_signup' })}>Build your picture <ArrowUpRight size={18} /></Link><p>Connect a brokerage or add your first position.</p></section>
      <div className="helm-home-resources"><HomeResources /></div>
    </main>
    <HomeFooter />
  </div>;
}
