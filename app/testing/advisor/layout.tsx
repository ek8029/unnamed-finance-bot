// /testing/advisor — design lab for Helm's advisor platform (vendor to RIAs).
//
// Six screens, each on its own route so it can be screenshotted honestly.
// Built from ria-research/SYNTHESIS.md: the morning book, one household with
// the half the advisor cannot see, the one-page note in the advisor's voice,
// the client's consent screen, and the CCO's view that never shows a position.
//
// Deliberately NOT the consumer terminal: paper instead of black, ink instead
// of gold, hairlines instead of cards, every figure tabular. A desk tool used
// at 7:40 AM with coffee, not a terminal watched after the close.
//
// Every number here is SAMPLE DATA. No real household appears anywhere.
// Dev only; 404s in production like the rest of /testing.

import { notFound } from 'next/navigation';
import Link from 'next/link';

export const metadata = { title: 'Helm for advisors · lab', robots: { index: false, follow: false } };

const SCREENS = [
  { href: '/testing/advisor/book', label: 'The book' },
  { href: '/testing/advisor/client', label: 'Household' },
  { href: '/testing/advisor/note', label: 'The note' },
  { href: '/testing/advisor/consent', label: 'Consent' },
  { href: '/testing/advisor/compliance', label: 'Compliance' },
];

export default function AdvisorLabLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <div className="adv-root">
      <style>{CSS}</style>
      <header className="adv-strip">
        <Link href="/testing/advisor" className="adv-strip-name">
          Helm <span>for advisors</span>
        </Link>
        <nav className="adv-strip-nav">
          {SCREENS.map((s) => (
            <Link key={s.href} href={s.href}>{s.label}</Link>
          ))}
        </nav>
        <span className="adv-strip-tag">Design lab · sample data</span>
      </header>
      {children}
    </div>
  );
}

