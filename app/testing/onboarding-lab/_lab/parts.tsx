'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Check, Fingerprint, Plus } from 'lucide-react';
import s from './lab.module.css';
import { type Account, COVERED, INSTITUTIONS, NOT_FOUND, RECEIPTS, SAMPLE_PLAID, exposure, manualAccount, money, pct, priceOf } from './data';

export const Demo = ({ children = 'Demo data' }: { children?: React.ReactNode }) => <span className={s.demo}>{children}</span>;

export function useBook() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const addPlaid = (inst: string) => setAccounts(a => a.some(x => x.institution === inst) ? a : [...a, SAMPLE_PLAID[inst] ?? { ...SAMPLE_PLAID.Robinhood, id: inst, institution: inst }]);
  const addManual = (rows: { ticker: string; shares: number }[]) => setAccounts(a => [...a, manualAccount(rows)]);
  return { accounts, addPlaid, addManual, reset: () => setAccounts([]) };
}

export function LabBar({ variant, onReset }: { variant: 'wizard' | 'terminal' | 'hybrid'; onReset: () => void }) {
  return <div className={s.bar}>
    <div><Link href="/testing/onboarding-lab">Onboarding lab</Link><Link href="/testing/onboarding-lab/wizard" aria-current={variant === 'wizard' ? 'page' : undefined}>A wizard</Link><Link href="/testing/onboarding-lab/terminal" aria-current={variant === 'terminal' ? 'page' : undefined}>B terminal</Link><Link href="/testing/onboarding-lab/hybrid" aria-current={variant === 'hybrid' ? 'page' : undefined}>C hybrid</Link></div>
    <div><Demo>Simulated Plaid, no writes</Demo> <button type="button" onClick={onReset}>Reset</button></div>
  </div>;
}

export function StepFrame({ step, total, title, lede, children }: { step: number; total: number; title: string; lede?: string; children: React.ReactNode }) {
  return <div className={s.frame}>
    <div className={s.progress} aria-label={`Step ${step} of ${total}`}>{Array.from({ length: total }, (_, i) => <span key={i} data-on={i < step ? '' : undefined} />)}</div>
    <h1 className={s.title}>{title}</h1>
    {lede && <p className={s.lede}>{lede}</p>}
    {children}
  </div>;
}

/** The first ask. Plaid and manual entry at equal weight; Plaid simulated with its three real outcomes. */
export function BookAsk({ accounts, addPlaid, addManual, compact }: { accounts: Account[]; addPlaid: (i: string) => void; addManual: (r: { ticker: string; shares: number }[]) => void; compact?: boolean }) {
  const [pending, setPending] = useState<string | null>(null);
  const [rows, setRows] = useState<{ ticker: string; shares: number }[]>([]);
  const [t, setT] = useState(''); const [sh, setSh] = useState('');
  const [notFound, setNotFound] = useState<string | null>(null);
  const linked = new Set(accounts.map(a => a.institution));
  const addRow = () => { const tk = t.trim().toUpperCase(); const n = Number(sh); if (!/^[A-Z][A-Z.\-]{0,9}$/.test(tk) || !(n > 0)) return; setRows(r => [...r, { ticker: tk, shares: n }]); setT(''); setSh(''); };
  return <div className={s.two}>
    <section className={s.card} aria-labelledby="ask-plaid">
      <h3 id="ask-plaid">Connect a brokerage</h3>
      <p>Read-only. Helm can see positions and balances and can never trade, move money or see your login.</p>
      <div className={s.chips}>{INSTITUTIONS.map(i => <button key={i} type="button" disabled={linked.has(i)} onClick={() => { setNotFound(null); setPending(i); }}>{linked.has(i) ? <><Check size={13} /> {i}</> : i}</button>)}</div>
      {pending && <div className={s.modal} role="dialog" aria-label="Simulated Plaid">
        <h4>Plaid, simulated: {pending}</h4><p>Pick the outcome a real user would hit. These are the three that happen in production.</p>
        <div className={s.outcomes}>
          {!NOT_FOUND.has(pending) && <button type="button" onClick={() => { addPlaid(pending); setPending(null); }}>Connected<small>Positions import in the background; the reveal starts now.</small></button>}
          <button type="button" onClick={() => { setNotFound(pending); setPending(null); }}>Institution not found<small>10 of 29 real Plaid exits. The manual path catches it.</small></button>
          <button type="button" onClick={() => setPending(null)}>Closed the picker<small>16 of 29 real exits, at the credential screen.</small></button>
        </div>
      </div>}
      {notFound && <p style={{ marginTop: 14 }}><strong>{notFound}</strong> is not available through Plaid yet. Add those positions by hand on the right; you keep every feature.</p>}
      <ul className={s.trust}><li>Read-only, revocable at any time</li><li>Bank-grade connection through Plaid</li><li>Nothing is sold and nothing is traded</li></ul>
    </section>
    <section className={s.card} aria-labelledby="ask-manual">
      <h3 id="ask-manual">Or add the positions you hold</h3>
      <p>Three to five tickers is enough. No credentials, no account numbers. Connect a brokerage later to import the rest.</p>
      <div className={s.form}>
        <input aria-label="Ticker" placeholder="Ticker, e.g. NVDA" value={t} onChange={e => setT(e.target.value.toUpperCase())} autoCapitalize="characters" />
        <input aria-label="Shares" placeholder="Shares" inputMode="decimal" value={sh} onChange={e => setSh(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addRow(); }} />
        <button type="button" className="helm-button helm-button-outline" aria-label="Add position" onClick={addRow}><Plus size={16} /></button>
      </div>
      {rows.length > 0 && <div className={s.rows}>{rows.map((r, i) => <span key={i}>{r.ticker} · {r.shares} sh · {money(r.shares * priceOf(r.ticker))}</span>)}</div>}
      <div className={s.actions}>
        <button type="button" className="helm-button" disabled={rows.length === 0} onClick={() => { addManual(rows); setRows([]); }}>Add {rows.length || ''} position{rows.length === 1 ? '' : 's'} <ArrowRight size={16} /></button>
        {!compact && <span className={s.src}><Fingerprint size={12} /> Prices shown are demo values</span>}
      </div>
    </section>
  </div>;
}

