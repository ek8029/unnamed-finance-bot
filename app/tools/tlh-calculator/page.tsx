import type { Metadata } from 'next';
import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';
import { LegalFooter } from '@/components/legal-footer';
import { TLHCalculator } from './tlh-calculator';

export const metadata: Metadata = {
  title: 'Tax-Loss Harvesting Calculator — Helm Terminal',
  description:
    'Free tax-loss harvesting calculator. Enter your portfolio size, tax bracket, and unrealized losses to see how much you could save annually. No signup required.',
  openGraph: {
    title: 'Tax-Loss Harvesting Calculator — Helm Terminal',
    description:
      'See how much tax-loss harvesting could save you. Free calculator for self-directed investors.',
    url: 'https://helmterminal.dev/tools/tlh-calculator',
    siteName: 'Helm Terminal',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tax-Loss Harvesting Calculator — Helm Terminal',
    description: 'See how much tax-loss harvesting could save you. Free calculator.',
  },
  alternates: {
    canonical: 'https://helmterminal.dev/tools/tlh-calculator',
  },
};

export default function TLHCalculatorPage() {
  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'Tax-Loss Harvesting Calculator',
            description: 'Free calculator to estimate annual tax savings from tax-loss harvesting. Enter portfolio size, tax bracket, and unrealized losses.',
            url: 'https://helmterminal.dev/tools/tlh-calculator',
            applicationCategory: 'FinanceApplication',
            operatingSystem: 'Web',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            creator: { '@type': 'Organization', name: 'Helm Terminal', url: 'https://helmterminal.dev' },
          }),
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
            <Link href="/signup" className="px-4 py-1.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-xs uppercase tracking-[0.15em] rounded transition-all hover:brightness-110">
              Sign up
            </Link>
          </div>
        </div>
      </nav>

      {/* Calculator */}
      <TLHCalculator />

      {/* SEO content below calculator */}
      <section className="container mx-auto px-6 py-16 max-w-3xl">
        <div className="space-y-8 text-[var(--color-text-secondary)] text-sm leading-relaxed">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">What is tax-loss harvesting?</h2>
            <p>
              Tax-loss harvesting (TLH) is the practice of selling investments at a loss to offset capital gains taxes. When you sell a position for less than you paid, the realized loss can reduce your taxable income — either by offsetting gains from other investments or by deducting up to $3,000 per year against ordinary income. Unused losses carry forward indefinitely.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">How does the wash-sale rule work?</h2>
            <p>
              The IRS wash-sale rule prevents you from claiming a tax loss if you buy a &ldquo;substantially identical&rdquo; security within 30 days before or after the sale. This means you can&apos;t sell VXUS at a loss and immediately rebuy it. However, you can replace it with a similar-but-not-identical fund (like VEA) to maintain your market exposure while still harvesting the loss. Helm Pro automatically detects wash-sale violations across your linked accounts.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">Who benefits most from tax-loss harvesting?</h2>
            <p>
              TLH is most valuable for investors in higher tax brackets with significant unrealized losses in taxable brokerage accounts. If you hold index funds, individual stocks, or ETFs in a taxable account and have positions that are currently underwater, you likely have harvesting opportunities. The typical annual savings range from $500 to $3,000+ depending on portfolio size and market conditions.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">How Helm automates tax-loss harvesting</h2>
            <p>
              Helm Pro connects to your brokerage via Plaid and continuously scans for tax-loss harvesting opportunities with wash-sale rule awareness. Instead of maintaining spreadsheets with 200+ tax lots, Helm surfaces harvestable losses, flags wash-sale risks, and suggests replacement securities — all for <span className="font-mono text-[var(--color-text-primary)]">$14.99/mo</span>.
            </p>
          </div>
        </div>
      </section>

      <LegalFooter />
    </main>
  );
}