const CSS = `
.adv-root {
  --paper: #F4F1EA;
  --paper-2: #ECE7DB;
  --paper-3: #E3DDCE;
  --ink: #17150F;
  --ink-2: #47433B;
  --ink-3: #736E63;
  --rule: #D8D2C3;
  --rule-2: #B7AF9D;
  --mark: #E6B94D;
  --mark-ink: #8A6614;
  --neg: #A3352B;
  --pos: #2E6B49;
  --sans: var(--font-sans);
  --mono: var(--font-mono);
  --serif: var(--font-newsreader), Georgia, serif;
  min-height: 100vh;
  overflow-x: clip;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 14px;
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
  font-variant-numeric: tabular-nums;
}
.adv-root * { box-sizing: border-box; }
.adv-root a { color: inherit; text-decoration: none; }
.adv-root button { font: inherit; cursor: pointer; }

.adv-strip {
  display: flex; align-items: center; gap: 28px;
  height: 44px; padding: 0 32px;
  border-bottom: 1px solid var(--ink);
  background: var(--paper);
  position: sticky; top: 0; z-index: 20;
}
.adv-strip-name { font-family: var(--serif); font-size: 19px; letter-spacing: .01em; }
.adv-strip-name span { font-style: italic; color: var(--ink-2); }
.adv-strip-nav { display: flex; gap: 22px; font-family: var(--mono); font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-2); }
.adv-strip-nav a:hover { color: var(--ink); }
.adv-strip-tag { margin-left: auto; font-family: var(--mono); font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: var(--mark-ink); border: 1px solid var(--mark-ink); padding: 3px 8px; }

.adv-page { max-width: 1280px; margin: 0 auto; padding: 28px 32px 80px; }

.adv-eyebrow { font-family: var(--mono); font-size: 10.5px; letter-spacing: .18em; text-transform: uppercase; color: var(--ink-3); }
.adv-h1 { font-family: var(--serif); font-weight: 400; font-size: 34px; line-height: 1.12; letter-spacing: -.005em; margin: 6px 0 0; }
.adv-h1 em { font-style: italic; color: var(--ink-2); }
.adv-h2 { font-family: var(--serif); font-weight: 400; font-size: 22px; line-height: 1.2; margin: 0; }
.adv-lede { font-size: 14.5px; color: var(--ink-2); max-width: 62ch; margin: 10px 0 0; }

.adv-head { display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: end; padding-bottom: 18px; border-bottom: 2px solid var(--ink); }
.adv-head-meta { text-align: right; font-family: var(--mono); font-size: 11px; letter-spacing: .06em; color: var(--ink-2); line-height: 1.7; }
.adv-head-meta b { color: var(--ink); font-weight: 600; }

.adv-section { padding: 22px 0 26px; border-bottom: 1px solid var(--rule); overflow-x: auto; }
.adv-section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
.adv-section-head .adv-eyebrow { color: var(--ink); }
.adv-section-head small { font-family: var(--mono); font-size: 10.5px; letter-spacing: .08em; color: var(--ink-3); }

.adv-cols { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 40px; }

/* ledger tables */
.adv-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.adv-table th { font-family: var(--mono); font-weight: 500; font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-3); text-align: left; padding: 0 10px 8px 0; border-bottom: 1px solid var(--ink); white-space: nowrap; }
.adv-table td { padding: 9px 10px 9px 0; border-bottom: 1px solid var(--rule); vertical-align: top; }
.adv-table tr:last-child td { border-bottom: 1px solid var(--rule-2); }
.adv-table .num, .adv-table th.num { text-align: right; font-family: var(--mono); font-size: 12.5px; }
.adv-table .dim { color: var(--ink-3); }
.adv-table .name { font-weight: 600; }
.adv-table .sub { display: block; font-size: 11.5px; color: var(--ink-3); margin-top: 2px; font-weight: 400; }
.adv-table tbody tr:hover td { background: var(--paper-2); }
.adv-table .row-quiet td { color: var(--ink-3); }

/* marks */
.adv-mark { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--mark); vertical-align: middle; margin-right: 6px; }
.adv-mark.neg { background: var(--neg); }
.adv-mark.pos { background: var(--pos); }
.adv-mark.none { background: transparent; border: 1px solid var(--rule-2); }
.adv-chip { display: inline-block; font-family: var(--mono); font-size: 10px; letter-spacing: .1em; text-transform: uppercase; padding: 2px 6px; border: 1px solid var(--rule-2); color: var(--ink-2); border-radius: 2px; white-space: nowrap; }
.adv-chip.held { border-color: var(--mark-ink); color: var(--mark-ink); }
.adv-chip.neg { border-color: var(--neg); color: var(--neg); }
.adv-chip.ret { border-style: dashed; }
.adv-neg { color: var(--neg); }
.adv-pos { color: var(--pos); }

/* events */
.adv-events { display: grid; gap: 0; }
.adv-event { display: grid; grid-template-columns: 92px minmax(0, 1fr) 190px; gap: 20px; padding: 14px 0; border-top: 1px solid var(--rule); align-items: start; }
.adv-event:first-child { border-top: 0; }
.adv-event-when { font-family: var(--mono); font-size: 11px; letter-spacing: .06em; color: var(--ink-3); line-height: 1.6; }
.adv-event-what { font-size: 14px; }
.adv-event-what b { font-weight: 600; }
.adv-event-what .q { font-family: var(--serif); font-style: italic; font-size: 15px; color: var(--ink-2); margin: 6px 0 4px; line-height: 1.4; }
.adv-event-src { font-family: var(--mono); font-size: 10.5px; letter-spacing: .06em; color: var(--ink-3); }
.adv-event-act { text-align: right; }

/* buttons */
.adv-btn { display: inline-block; font-family: var(--mono); font-size: 11px; letter-spacing: .12em; text-transform: uppercase; padding: 8px 12px; border: 1px solid var(--ink); background: transparent; color: var(--ink); border-radius: 3px; transition: background .15s; }
.adv-btn:hover { background: var(--paper-2); }
.adv-btn.fill { background: var(--ink); color: var(--paper); }
.adv-btn.fill:hover { background: #2A2720; }
.adv-btn.quiet { border-color: var(--rule-2); color: var(--ink-2); }
.adv-btn + .adv-btn { margin-left: 8px; }

/* figures on a scale */
.adv-scale { position: relative; height: 6px; background: var(--paper-3); margin-top: 6px; }
.adv-scale i { position: absolute; left: 0; top: 0; bottom: 0; background: var(--ink); }
.adv-scale i.held { background: var(--mark); }
.adv-scale b { position: absolute; top: -3px; width: 1px; height: 12px; background: var(--neg); }

/* rail */
.adv-rail { border-left: 1px solid var(--rule); padding-left: 24px; }
.adv-rail .adv-eyebrow { color: var(--ink); }
.adv-stat { padding: 12px 0; border-bottom: 1px solid var(--rule); }
.adv-stat:last-child { border-bottom: 0; }
.adv-stat-n { font-family: var(--serif); font-size: 30px; line-height: 1; margin: 4px 0 2px; }
.adv-stat-n small { font-size: 16px; color: var(--ink-3); }
.adv-stat-l { font-size: 12.5px; color: var(--ink-2); }
.adv-stat-l b { color: var(--ink); font-weight: 600; }

/* note */
.adv-note { max-width: 680px; }
.adv-note-subj { font-family: var(--serif); font-size: 26px; line-height: 1.2; margin: 0 0 4px; }
.adv-note-from { font-family: var(--mono); font-size: 11px; letter-spacing: .06em; color: var(--ink-3); margin-bottom: 22px; }
.adv-note-block { padding: 14px 0; border-top: 1px solid var(--rule); }
.adv-note-block .adv-eyebrow { margin-bottom: 6px; }
.adv-note-block p { margin: 0; font-size: 15px; line-height: 1.55; max-width: 60ch; }
.adv-note-block blockquote { margin: 8px 0 8px; padding-left: 14px; border-left: 2px solid var(--ink); font-family: var(--serif); font-size: 17px; line-height: 1.45; color: var(--ink); }
.adv-note-src { font-family: var(--mono); font-size: 10.5px; letter-spacing: .06em; color: var(--ink-3); }
.adv-note-grade { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.adv-note-grade > div { font-size: 14px; line-height: 1.5; }
.adv-note-grade .adv-eyebrow { margin-bottom: 6px; }
.adv-struck { text-decoration: line-through; color: var(--ink-3); }
.adv-guard { font-family: var(--mono); font-size: 10.5px; letter-spacing: .08em; color: var(--ink-3); border: 1px dashed var(--rule-2); padding: 10px 12px; line-height: 1.7; }
.adv-guard b { color: var(--neg); font-weight: 600; }

/* consent */
.adv-consent { max-width: 460px; margin: 40px auto 0; border: 1px solid var(--ink); padding: 28px; background: #FBF9F4; }
.adv-consent .adv-h2 { font-size: 24px; }
.adv-consent-list { margin: 16px 0 0; padding: 0; list-style: none; }
.adv-consent-list li { display: grid; grid-template-columns: 44px 1fr; gap: 10px; padding: 8px 0; border-top: 1px solid var(--rule); font-size: 14px; }
.adv-consent-list li:first-child { border-top: 0; }
.adv-consent-list .k { font-family: var(--mono); font-size: 12px; color: var(--ink-3); }
.adv-consent-list .k.no { color: var(--neg); }
.adv-consent-actions { display: flex; gap: 10px; margin-top: 22px; }
.adv-consent-actions .adv-btn { flex: 1; text-align: center; margin: 0; }

/* banner */
.adv-banner { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 10px 14px; border: 1px solid var(--mark-ink); background: #F7EFD9; font-size: 13px; margin-bottom: 18px; }
.adv-banner b { font-weight: 600; }
.adv-banner .adv-eyebrow { color: var(--mark-ink); }

/* index */
.adv-index { display: grid; grid-template-columns: 1fr 1fr; gap: 0 48px; }
.adv-index a { display: grid; grid-template-columns: 40px 1fr; gap: 16px; padding: 20px 0; border-bottom: 1px solid var(--rule); }
.adv-index a:hover .adv-h2 { color: var(--mark-ink); }
.adv-index .no { font-family: var(--mono); font-size: 12px; color: var(--ink-3); padding-top: 6px; }
.adv-index p { margin: 6px 0 0; font-size: 13.5px; color: var(--ink-2); max-width: 52ch; }
.adv-index .why { margin-top: 8px; font-family: var(--mono); font-size: 10.5px; letter-spacing: .06em; color: var(--ink-3); }

@media (max-width: 1024px) {
  .adv-cols { grid-template-columns: minmax(0, 1fr); }
  .adv-cols > div { min-width: 0; }
  .adv-head { grid-template-columns: minmax(0, 1fr); }
  .adv-head-meta { text-align: left; }
  .adv-rail { border-left: 0; padding-left: 0; border-top: 1px solid var(--rule); padding-top: 16px; }
  .adv-index { grid-template-columns: 1fr; }
  .adv-event { grid-template-columns: 1fr; gap: 6px; }
  .adv-event-act { text-align: left; }
  .adv-strip-nav { display: none; }
}
@media (max-width: 600px) {
  .adv-page { padding: 20px 16px 60px; }
  .adv-strip { padding: 0 16px; gap: 12px; }
  .adv-strip-tag { font-size: 9px; padding: 2px 6px; }
  .adv-h1 { font-size: 26px; }
  .adv-consent { padding: 20px; }
}
@media (prefers-reduced-motion: reduce) { .adv-root * { transition: none !important; } }
`;
