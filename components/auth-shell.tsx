'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { InteractiveGrid } from '@/app/landing-effects';
import { HelmMark } from '@/components/helm-mark';
import { LegalFooter } from '@/components/legal-footer';

interface AuthShellProps {
  subtitle: string;
  children: ReactNode;
}

export function AuthShell({ subtitle, children }: AuthShellProps) {
  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] relative overflow-hidden flex items-center justify-center px-4 py-12">
      {/* Interactive constellation grid */}
      <InteractiveGrid />

      {/* Ambient glow orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-[300px] -left-[200px] w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(230,185,77,0.06)_0%,transparent_70%)]" />
        <div className="absolute -bottom-[200px] -right-[200px] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(230,185,77,0.04)_0%,transparent_70%)]" />
      </div>

      {/* Scanline overlay */}
      <div className="pointer-events-none fixed inset-0 z-50 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.015)_2px,rgba(0,0,0,0.015)_4px)]" />

      <main className="relative z-10 w-full max-w-md">
        {/* Animated logo with sonar pulse */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center mb-8"
        >
          <Link href="/" className="flex flex-col items-center gap-3 mb-3 group">
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
            <div className="text-lg font-bold tracking-tight uppercase text-[var(--color-text-primary)]">
              Helm
            </div>
          </Link>
          <p className="text-[var(--color-text-secondary)] mt-2">{subtitle}</p>
        </motion.div>

        {/* Glassmorphism card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          <div className="absolute -inset-px rounded-xl bg-gradient-to-b from-[var(--color-gold)]/20 via-[var(--color-gold)]/5 to-transparent opacity-60" />
          <div className="relative bg-[rgba(10,10,10,0.7)] backdrop-blur-xl border border-white/[0.08] rounded-xl p-8">
            {children}
          </div>
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
