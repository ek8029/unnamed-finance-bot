import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';
import { LegalFooter } from '@/components/legal-footer';
import { TLHCalculator } from './tlh-calculator';

export const metadata: Metadata = {
  title: 'Tax-Loss Harvesting Calculator — Helm Terminal',
  description:
    'Free tax-loss harvesting calculator. Enter your portfolio details to see estimated annual savings. Accounts for federal + state taxes, short-term vs long-term, and the $3,000 deduction.',
  openGraph: {
    title: 'Tax-Loss Harvesting Calculator — Helm Terminal',
    description: 'See how much tax-loss harvesting could save you. Free calculator for self-directed investors.',
    url: 'https://helmterminal.dev/tools/tlh-calculator',
    siteName: 'Helm Terminal',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tax-Loss Harvesting Calculator — Helm Terminal',
    description: 'See how much tax-loss harvesting could save you. Free, no signup required.',
  },
  alternates: { canonical: 'https://helmterminal.dev/tools/tlh-calculator' },
};

export default function TLHCalculatorPage() {
  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'Tax-Loss Harvesting Calculator',
              description: 'Free calculator to estimate annual tax savings from tax-loss harvesting.',
              url: 'https://helmterminal.dev/tools/tlh-calculator',
              applicationCategory: 'FinanceApplication',
              operatingSystem: 'Web',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
              creator: { '@type': 'Organization', name: 'Helm Terminal', url: 'https://helmterminal.dev' },
            },
            {
              '@context': 'https://schema.org',
              '@type': 'HowTo',
              name: 'How to Calculate Tax-Loss Harvesting Savings',
              description: 'Use the Helm Terminal calculator to estimate how much you could save by harvesting investment losses for tax purposes.',
              tool: { '@type': 'HowToTool', name: 'Helm Terminal Calculator' },
              step: [
                {
                  '@type': 'HowToStep',
                  name: 'Enter your unrealized losses',
                  text: 'Input the total dollar amount of unrealized losses across your taxable brokerage accounts.',
                },
                {
                  '@type': 'HowToStep',
                  name: 'Select your tax bracket',
                  text: 'Choose your federal income tax bracket (22%–37%) and optionally add your state tax rate.',
                },
                {
                  '@type': 'HowToStep',
                  name: 'Specify short-term vs long-term',
                  text: 'Indicate whether losses are short-term (held < 1 year) or long-term, as they offset gains at different rates.',
                },
                {
                  '@type': 'HowToStep',
                  name: 'Review estimated savings',
                  text: 'The calculator shows your estimated annual tax savings, including the $3,000 ordinary income deduction and capital gains offsets.',
                },
              ],
            },
          ]),
        }}
      />

      {/* Nav */}
      <nav className="border-b border-[var(--color-border-base)]">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <HelmMark size={28} />
            <span className="text-[15px] font-bold tracking-tight uppercase">Helm</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/analyze" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">Analyze</Link>
            <Link href="/pricing" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">Pricing</Link>
            <Link href="/signup" className="px-4 py-1.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-xs uppercase tracking-[0.15em] rounded transition-all hover:brightness-110">Sign up</Link>
          </div>
        </div>
      </nav>

      <Suspense>
        <TLHCalculator />
      </Suspense>

      {/* SEO content */}
      <section className="container mx-auto px-6 py-16 max-w-2xl">
        <div className="space-y-8 text-[var(--color-text-secondary)] text-sm leading-relaxed">
          <div>
            <h2 className="text-base font-bold text-[var(--color-text-primary)] mb-2">What is tax-loss harvesting?</h2>
            <p>Tax-loss harvesting is selling investments at a loss to offset capital gains taxes. Realized losses reduce your taxable income — either by offsetting gains or by deducting up to $3,000/year against ordinary income. Unused losses carry forward indefinitely.</p>
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--color-text-primary)] mb-2">How does the wash-sale rule work?</h2>
            <p>The IRS wash-sale rule prevents claiming a loss if you buy a &ldquo;substantially identical&rdquo; security within 30 days before or after the sale. You can replace it with a similar-but-not-identical fund to maintain exposure while harvesting the loss. Helm Pro detects wash-sale violations across your linked accounts automatically.</p>
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--color-text-primary)] mb-2">Who benefits most?</h2>
            <p>TLH is most valuable for investors in higher tax brackets with unrealized losses in taxable brokerage accounts. If you hold index funds, stocks, or ETFs in a taxable account with underwater positions, you likely have opportunities. Typical annual savings: $500&ndash;$3,000+.</p>
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--color-text-primary)] mb-2">How Helm automates this</h2>
            <p>Helm Pro connects to your brokerage via Plaid and continuously scans for tax-loss harvesting opportunities with wash-sale rule awareness. Instead of spreadsheets with 200+ tax lots, Helm surfaces harvestable losses, flags risks, and suggests replacements — for <span className="font-mono text-[var(--color-text-primary)]">$14.99/mo</span>.</p>
          </div>
        </div>
      </section>

      <LegalFooter />
    </main>
  );
}