/** The multi-account loop. Each pass makes the next reveal richer. */
export function AccountLoop({ accounts, addPlaid, onContinue }: { accounts: Account[]; addPlaid: (i: string) => void; onContinue: () => void }) {
  const [pending, setPending] = useState<string | null>(null);
  const linked = new Set(accounts.map(a => a.institution));
  const ex = exposure(accounts);
  return <div className={s.card}>
    <h3>{accounts.length === 1 ? `${accounts[0].institution} is in. Is that everything?` : `${accounts.length} accounts, ${ex.positions} positions, ${money(ex.total)}.`}</h3>
    <p>{accounts.length === 1 ? 'Most people who pay for Helm hold accounts at two or more brokerages. Add the others and the exposure view shows the overlap between them.' : 'Add another, or continue to what Helm sees across them.'}</p>
    <div className={s.acctList}>{accounts.map(a => <div key={a.id} className={s.acct}><span>{a.institution} · {a.type}</span><span>{a.holdings.length} positions · {a.via === 'plaid' ? 'imported' : 'entered by hand'}</span></div>)}</div>
    <div className={s.chips} style={{ marginTop: 14 }}>{INSTITUTIONS.filter(i => !linked.has(i) && !NOT_FOUND.has(i)).map(i => <button key={i} type="button" onClick={() => setPending(i)}>{i}</button>)}</div>
    {pending && <div className={s.modal} role="dialog" aria-label="Simulated Plaid"><h4>Plaid, simulated: {pending}</h4><div className={s.outcomes}><button type="button" onClick={() => { addPlaid(pending); setPending(null); }}>Connected</button><button type="button" onClick={() => setPending(null)}>Closed the picker</button></div></div>}
    <div className={s.actions}><button type="button" className="helm-button" onClick={onContinue}>Show me what Helm sees <ArrowRight size={16} /></button><span className={s.src}>You can add accounts any time from Accounts.</span></div>
  </div>;
}

export function ExposureReveal({ accounts, title = true }: { accounts: Account[]; title?: boolean }) {
  const ex = exposure(accounts); const top = ex.top;
  if (!top) return null;
  return <div className={s.card}>
    {title && <h3>What you actually own <Demo /></h3>}
    <div className={s.exp}>{ex.rows.slice(0, 5).map(r => <div key={r.ticker} className={s.expRow}><strong>{r.ticker}</strong><div className={s.track}><i style={{ width: `${(r.direct / ex.total) * 100}%` }} /><i style={{ width: `${(r.indirect / ex.total) * 100}%` }} /></div><em>{pct(r.pct)}</em></div>)}</div>
    <div className={s.legend}><span><i />Held directly</span><span><i />Inside your funds</span></div>
    <p className={s.sentence}>{top.ticker} is <strong>{pct(top.pct)}</strong> of your book: {pct(top.direct / ex.total)} held directly{top.indirect > 0 && <>, {pct(top.indirect / ex.total)} inside {top.viaFunds.join(' and ')}</>}{top.accounts > 1 && <>, across {top.accounts} accounts</>}. No single brokerage screen shows that number.</p>
  </div>;
}

