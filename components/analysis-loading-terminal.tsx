'use client';

import { usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { HelmOrb, type OrbState } from '@/components/helm-orb';

/** A pending request, without invented milestones or percentage completion. */
export function AnalysisLoadingTerminal({ command, title, description, orb }: {
  command?: string;
  // Retained for existing callers; staged checkmarks require real progress events.
  steps?: { tag: string; text: string }[];
  title?: string;
  description?: string;
  /**
   * The thinking orb beside the heading, for waits where a model is working.
   * Defaults by command: a draft composes, a scan searches, an analysis or
   * comparison solves. Pass 'none' for a wait that only opens something
   * already written, which keeps the plain status spinner.
   */
  orb?: OrbState | 'none';
} = {}) {
  const pathname = usePathname();
  const comparison = pathname.startsWith('/compare/');
  const pair = pathname.match(/\/compare\/([A-Za-z]{1,5})-vs-([A-Za-z]{1,5})$/);
  const ticker = command?.split(' ').at(-1) ?? pathname.match(/\/analyze\/([A-Za-z.]{1,7})$/)?.[1];
  const subject = pair ? `${pair[1].toUpperCase()} / ${pair[2].toUpperCase()}` : ticker?.toUpperCase();
  const heading = title ?? (command?.startsWith('helm draft') ? 'Preparing your thesis.' : command?.startsWith('helm scan') ? 'Reading the evidence.' : comparison ? 'Preparing your comparison.' : 'Preparing your analysis.');
  const state: OrbState | null = orb === 'none' ? null : orb ?? (command?.startsWith('helm draft') ? 'composing' : command?.startsWith('helm scan') ? 'searching' : 'solving');

  return <section className="helm-analysis-loading" role="status" aria-live="polite" aria-busy="true">
    <div className="helm-loading-label"><span>HELM INTELLIGENCE</span>{subject && <span>{subject}</span>}</div>
    {state
      ? <div className="helm-loading-head"><HelmOrb state={state} size={64} /><h2>{heading}</h2></div>
      : <h2>{heading}</h2>}
    <p>{description ?? 'We’re bringing the available data and research into view. Your report will appear here when it’s ready.'}</p>
    {!state && <div className="helm-loading-outline" aria-hidden="true"><div /><div /><div /><div /></div>}
    <div className="helm-loading-status">
      {!state && <Loader2 size={16} className="motion-safe:animate-spin" />}
      <span>Working on your request</span>
    </div>
  </section>;
}
