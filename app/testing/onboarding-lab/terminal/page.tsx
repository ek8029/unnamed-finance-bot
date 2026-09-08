'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { BookAsk, LabBar, LabNote, labStyles as s, useBook } from '../_lab/parts';

/**
 * Variant B: no wizard. The ask lives inside the real Portfolio page's empty state and
 * the sections fill in place as the book grows. In the lab this stops at the ask and hands
 * off to the real page: putting the ask inside /dashboard/portfolio itself means editing
 * the dashboard shell and page, which another agent currently has open.
 */
export default function TerminalLab() {
  const book = useBook();
  return <>
    <LabBar variant="terminal" onReset={book.reset} />
    <div className={s.frame}>
      <h1 className={s.title}>Portfolio</h1>
      <p className={s.lede}>This is what the real Portfolio page's empty state would hold. No separate flow: the ask sits where the holdings table will be, and the page fills in as Helm gets something to read.</p>
      {book.accounts.length === 0
        ? <BookAsk accounts={book.accounts} addPlaid={book.addPlaid} addManual={book.addManual} compact />
        : <div className={s.card}><h3>Your book is in.</h3><p>On the real page, exposure, the receipt on your largest position and the first inbox item fill in right here, and the sidebar unlocks Brief, Theses and Earnings after the first brief lands.</p><div className={s.actions}><Link href="/dashboard/portfolio" className="helm-button">Open the terminal <ArrowRight size={16} /></Link></div></div>}
      <LabNote>Variant B built for real = the empty state of /dashboard/portfolio becomes this ask, reveals render in the page's own panels, and the sidebar dims items until they have something to say. Least to maintain; the terminal itself is the onboarding.</LabNote>
    </div>
  </>;
}
