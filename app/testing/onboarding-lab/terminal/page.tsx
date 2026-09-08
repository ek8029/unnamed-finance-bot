'use client';

import { useState } from 'react';
import { ActionReveal, BookAsk, BriefPromise, ExposureReveal, HoldingsTable, LabBar, LabNote, Locked, ReceiptCard, TerminalMock, labStyles as s, useBook } from '../_lab/parts';

/** Variant B: no wizard. The terminal is the onboarding; sections earn their place as the book grows. */
export default function TerminalLab() {
  const book = useBook();
  const [briefRead, setBriefRead] = useState(false);
  const n = book.accounts.length;
  const unlocked = new Set<string>(['portfolio', 'accounts']);
  if (n > 0) { unlocked.add('overview'); unlocked.add('actions'); }
  if (briefRead) { unlocked.add('brief'); unlocked.add('theses'); unlocked.add('earnings'); unlocked.add('chat'); }
  if (book.accounts.some(a => a.via === 'plaid')) unlocked.add('taxes');

  return <>
    <LabBar variant="terminal" onReset={() => { book.reset(); setBriefRead(false); }} />
    <TerminalMock accounts={book.accounts} unlocked={unlocked}>
      {n === 0 && <div className={s.empty}>
        <h2 className={s.title} style={{ fontSize: 24 }}>Start with what you own.</h2>
        <p className={s.lede}>This page fills in as soon as Helm has a book to read. Connect a brokerage or add the positions you hold; both work, and you can do the other later from Accounts.</p>
        <BookAsk accounts={book.accounts} addPlaid={book.addPlaid} addManual={book.addManual} compact />
      </div>}
      {n > 0 && <>
        <div className={s.grid}>
          <div style={{ display: 'grid', gap: 20 }}>
            <HoldingsTable accounts={book.accounts} />
            {n < 2 ? <Locked label="Overlap between accounts" why="appears when a second account is in. Most Helm members hold two or more." /> : null}
            <div className={s.card}><h3>Add another account</h3><p>The exposure and tax views are only as complete as the book.</p><BookAsk accounts={book.accounts} addPlaid={book.addPlaid} addManual={book.addManual} compact /></div>
          </div>
          <div style={{ display: 'grid', gap: 20 }}>
            <ExposureReveal accounts={book.accounts} />
            <ReceiptCard accounts={book.accounts} />
            <ActionReveal accounts={book.accounts} />
            {!briefRead ? <Locked label="Brief, theses, earnings, the agent" why="unlock after your first brief lands at 9:15 ET tomorrow." onUnlock={() => setBriefRead(true)} /> : <div className={s.card}><h3>Your first brief arrived</h3><p>Theses, earnings and the agent are now in the sidebar. They had nothing to say until there was a day of reading behind them.</p></div>}
          </div>
        </div>
        <BriefPromise accounts={book.accounts} />
      </>}
      <LabNote>Variant B. No separate flow; the portfolio page is the onboarding. The ask sits inline, the reveals land in the layout they will always live in, and the sidebar unlocks as things earn their place. Least to maintain, and the day-one screen is the one the data says returners open. The risk is legibility: an empty terminal has to explain itself.</LabNote>
    </TerminalMock>
  </>;
}
