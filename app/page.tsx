'use client';

import Link from 'next/link';
import { ArrowRight, TrendingUp, Shield, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HelmMark } from '@/components/helm-mark';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-helm-base">
      {/* Navigation */}
      <nav className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <HelmMark size={32} />
            <div>
              <span className="text-xl font-semibold tracking-tight text-helm-platinum">
                Helm
              </span>
              <div className="font-mono text-[8px] tracking-[0.2em] uppercase text-helm-muted">
                Intelligence
              </div>
            </div>
          </div>
          <Link href="/dashboard">
            <Button className="bg-helm-gold hover:bg-helm-gold-hi text-helm-base font-semibold">
              Go to Dashboard
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-6 pt-20 pb-32">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-block px-4 py-2 bg-[rgba(184,145,74,0.08)] border border-[rgba(184,145,74,0.2)] rounded-sm text-sm font-mono font-medium text-helm-gold uppercase tracking-wider">
            Financial Intelligence Platform
          </div>

          <h1 className="text-6xl md:text-7xl font-light tracking-tight text-helm-platinum leading-tight">
            Your AI-Powered
            <br />
            <span className="font-semibold text-helm-gold">
              Personal CFO
            </span>
          </h1>

          <p className="text-xl text-helm-secondary max-w-2xl mx-auto leading-relaxed">
            Unlike traditional finance apps that only track spending, we analyze your entire financial life
            and generate actionable insights. Get institutional-grade financial intelligence built for individuals.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link href="/dashboard">
              <Button
                size="lg"
                className="bg-helm-gold hover:bg-helm-gold-hi text-helm-base font-semibold text-lg px-8"
              >
                Launch Dashboard
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-6 pb-32">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-2">
            {/* Feature 1 */}
            <div className="bg-helm-surface p-8 border border-[rgba(255,255,255,0.08)] hover:border-[rgba(184,145,74,0.3)] transition-colors">
              <div className="w-12 h-12 bg-[rgba(184,145,74,0.08)] border border-[rgba(184,145,74,0.2)] rounded-sm flex items-center justify-center mb-4">
                <Brain className="w-6 h-6 text-helm-gold" />
              </div>
              <h3 className="text-xl font-semibold text-helm-platinum mb-3">AI Intelligence</h3>
              <p className="text-helm-secondary leading-relaxed">
                Continuous monitoring of your financial life with AI-powered insights.
                Get alerts on competitor filings, market opportunities, and tax optimizations.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-helm-surface p-8 border border-[rgba(255,255,255,0.08)] hover:border-[rgba(184,145,74,0.3)] transition-colors">
              <div className="w-12 h-12 bg-[rgba(184,145,74,0.08)] border border-[rgba(184,145,74,0.2)] rounded-sm flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-helm-gold" />
              </div>
              <h3 className="text-xl font-semibold text-helm-platinum mb-3">Portfolio Intelligence</h3>
              <p className="text-helm-secondary leading-relaxed">
                Real-time portfolio monitoring with sector analysis, allocation tracking,
                and market intelligence alerts for your holdings.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-helm-surface p-8 border border-[rgba(255,255,255,0.08)] hover:border-[rgba(184,145,74,0.3)] transition-colors">
              <div className="w-12 h-12 bg-[rgba(184,145,74,0.08)] border border-[rgba(184,145,74,0.2)] rounded-sm flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-helm-gold" />
              </div>
              <h3 className="text-xl font-semibold text-helm-platinum mb-3">Tax Optimization</h3>
              <p className="text-helm-secondary leading-relaxed">
                Intelligent tax planning with capital gains tracking, deduction identification,
                and quarterly payment estimates.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 pb-32">
        <div className="max-w-4xl mx-auto bg-helm-surface border-2 border-helm-gold p-12 text-center">
          <h2 className="text-4xl font-semibold text-helm-platinum mb-4">
            Ready to take control of your financial future?
          </h2>
          <p className="text-helm-secondary text-lg mb-8">
            Join thousands of users who trust Helm for their financial intelligence
          </p>
          <Link href="/dashboard">
            <Button
              size="lg"
              className="bg-helm-gold hover:bg-helm-gold-hi text-helm-base font-semibold text-lg px-8"
            >
              Get Started Now
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-8 border-t border-[rgba(255,255,255,0.08)]">
        <div className="text-center text-helm-muted">
          <p className="font-mono text-xs tracking-wider uppercase">
            © 2026 Helm. Institutional-grade intelligence for individuals.
          </p>
        </div>
      </footer>
    </main>
  );
}
