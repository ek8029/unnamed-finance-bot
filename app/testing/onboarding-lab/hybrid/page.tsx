'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AccountLoop, BookAsk, ExposureReveal, LabBar, ReceiptCard, StepFrame, labStyles as s, useBook } from '../_lab/parts';

type Phase = 'ask' | 'loop' | 'reveal';

/** Variant C: the ask, the loop, one reveal screen, then the real terminal. */
export default function HybridLab() {
  const book = useBook();
  const [phase, setPhase] = useState<Phase>('ask');
  return <>
    <LabBar variant="hybrid" onReset={() => { book.reset(); setPhase('ask'); }} />
    {phase === 'ask' && <StepFrame step={1} total={3} title="Start with what you own." lede="Connect a brokerage, or type in the positions you hold. Either one gives Helm something real to read.">
      <BookAsk accounts={book.accounts} addPlaid={i => { book.addPlaid(i); setPhase('loop'); }} addManual={r => { book.addManual(r); setPhase('loop'); }} />
    </StepFrame>}
    {phase === 'loop' && <StepFrame step={2} total={3} title="Is that all of it?" lede="Helm reads across accounts. Add the others now or later from Accounts.">
      <AccountLoop accounts={book.accounts} addPlaid={book.addPlaid} onContinue={() => setPhase('reveal')} />
    </StepFrame>}
    {phase === 'reveal' && <StepFrame step={3} total={3} title="Here is your book, read." lede="What you actually own through the funds and across the accounts, and the receipt behind the largest position. Everything else Helm does starts from these two.">
      <div className={s.two}><ExposureReveal accounts={book.accounts} /><ReceiptCard accounts={book.accounts} /></div>
      <div className={s.actions}><Link href="/dashboard/portfolio" className="helm-button">Open the terminal <ArrowRight size={16} /></Link><span className={s.src}>The brief on these positions lands at 9:15 ET tomorrow. Hands off to the real /dashboard/portfolio; actions, theses and the brief unlock there over the first day.</span></div>
    </StepFrame>}
  </>;
}
