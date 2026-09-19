'use client';

import React from 'react';
import Link from 'next/link';
import type { ThesisRequestError } from '@/lib/thesis-request-error';

export function ThesisErrorNotice({ error }: { error: ThesisRequestError | null }) {
  if (!error) return null;
  return <div className="mt-3 space-y-2 font-mono text-[13px]">
    <p role="alert" className="text-[var(--color-negative-text)]">{error.message}</p>
    {error.upgradeRequired && <Link href="/pricing" className="inline-flex min-h-[44px] items-center text-[var(--color-gold)] underline underline-offset-4">View Pro</Link>}
  </div>;
}
