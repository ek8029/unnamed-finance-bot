'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { AccountLoop, ActionReveal, BookAsk, BriefPromise, ExposureReveal, HoldingsTable, LabBar, LabNote, Locked, ReceiptCard, StepFrame, TerminalMock, labStyles as s, useBook } from '../_lab/parts';

type Phase = 'ask' | 'loop' | 'reveal' | 'terminal';

/** Variant C: the ask, one reveal screen, then the terminal with the rest unlocking in place. */
export default function HybridLab() {
  const book = useBook();
  const [phase, setPhase] = useState<Phase>('ask');
  const [briefRead, setBriefRead] = useState(false);
  const unlocked = new Set<string>(['overview', 'portfolio', 'actions', 'accounts']);
  if (briefRead) { unlocked.add('brief'); unlocked.add('theses'); unlocked.add('earnings'); unlocked.add('chat'); }
  if (book.accounts.some(a => a.via === 'plaid')) unlocked.add('taxes');

  return <>
    <LabBar variant="hybrid" onReset={() => { book.reset(); setPhase('ask'); setBriefRead(false); }} />
    {phase === 'ask' && <StepFrame step={1} total={3} title="Start with what you own." lede="Connect a brokerage, or type in the positions you hold. Either one gives Helm something real to read.">
      <BookAsk accounts={book.accounts} addPlaid={i => { book.addPlaid(i); setPhase('loop'); }} addManual={r => { book.addManual(r); setPhase('loop'); }} />
    </StepFrame>}
    {phase === 'loop' && <StepFrame step={2} total={3} title="Is that all of it?" lede="Helm reads across accounts. Add the others now or later from Accounts.">
      <AccountLoop accounts={book.accounts} addPlaid={book.addPlaid} onContinue={() => setPhase('reveal')} />
    </StepFrame>}
    {phase === 'reveal' && <StepFrame step={3} total={3} title="Here is your book, read." lede="What you actually own through the funds and across the accounts, and the receipt behind the largest position. Everything else Helm does starts from these two.">
      <div className={s.two}><ExposureReveal accounts={book.accounts} /><ReceiptCard accounts={book.accounts} /></div>
      <div className={s.actions}><button type="button" className="helm-button" onClick={() => setPhase('terminal')}>Open the terminal <ArrowRight size={16} /></button><span className={s.src}>The brief on these positions lands at 9:15 ET tomorrow.</span></div>
    </StepFrame>}
    {phase === 'terminal' && <TerminalMock accounts={book.accounts} unlocked={unlocked}>
      <div className={s.grid}>
        <div style={{ display: 'grid', gap: 20 }}><HoldingsTable accounts={book.accounts} />{book.accounts.length < 2 && <Locked label="Overlap between accounts" why="appears when a second account is in." />}</div>
        <div style={{ display: 'grid', gap: 20 }}><ExposureReveal accounts={book.accounts} /><ActionReveal accounts={book.accounts} />{!briefRead ? <Locked label="Brief, theses, earnings, the agent" why="unlock after your first brief lands tomorrow." onUnlock={() => setBriefRead(true)} /> : <div className={s.card}><h3>Your first brief arrived</h3><p>Theses, earnings and the agent are in the sidebar now.</p></div>}</div>
      </div>
      <BriefPromise accounts={book.accounts} />
      <LabNote>Variant C. Three screens: the ask, the loop, one reveal. The reveal pairs the two things only Helm computes on day one (look-through exposure and a dated receipt), then the terminal takes over with actions visible and the rest unlocking after the first brief. Fewest steps before the book, one moment of narrative, and the landing page is the one returners open.</LabNote>
    </TerminalMock>}
  </>;
}
