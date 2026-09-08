'use client';
import Link from 'next/link';
import { useDemo } from '@/contexts/demo-context';
import { ArrowUpRight } from 'lucide-react';
import posthog from 'posthog-js';

export function DemoConnectCta({ headline, sub }: { headline: string; sub: string }) {
  const { isDemo } = useDemo();
  if (!isDemo) return null;
  return <aside className="helm-demo-strip" aria-label="Sample portfolio">
    <div><span className="helm-label">SAMPLE PORTFOLIO</span><p>{headline}</p><small>{sub}</small></div>
    <div><Link href="/dashboard/accounts?add=1" className="helm-button helm-button-small" onClick={() => posthog.capture('demo_setup_clicked', { method: 'plaid' })}>Make it yours <ArrowUpRight size={14} /></Link><Link href="/dashboard/portfolio/add" className="helm-text-link" onClick={() => posthog.capture('demo_setup_clicked', { method: 'manual' })}>Or enter positions</Link></div>
  </aside>;
}
