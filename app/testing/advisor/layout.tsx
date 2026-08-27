// /testing/advisor: design lab for Helm's advisor platform (vendor to RIAs).
//
// Seven screens, each on its own route so it can be screenshotted honestly,
// and six palettes switchable from the strip (three light, three dark). The
// premise is every single name across the firm's book, under management and
// client-linked alike, with a written reason, checked every market day against
// filings: the morning book cut by household and by name, one household, the
// one-page note in the advisor's voice, the weekly digest, the client's
// consent screen, the CCO's view that never shows a position, and the artifact
// a prospect firm gets from its own public filings before anything is shared.
//
// Copy on the screens is written as the product would ship it. The households,
// figures and quotations are invented for the lab, and the lab is dev only:
// it 404s in production like the rest of /testing.

import { notFound } from 'next/navigation';
import { ThemeShell } from './theme-shell';

export const metadata = { title: 'Helm for advisors', robots: { index: false, follow: false } };

export default function AdvisorLabLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <>
      <style>{CSS}</style>
      <ThemeShell>{children}</ThemeShell>
    </>
  );
}

const CSS = `
.adv-root {
  --paper: #F4F1EA;
  --paper-2: #ECE7DB;
  --paper-3: #E3DDCE;
  --raised: #FBF9F4;
  --banner: #F7EFD9;
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
  transition: background .2s, color .2s;
}

/* ── palettes ── */
.adv-root[data-theme="broadsheet"] {
  --paper: #FFFFFF; --paper-2: #F3F3F3; --paper-3: #E6E6E6; --raised: #FFFFFF; --banner: #FAF3F3;
  --ink: #000000; --ink-2: #2E2E2E; --ink-3: #616161; --rule: #CFCFCF; --rule-2: #8F8F8F;
  --mark: #8A8A8A; --mark-ink: #4A4A4A; --neg: #C8102E; --pos: #1B6E3A;
}
.adv-root[data-theme="clinical"] {
  --paper: #FAFAF9; --paper-2: #F1F1EF; --paper-3: #E5E5E2; --raised: #FFFFFF; --banner: #EFF6FF;
  --ink: #0F172A; --ink-2: #475569; --ink-3: #64748B; --rule: #E2E8F0; --rule-2: #CBD5E1;
  --mark: #2563EB; --mark-ink: #1D4ED8; --neg: #DC2626; --pos: #15803D;
  --serif: var(--font-sans);
}
.adv-root[data-theme="dusk"] {
  --paper: #141311; --paper-2: #1C1A17; --paper-3: #292620; --raised: #1A1815; --banner: #2A2416;
  --ink: #EDE6D6; --ink-2: #BDB5A4; --ink-3: #8B8477; --rule: #2E2B25; --rule-2: #4A453C;
  --mark: #E6B94D; --mark-ink: #E0B54A; --neg: #E4736A; --pos: #7CC79A;
}
.adv-root[data-theme="terminal"] {
  --paper: #060606; --paper-2: #0E0E0E; --paper-3: #181818; --raised: #0C0C0C; --banner: #1A1508;
  --ink: #FAFAFA; --ink-2: #A3A3A3; --ink-3: #737373; --rule: #1F1F1F; --rule-2: #383838;
  --mark: #E6B94D; --mark-ink: #E6B94D; --neg: #F87171; --pos: #4ADE80;
  --serif: var(--font-display-serif), Georgia, serif;
}
.adv-root[data-theme="slate"] {
  --paper: #0F1419; --paper-2: #161C23; --paper-3: #202932; --raised: #141A21; --banner: #2A2410;
  --ink: #E6EDF3; --ink-2: #A9B4C0; --ink-3: #7D8894; --rule: #253039; --rule-2: #3A4855;
  --mark: #F5B83D; --mark-ink: #F5B83D; --neg: #FF6B6B; --pos: #3DDC97;
}
.adv-root[data-theme="terminal"] .adv-h1, .adv-root[data-theme="terminal"] .adv-h2,
.adv-root[data-theme="terminal"] .adv-stat-n, .adv-root[data-theme="terminal"] .adv-note-subj { letter-spacing: 0; }
.adv-root[data-theme="clinical"] .adv-h1 { font-weight: 600; font-size: 28px; letter-spacing: -.01em; }
.adv-root[data-theme="clinical"] .adv-h1 em { font-style: normal; font-weight: 400; }
.adv-root[data-theme="clinical"] .adv-h2, .adv-root[data-theme="clinical"] .adv-note-subj { font-weight: 600; }
.adv-root[data-theme="clinical"] .adv-stat-n { font-weight: 600; font-size: 26px; }
.adv-root[data-theme="clinical"] .adv-btn, .adv-root[data-theme="clinical"] .adv-chip { border-radius: 6px; }

.adv-root * { box-sizing: border-box; }
.adv-root a { color: inherit; text-decoration: none; }
.adv-root button { font: inherit; cursor: pointer; }

.adv-strip {
  display: flex; align-items: center; gap: 22px;
  height: 44px; padding: 0 32px;
  border-bottom: 1px solid var(--ink);
  background: var(--paper);
  position: sticky; top: 0; z-index: 20;
}
.adv-strip-name { flex: 0 0 auto; white-space: nowrap; font-family: var(--serif); font-size: 19px; letter-spacing: .01em; }
.adv-strip-name span { font-style: italic; color: var(--ink-2); }
.adv-strip-nav { display: flex; gap: 16px; min-width: 0; overflow: hidden; font-family: var(--mono); font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-2); white-space: nowrap; }
.adv-strip-nav a:hover { color: var(--ink); }
.adv-themes { margin-left: auto; display: flex; gap: 4px; }
.adv-theme-btn { display: inline-flex; align-items: center; gap: 5px; font-family: var(--mono); font-size: 10px; letter-spacing: .1em; text-transform: uppercase; padding: 4px 6px; border: 1px solid transparent; border-radius: 3px; background: transparent; color: var(--ink-3); transition: color .15s, border-color .15s; }
.adv-theme-btn:hover { color: var(--ink); }
.adv-theme-btn.on { color: var(--ink); border-color: var(--rule-2); }
.adv-theme-btn i { width: 10px; height: 10px; border-radius: 50%; border: 1px solid rgba(0,0,0,.25); }
.adv-theme-btn i[data-swatch="paper"] { background: linear-gradient(135deg, #F4F1EA 50%, #E6B94D 50%); }
.adv-theme-btn i[data-swatch="broadsheet"] { background: linear-gradient(135deg, #FFFFFF 50%, #C8102E 50%); }
.adv-theme-btn i[data-swatch="clinical"] { background: linear-gradient(135deg, #FAFAF9 50%, #2563EB 50%); }
.adv-theme-btn i[data-swatch="dusk"] { background: linear-gradient(135deg, #141311 50%, #E6B94D 50%); }
.adv-theme-btn i[data-swatch="terminal"] { background: linear-gradient(135deg, #060606 50%, #E6B94D 50%); }
.adv-theme-btn i[data-swatch="slate"] { background: linear-gradient(135deg, #0F1419 50%, #F5B83D 50%); }

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

/* two ways to cut the same book */
.adv-tabs { display: flex; gap: 0; margin-bottom: 14px; border-bottom: 1px solid var(--rule); }
.adv-tabs a { font-family: var(--mono); font-size: 11px; letter-spacing: .12em; text-transform: uppercase; padding: 7px 14px; color: var(--ink-3); border: 1px solid transparent; border-bottom: 0; margin-bottom: -1px; }
.adv-tabs a:hover { color: var(--ink); }
.adv-tabs a.on { color: var(--ink); border-color: var(--rule-2); background: var(--raised); }

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
.adv-btn { display: inline-block; font-family: var(--mono); font-size: 11px; letter-spacing: .12em; text-transform: uppercase; padding: 8px 12px; border: 1px solid var(--ink); background: transparent; color: var(--ink); border-radius: 3px; transition: background .15s, color .15s; }
.adv-btn:hover { background: var(--paper-2); }
.adv-btn.fill { background: var(--ink); color: var(--paper); }
.adv-btn.fill:hover { background: var(--ink-2); }
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

/* email frame (digest) */
.adv-mail { max-width: 600px; margin: 24px auto 0; border: 1px solid var(--rule-2); background: var(--raised); padding: 32px 36px; }
.adv-mail-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding-bottom: 14px; border-bottom: 2px solid var(--ink); }
.adv-mail-head .adv-strip-name { font-size: 20px; }
.adv-mail h1 { font-family: var(--serif); font-weight: 400; font-size: 26px; line-height: 1.15; margin: 22px 0 4px; }
.adv-mail .pre { color: var(--ink-2); font-size: 14px; margin: 0 0 18px; }
.adv-mail-nums { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 14px 0; border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); }
.adv-mail-nums div { text-align: left; }
.adv-mail-nums b { display: block; font-family: var(--serif); font-size: 26px; line-height: 1; margin-bottom: 4px; font-weight: 400; }
.adv-mail-nums span { font-family: var(--mono); font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-3); }
.adv-mail-item { padding: 14px 0; border-bottom: 1px solid var(--rule); }
.adv-mail-item b { display: block; font-weight: 600; font-size: 14.5px; margin-bottom: 4px; }
.adv-mail-item p { margin: 0; font-size: 13.5px; color: var(--ink-2); line-height: 1.5; }
.adv-mail-item .adv-note-src { display: block; margin-top: 4px; }
.adv-mail-foot { margin-top: 18px; font-family: var(--mono); font-size: 10.5px; letter-spacing: .06em; color: var(--ink-3); line-height: 1.7; }
.adv-mail-meta { max-width: 600px; margin: 0 auto; font-family: var(--mono); font-size: 11px; letter-spacing: .06em; color: var(--ink-3); display: flex; justify-content: space-between; gap: 12px; }

/* consent */
.adv-consent { max-width: 460px; margin: 40px auto 0; border: 1px solid var(--ink); padding: 28px; background: var(--raised); }
.adv-consent .adv-h2 { font-size: 24px; }
.adv-consent-list { margin: 16px 0 0; padding: 0; list-style: none; }
.adv-consent-list li { display: grid; grid-template-columns: 44px 1fr; gap: 10px; padding: 8px 0; border-top: 1px solid var(--rule); font-size: 14px; }
.adv-consent-list li:first-child { border-top: 0; }
.adv-consent-list .k { font-family: var(--mono); font-size: 12px; color: var(--ink-3); }
.adv-consent-list .k.no { color: var(--neg); }
.adv-consent-actions { display: flex; gap: 10px; margin-top: 22px; }
.adv-consent-actions .adv-btn { flex: 1; text-align: center; margin: 0; }

/* banner */
.adv-banner { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 10px 14px; border: 1px solid var(--mark-ink); background: var(--banner); font-size: 13px; margin-bottom: 18px; }
.adv-banner b { font-weight: 600; }
.adv-banner .adv-eyebrow { color: var(--mark-ink); }

/* index */
.adv-index { display: grid; grid-template-columns: 1fr 1fr; gap: 0 48px; }
.adv-index a { display: grid; grid-template-columns: 40px 1fr; gap: 16px; padding: 20px 0; border-bottom: 1px solid var(--rule); }
.adv-index a:hover .adv-h2 { color: var(--mark-ink); }
.adv-index .no { font-family: var(--mono); font-size: 12px; color: var(--ink-3); padding-top: 6px; }
.adv-index p { margin: 6px 0 0; font-size: 13.5px; color: var(--ink-2); max-width: 52ch; }
.adv-index .why { margin-top: 8px; font-family: var(--mono); font-size: 10.5px; letter-spacing: .06em; color: var(--ink-3); }
.adv-palettes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 14px; }
.adv-palette { border: 1px solid var(--rule-2); padding: 14px; }
.adv-palette .sw { display: flex; gap: 4px; margin-bottom: 10px; }
.adv-palette .sw i { width: 22px; height: 22px; border: 1px solid rgba(0,0,0,.2); }
.adv-palette b { display: block; font-family: var(--serif); font-size: 18px; font-weight: 400; }
.adv-palette p { margin: 4px 0 0; font-size: 12.5px; color: var(--ink-2); }

@media (max-width: 1024px) {
  .adv-cols { grid-template-columns: minmax(0, 1fr); }
  .adv-cols > div { min-width: 0; }
  .adv-head { grid-template-columns: minmax(0, 1fr); }
  .adv-head-meta { text-align: left; }
  .adv-rail { border-left: 0; padding-left: 0; border-top: 1px solid var(--rule); padding-top: 16px; }
  .adv-index { grid-template-columns: 1fr; }
  .adv-palettes { grid-template-columns: 1fr 1fr; }
  .adv-event { grid-template-columns: 1fr; gap: 6px; }
  .adv-event-act { text-align: left; }
  .adv-strip-nav { display: none; }
  .adv-theme-btn { padding: 4px 5px; }
  .adv-theme-btn i { display: none; }
  .adv-mail-nums { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 1220px) {
  .adv-strip-nav { display: none; }
}
@media (max-width: 700px) {
  /* a phone gets the load-bearing columns; the rest of the ledger is desk work */
  .adv-table .opt { display: none; }
  /* the strip keeps the palette switcher reachable by dropping to swatches */
  .adv-strip .adv-theme-btn { font-size: 0; gap: 0; padding: 5px 6px; }
  .adv-strip .adv-theme-btn i { display: block; width: 14px; height: 14px; }
}
@media (max-width: 600px) {
  .adv-page { padding: 20px 16px 60px; }
  .adv-strip { padding: 0 16px; gap: 12px; }
  .adv-h1 { font-size: 26px; }
  .adv-consent { padding: 20px; }
  .adv-mail { padding: 22px 18px; }
  .adv-palettes { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) { .adv-root * { transition: none !important; } }
`;
