'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { InteractiveGrid } from '@/app/landing-effects';
import { HelmMark } from '@/components/helm-mark';
import { LegalFooter } from '@/components/legal-footer';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

interface AuthShellProps {
  subtitle: string;
  children: ReactNode;
}

export function AuthShell({ subtitle, children }: AuthShellProps) {
  return (
    <div className="min-h-screen bg-[var(--color-bg-inset,#060606)] relative overflow-hidden flex items-center justify-center px-4 py-12">
      {/* Interactive constellation grid */}
      <InteractiveGrid />

      {/* Ambient glow orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-[300px] -left-[200px] w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(230,185,77,0.05)_0%,transparent_70%)]" />
        <div className="absolute -bottom-[200px] -right-[200px] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(230,185,77,0.035)_0%,transparent_70%)]" />
      </div>

      {/* Scanline overlay */}
      <div className="pointer-events-none fixed inset-0 z-50 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.015)_2px,rgba(0,0,0,0.015)_4px)]" />

      <main className="relative z-10 w-full max-w-md">
        {/* Brand mark with sonar pulse */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center mb-9"
        >
          <Link href="/" className="flex flex-col items-center gap-4 group">
            <div className="relative flex items-center justify-center w-[44px] h-[44px]">
              <motion.div
                className="absolute inset-0 rounded-full border border-[var(--color-gold)]/20"
                animate={{ scale: [1, 2.5], opacity: [0.2, 0] }}
                transition={{ duration: 3, repeat: Infinity, repeatDelay: 0.5, ease: 'easeOut' }}
              />
              <motion.div
                className="absolute inset-0 rounded-full border border-[var(--color-gold)]/10"
                animate={{ scale: [1, 2.5], opacity: [0.15, 0] }}
                transition={{ duration: 3, delay: 1.5, repeat: Infinity, repeatDelay: 0.5, ease: 'easeOut' }}
              />
              <HelmMark size={44} />
            </div>
            <div
              className="text-[22px] font-bold uppercase tracking-[0.42em] text-[var(--color-gold)] pl-[0.42em]"
              style={MONO}
            >
              Helm
            </div>
          </Link>
          <div
            className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#6A6A6A] mt-3"
            style={MONO}
          >
            Financial Intelligence Terminal
          </div>
          <p className="text-[15px] text-[var(--color-text-secondary)] mt-4 text-center">{subtitle}</p>
        </motion.div>

        {/* Sovereign card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-xl border border-white/[0.07] bg-[var(--color-bg-surface,#131313)] p-8 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]"
          style={{ borderTop: '2px solid rgba(230,185,77,0.30)' }}
        >
          {children}
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <LegalFooter variant="minimal" />
        </motion.div>
      </main>
    </div>
  );
}