export function ReceiptCard({ accounts }: { accounts: Account[] }) {
  const top = exposure(accounts).top; if (!top) return null;
  const r = COVERED.has(top.ticker) ? RECEIPTS[top.ticker] : undefined;
  return <div className={s.card}>
    <h3>The reason you hold {top.ticker}, checked <Demo>Sample receipt</Demo></h3>
    {r ? <div className={s.receipt}><div className={s.verdict} data-v={r.verdict}><Check size={12} /> {r.verdict} · {r.pillar}</div><p className={s.quote}>&ldquo;{r.quote}&rdquo;</p><div className={s.src}>{r.source} · {r.date} · quoted verbatim, linked to the filing</div></div>
      : <div className={s.receipt}><p className={s.quote}>No filing has moved {top.ticker} in the last 90 days.</p><div className={s.src}>Helm says so instead of inventing a verdict. It keeps reading; the first receipt lands in your brief.</div></div>}
  </div>;
}

export function ActionReveal({ accounts }: { accounts: Account[] }) {
  const ex = exposure(accounts); const top = ex.top; if (!top) return null;
  const heavy = top.pct >= 0.25;
  return <div className={s.card}>
    <h3>One thing worth knowing today <Demo /></h3>
    <div className={s.inbox}>
      <div className={s.item} data-tone={heavy ? undefined : 'gold'}><i /><div><strong>{heavy ? `${top.ticker} is ${pct(top.pct)} of your book` : `Your largest position is ${top.ticker} at ${pct(top.pct)}`}</strong><p>{heavy ? `Helm flags a single name above 25% across all accounts. It watches the position's filings, earnings dates and the funds that add to it, and tells you when any of those move.` : `Concentration is below the 25% line Helm watches. It keeps checking as prices and fund weights change.`}</p></div></div>
      {accounts.length < 2 && <div className={s.item} data-tone="muted"><i /><div><strong>Add your second account</strong><p>Exposure and the tax view are only as complete as the book. Accounts holds the connection.</p></div></div>}
    </div>
  </div>;
}

export function BriefPromise({ accounts }: { accounts: Account[] }) {
  const ex = exposure(accounts);
  return <div className={s.promise}><div><strong>Your brief on these {ex.positions} positions lands at 9:15 ET tomorrow.</strong><p>What moved, what matters to your book, and the first receipts on the reasons you hold each name. Email and the terminal, both.</p></div><Demo>Daily, after this</Demo></div>;
}

const NAV = [['Overview', 'overview'], ['Portfolio', 'portfolio'], ['Actions', 'actions'], ['Brief', 'brief'], ['Accounts', 'accounts'], ['Taxes', 'taxes'], ['Theses', 'theses'], ['Earnings', 'earnings'], ['Agent', 'chat']] as const;

/** The terminal, mocked. `unlocked` lists what has earned its place so far; the rest stays visible but quiet. */
export function TerminalMock({ accounts, unlocked, children, active = 'portfolio' }: { accounts: Account[]; unlocked: Set<string>; children?: React.ReactNode; active?: string }) {
  const ex = exposure(accounts);
  return <div className={s.terminal}>
    <nav className={s.side} aria-label="Terminal">{NAV.map(([label, key]) => { const lock = !unlocked.has(key); return <a key={key} href="#" data-active={key === active ? '' : undefined} data-locked={lock ? '' : undefined} onClick={e => e.preventDefault()}>{label}{lock && <small>{key === 'brief' ? 'tomorrow' : key === 'taxes' ? 'needs cost basis' : 'after your brief'}</small>}</a>; })}</nav>
    <div className={s.main}>
      <div className={s.topline}><h1>Portfolio</h1>{ex.total > 0 && <div className={s.kpis}><span>Book<b>{money(ex.total)}</b></span><span>Positions<b>{ex.positions}</b></span><span>Accounts<b>{accounts.length}</b></span></div>}</div>
      {children}
    </div>
  </div>;
}

export function HoldingsTable({ accounts }: { accounts: Account[] }) {
  const rows = accounts.flatMap(a => a.holdings.map(h => ({ ...h, acct: a.institution })));
  return <div className={s.card}><h3>Holdings <Demo /></h3><table className={s.table}><thead><tr><th>Ticker</th><th>Account</th><th>Shares</th><th>Value</th></tr></thead><tbody>{rows.map((r, i) => <tr key={i}><td>{r.ticker}</td><td>{r.acct}</td><td>{r.shares}</td><td>{money(r.shares * r.price)}</td></tr>)}</tbody></table></div>;
}

export function Locked({ label, why, onUnlock }: { label: string; why: string; onUnlock?: () => void }) {
  return <div className={s.locked}><span><strong style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{label}</strong> · {why}</span>{onUnlock && <button type="button" className={s.linkish} onClick={onUnlock}>Simulate</button>}</div>;
}

export function LabNote({ children }: { children: React.ReactNode }) { return <div className={s.note}>{children}</div>; }
export { s as labStyles };
