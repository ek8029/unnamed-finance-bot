'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { AccountLoop, ActionReveal, BookAsk, BriefPromise, ExposureReveal, HoldingsTable, LabBar, LabNote, ReceiptCard, StepFrame, TerminalMock, labStyles as s, useBook } from '../_lab/parts';

type Phase = 'ask' | 'loop' | 'exposure' | 'receipt' | 'action' | 'brief' | 'terminal';
const ORDER: Phase[] = ['ask', 'loop', 'exposure', 'receipt', 'action', 'brief', 'terminal'];

export default function WizardLab() {
  const book = useBook();
  const [phase, setPhase] = useState<Phase>('ask');
  const step = ORDER.indexOf(phase) + 1;
  const next = () => setPhase(ORDER[Math.min(ORDER.length - 1, step)]);
  const reset = () => { book.reset(); setPhase('ask'); };
  const Next = ({ label }: { label: string }) => <div className={s.actions}><button type="button" className="helm-button" onClick={next}>{label} <ArrowRight size={16} /></button></div>;

  return <>
    <LabBar variant="wizard" onReset={reset} />
    {phase === 'ask' && <StepFrame step={1} total={6} title="Start with what you own." lede="Connect a brokerage, or type in the positions you hold. Either one gives Helm something real to read. Everything after this is about your book, not ours.">
      <BookAsk accounts={book.accounts} addPlaid={i => { book.addPlaid(i); setPhase('loop'); }} addManual={r => { book.addManual(r); setPhase('loop'); }} />
    </StepFrame>}
    {phase === 'loop' && <StepFrame step={2} total={6} title="Is that all of it?" lede="Helm reads across accounts. The more of the book it can see, the more the next screens can say.">
      <AccountLoop accounts={book.accounts} addPlaid={book.addPlaid} onContinue={next} />
    </StepFrame>}
    {phase === 'exposure' && <StepFrame step={3} total={6} title="What you actually own." lede="Through the funds and across the accounts. This is the first thing Helm computes on any book, and the first thing a single brokerage screen cannot.">
      <ExposureReveal accounts={book.accounts} title={false} /><Next label="Next: the reason you hold it" />
    </StepFrame>}
    {phase === 'receipt' && <StepFrame step={4} total={6} title="Every claim gets a receipt." lede="Helm reads the filings behind your largest position and quotes them, with the date. When nothing has moved, it says so.">
      <ReceiptCard accounts={book.accounts} /><Next label="Next: what to know today" />
    </StepFrame>}
    {phase === 'action' && <StepFrame step={5} total={6} title="One thing today, not seven." lede="The inbox starts with the single item that matters most for this book. The rest arrives as the book and the filings change.">
      <ActionReveal accounts={book.accounts} /><Next label="Next: tomorrow" />
    </StepFrame>}
    {phase === 'brief' && <StepFrame step={6} total={6} title="Tomorrow, 9:15 ET." lede="The reason to come back arrives without you. The brief covers only what you hold.">
      <BriefPromise accounts={book.accounts} /><Next label="Open the terminal" />
    </StepFrame>}
    {phase === 'terminal' && <TerminalMock accounts={book.accounts} unlocked={new Set(['overview', 'portfolio', 'actions', 'accounts', 'theses'])}>
      <div className={s.grid}><HoldingsTable accounts={book.accounts} /><div style={{ display: 'grid', gap: 20 }}><ExposureReveal accounts={book.accounts} /><ActionReveal accounts={book.accounts} /></div></div>
      <BriefPromise accounts={book.accounts} />
      <LabNote>Variant A. Six screens between the ask and the terminal. Each one is a place to leave; the funnel today loses people at every step between the card and the book, so the bet here is that reveals about <em>their</em> book hold attention where feature tours did not.</LabNote>
    </TerminalMock>}
  </>;
}
