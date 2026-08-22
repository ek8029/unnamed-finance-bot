/**
 * Post-signup drip email templates.
 * Matches Helm confirmation email style: dark card on white bg, gold accents.
 */

const DASHBOARD_URL = 'https://helmterminal.dev/dashboard';
const ACCOUNTS_URL = 'https://helmterminal.dev/dashboard/accounts';
const LOGO_URL = 'https://helmterminal.dev/helm-logo-transparent.png';

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

/* ── Shared wrapper matching confirmation email ── */

function wrap(body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
</head>
<body bgcolor="#FFFFFF" style="margin:0;padding:0;background-color:#FFFFFF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#FFFFFF" style="background-color:#FFFFFF;">
<tr>
<td align="center" valign="top" bgcolor="#FFFFFF" style="background-color:#FFFFFF;padding:40px 16px 48px;">
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width:500px;">
<tr>
<td>
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#1E1E1E" style="background-color:#1E1E1E;border-radius:8px;">

<!-- Gold accent bar -->
<tr><td height="2" bgcolor="#E6B94D" style="height:2px;line-height:2px;font-size:0;background-color:#E6B94D;border-radius:8px 8px 0 0;">&nbsp;</td></tr>

<!-- Logo -->
<tr><td align="center" bgcolor="#1E1E1E" style="background-color:#1E1E1E;padding:36px 40px 24px;">
<img src="${LOGO_URL}" width="120" height="120" alt="Helm Terminal" border="0" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;">
</td></tr>

<!-- Content -->
<tr><td bgcolor="#1E1E1E" style="background-color:#1E1E1E;padding:0 40px 36px;">
${body}
</td></tr>

<!-- Fallback link -->
<tr><td bgcolor="#1E1E1E" style="background-color:#1E1E1E;padding:0 40px 24px;text-align:center;">
<p style="margin:0;font-size:10px;color:#8A8A8A;line-height:1.5;">Button not working? Go directly to</p>
<p style="margin:4px 0 0;font-size:9px;color:#8A8A8A;word-break:break-all;line-height:1.4;"><a href="${DASHBOARD_URL}" style="color:#8A8A8A;">${DASHBOARD_URL}</a></p>
</td></tr>

</table>
</td>
</tr>

<!-- Footer -->
<tr><td style="padding:24px 0 0;text-align:center;">
<p style="margin:0 0 6px;font-size:10px;color:#999999;line-height:1.5;">Sent by Helm Terminal</p>
<p style="margin:0;font-size:9px;">
<a href="https://helmterminal.dev/privacy" style="color:#999999;text-decoration:none;">Privacy</a>
<span style="color:#CCCCCC;">&ensp;&#183;&ensp;</span>
<a href="https://helmterminal.dev/terms" style="color:#999999;text-decoration:none;">Terms</a>
<span style="color:#CCCCCC;">&ensp;&#183;&ensp;</span>
<a href="https://helmterminal.dev/dashboard/settings" style="color:#999999;text-decoration:none;">Unsubscribe</a>
</p>
</td></tr>

</table>
</td>
</tr>
</table>
</body>
</html>`;
}

function cta(text: string, url: string): string {
  return `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:4px 0 8px;">
<tr><td align="center" bgcolor="#E6B94D" style="background-color:#E6B94D;border-radius:3px;">
<a href="${url}" target="_blank" style="display:block;text-align:center;background-color:#E6B94D;color:#0A0A0A;font-size:12px;font-weight:800;text-decoration:none;padding:16px 32px;text-transform:uppercase;letter-spacing:2.5px;border-radius:3px;">${text}</a>
</td></tr>
</table>`;
}

function heading(text: string): string {
  return `<h1 style="margin:0 0 14px;font-size:28px;font-weight:300;color:#F5F5F5;line-height:1.25;letter-spacing:-0.3px;text-align:center;">${text}</h1>`;
}

function subtext(text: string): string {
  return `<p style="margin:0 0 24px;font-size:14px;color:#A0A0A0;line-height:1.65;text-align:center;max-width:360px;display:inline-block;">${text}</p>`;
}

function dividerLine(): string {
  return `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:4px 0;">
<tr><td height="1" bgcolor="#2A2A2A" style="height:1px;line-height:1px;font-size:0;background-color:#2A2A2A;">&nbsp;</td></tr>
</table>`;
}

function sectionLabel(text: string): string {
  return `<p style="margin:24px 0 12px;font-size:9px;font-weight:700;color:#8A8A8A;text-transform:uppercase;letter-spacing:2px;">${text}</p>`;
}

function bulletItem(title: string, desc: string): string {
  return `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom:2px;">
<tr>
<td width="24" valign="top"><div style="width:4px;height:4px;border-radius:50%;background-color:#E6B94D;margin-top:7px;"></div></td>
<td><p style="margin:0;font-size:13px;color:#E0E0E0;line-height:1.5;padding:6px 0;"><strong>${title}</strong><span style="color:#9A9A9A;"> &#8212; ${desc}</span></p></td>
</tr>
</table>`;
}

function trustBar(): string {
  return `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#161616" style="background-color:#161616;margin:8px 0 0;">
<tr><td style="padding:10px 16px;text-align:center;">
<span style="font-size:10px;color:#8A8A8A;letter-spacing:0.3px;">
<span style="color:#4ADE80;">&#9679;</span>&ensp;Read-only&emsp;
<span style="color:#4ADE80;">&#9679;</span>&ensp;AES-256&emsp;
<span style="color:#4ADE80;">&#9679;</span>&ensp;Delete anytime
</span>
</td></tr>
</table>`;
}

/* ── Templates ── */

export function getTemplate(dayIndex: number, userName?: string): EmailTemplate | null {
  const name = userName || 'there';

  switch (dayIndex) {
    case 0: return {
      subject: 'Welcome to Helm',
      text: `Hey ${name},\n\nWelcome to Helm. You now have access to institutional-grade financial intelligence.\n\nNext step: connect your first account. It takes 30 seconds and unlocks your full dashboard.\n\n${ACCOUNTS_URL}\n\nRead-only access via Plaid. We can never move money.\n\n- Helm Terminal`,
      html: wrap(`
        <div style="text-align:center;">
        ${heading(`Welcome aboard, <span style="font-weight:700;color:#E6B94D;">${name}.</span>`)}
        ${subtext('Your terminal is live. Connect your first account to unlock portfolio intelligence that runs while you sleep.')}
        </div>
        ${cta('Connect Account', ACCOUNTS_URL)}
        ${dividerLine()}
        ${sectionLabel("What's waiting")}
        ${bulletItem('Portfolio tracking', 'Every holding, every account, one view.')}
        ${bulletItem('Daily scans', 'Concentration risk, tax-loss harvesting, earnings exposure.')}
        ${bulletItem('Signals', 'Not just data. What changed in your portfolio, prioritized.')}
        ${bulletItem('AI stock analysis', 'Free for any US ticker. No paywall.')}
        ${trustBar()}
      `),
    };

    case 1: return {
      subject: 'Your dashboard is waiting',
      text: `Hey ${name},\n\nYou signed up for Helm but haven't connected an account yet.\n\nOnce you link a brokerage or bank, Helm immediately shows you:\n- Your net worth across all accounts\n- Portfolio concentration risks\n- Tax-loss harvesting opportunities\n- A personalized daily brief\n\nTakes 30 seconds: ${ACCOUNTS_URL}\n\n- Helm Terminal`,
      html: wrap(`
        <div style="text-align:center;">
        ${heading('Your dashboard is <span style="font-weight:700;color:#E6B94D;">empty.</span>')}
        ${subtext("You signed up but haven't connected an account yet. Here's what lights up the moment you do:")}
        </div>
        ${dividerLine()}
        ${sectionLabel('Unlocks immediately')}
        ${bulletItem('Net worth', 'Real-time across all linked accounts.')}
        ${bulletItem('Concentration alerts', 'Know when one position dominates your portfolio.')}
        ${bulletItem('Tax-loss harvesting', 'Automated detection of harvestable losses.')}
        ${bulletItem('Daily brief', 'What moved overnight. What it means for you.')}
        <div style="height:12px;"></div>
        ${cta('Connect Account', ACCOUNTS_URL)}
        ${trustBar()}
      `),
    };

    case 3: return {
      subject: 'How Helm keeps your data safe',
      text: `Hey ${name},\n\nWe get it. Connecting financial accounts to a new platform takes trust.\n\nHere's how Helm protects your data:\n\n1. Read-only access. We can never move money or access credentials.\n2. Plaid infrastructure. Same as Venmo, Robinhood, Coinbase.\n3. AES-256 encryption. In transit and at rest.\n4. You control everything. Disconnect anytime.\n\nReady? ${ACCOUNTS_URL}\n\n- Helm Terminal`,
      html: wrap(`
        <div style="text-align:center;">
        ${heading('Your data, <span style="font-weight:700;color:#E6B94D;">protected.</span>')}
        ${subtext('Connecting financial accounts to a new platform takes trust. Here is exactly how we earn yours.')}
        </div>
        ${dividerLine()}
        ${sectionLabel('Security model')}
        ${bulletItem('Read-only access', 'We can never move money, place trades, or access your credentials.')}
        ${bulletItem('Plaid infrastructure', 'Same system used by Venmo, Robinhood, and Coinbase.')}
        ${bulletItem('AES-256 encryption', 'Your data is encrypted in transit and at rest. Always.')}
        ${bulletItem('Full control', 'Disconnect any account at any time from settings.')}
        <div style="height:12px;"></div>
        ${cta('Connect Your Account', ACCOUNTS_URL)}
        ${trustBar()}
      `),
    };

    case 7: return {
      subject: 'One last thing',
      text: `Hey ${name},\n\nYou signed up a week ago, and your dashboard is still empty.\n\nIf you're not ready, try demo mode to see sample data: ${DASHBOARD_URL}\n\nWhen ready, connecting takes 30 seconds: ${ACCOUNTS_URL}\n\nNo more emails about this.\n\n- Helm Terminal`,
      html: wrap(`
        <div style="text-align:center;">
        ${heading('One last <span style="font-weight:700;color:#E6B94D;">thing.</span>')}
        ${subtext("You signed up a week ago and your dashboard is still empty. No pressure.")}
        <p style="margin:0 0 24px;font-size:14px;color:#A0A0A0;line-height:1.65;text-align:center;">
          Not ready? <a href="${DASHBOARD_URL}" style="color:#E6B94D;text-decoration:underline;">Try demo mode</a> to explore with sample data.
        </p>
        </div>
        ${cta('Connect Account', ACCOUNTS_URL)}
        ${dividerLine()}
        <p style="margin:16px 0 0;font-size:10px;color:#8A8A8A;text-align:center;letter-spacing:0.3px;">No more emails about this. We'll be here when you're ready.</p>
      `),
    };

    case 14: return {
      subject: 'What Helm users are finding',
      text: `Hey ${name},\n\nHere's what Helm users discovered in their first week:\n\n- One user found $23,380 in harvestable losses across 3 accounts\n- Another realized 68% of their portfolio was concentrated in tech through ETF overlap\n- Most users see their first actionable insight within 2 minutes of connecting\n\nYour dashboard is still waiting: ${ACCOUNTS_URL}\n\n- Helm Terminal`,
      html: wrap(`
        <div style="text-align:center;">
        ${heading('What users are <span style="font-weight:700;color:#E6B94D;">finding.</span>')}
        ${subtext('Real results from Helm users in their first week.')}
        </div>
        ${dividerLine()}
        ${sectionLabel('Real discoveries')}
        ${bulletItem('$23,380 in harvestable losses', 'Found across 3 linked accounts. Brokerage never flagged it.')}
        ${bulletItem('68% tech concentration', 'Hidden inside ETFs. Looked diversified on the surface.')}
        ${bulletItem('2 minutes to first insight', 'Connect once. Intelligence runs every night.')}
        <div style="height:12px;"></div>
        ${cta('See Your Portfolio', ACCOUNTS_URL)}
        ${trustBar()}
      `),
    };

    case 21: return {
      subject: 'Helm Pro: thesis monitoring and tax intelligence for $20/mo',
      text: `Hey ${name},\n\nHelm Pro is $20/mo.\n\nWhat you get:\n- Thesis monitoring with cited evidence\n- Tax center with wash-sale-aware TLH\n- Earnings exposure alerts\n- Conviction-led tailored brief\n\nMax is $50/mo and adds the agent, the Thesis Builder, and the factor lens.\n\nThe free tier already includes the full terminal, AI analysis, daily brief, and actions inbox.\n\nhelmterminal.dev/pricing\n\n- Helm Terminal`,
      html: wrap(`
        <div style="text-align:center;">
        ${heading('<span style="font-weight:700;color:#E6B94D;">$20/mo.</span> Helm Pro.')}
        ${subtext('Thesis monitoring, earnings, and the tax center. Max is $50/mo.')}
        </div>
        ${dividerLine()}
        ${sectionLabel('What Pro adds')}
        ${bulletItem('Thesis monitoring', 'Cited evidence the moment a thesis starts to break.')}
        ${bulletItem('Tax center', 'Harvestable losses with 30-day wash-sale screening.')}
        ${bulletItem('Earnings exposure', 'Know when your holdings report, before they move.')}
        ${bulletItem('Tailored brief', 'Conviction-led, built around your positions.')}
        <div style="height:12px;"></div>
        ${cta('Upgrade to Pro', 'https://helmterminal.dev/pricing')}
        ${dividerLine()}
        <p style="margin:16px 0 0;font-size:11px;color:#8A8A8A;text-align:center;">The free tier already includes the full terminal, AI analysis, daily brief, and actions inbox. Pro adds tax intelligence.</p>
      `),
    };

    case 30: return {
      subject: 'Still here when you are',
      text: `Hey ${name},\n\nIt's been a month since you signed up. No pressure.\n\nIf you want to see what Helm does without connecting accounts, try a free stock analysis on any US ticker: https://helmterminal.dev/analyze\n\nOr read today's market brief: https://helmterminal.dev/brief\n\nBoth are free, no login required.\n\n- Helm Terminal`,
      html: wrap(`
        <div style="text-align:center;">
        ${heading('Still here when <span style="font-weight:700;color:#E6B94D;">you are.</span>')}
        ${subtext("It's been a month. No pressure. Here are two ways to try Helm without connecting anything.")}
        </div>
        ${dividerLine()}
        ${sectionLabel('No account needed')}
        ${bulletItem('Free stock analysis', 'AI-powered analysis on any US ticker. No login.')}
        ${bulletItem("Today's market brief", 'What moved, what matters, what to watch. Updated every 5 minutes.')}
        <div style="height:12px;"></div>
        ${cta('Analyze a Ticker', 'https://helmterminal.dev/analyze')}
        <div style="height:8px;"></div>
        <p style="margin:0;text-align:center;"><a href="https://helmterminal.dev/brief" style="color:#E6B94D;font-size:12px;text-decoration:underline;">Or read today's brief</a></p>
        ${dividerLine()}
        <p style="margin:16px 0 0;font-size:10px;color:#8A8A8A;text-align:center;letter-spacing:0.3px;">Last email from us unless you take an action. We respect your inbox.</p>
      `),
    };

    default: return null;
  }
}

/** Which day indices to send */
// Day 0 welcome sent by signup route directly — not via drip
export const DRIP_DAYS = [1, 3, 7, 14, 21, 30] as const;

/* ── Watchlist Alert Email ── */

export interface WatchlistMover {
  ticker: string;
  price: number;
  changePct: number;
}

export function getWatchlistAlertTemplate(movers: WatchlistMover[], userName?: string): EmailTemplate | null {
  if (movers.length === 0) return null;
  const name = userName || 'there';

  const moverRows = movers.map(m => {
    const dir = m.changePct >= 0 ? '↑' : '↓';
    const color = m.changePct >= 0 ? '#4ADE80' : '#F87171';
    return `<tr>
      <td style="padding:8px 12px;font-family:monospace;font-size:14px;font-weight:700;color:#FAFAFA;border-bottom:1px solid rgba(255,255,255,0.06);">${m.ticker}</td>
      <td style="padding:8px 12px;font-family:monospace;font-size:14px;color:#8A8A8A;border-bottom:1px solid rgba(255,255,255,0.06);text-align:right;">$${m.price.toFixed(2)}</td>
      <td style="padding:8px 12px;font-family:monospace;font-size:14px;font-weight:700;color:${color};border-bottom:1px solid rgba(255,255,255,0.06);text-align:right;">${dir} ${Math.abs(m.changePct).toFixed(2)}%</td>
    </tr>`;
  }).join('');

  const biggest = movers.reduce((a, b) => Math.abs(b.changePct) > Math.abs(a.changePct) ? b : a);
  const subjectTicker = biggest.ticker;
  const subjectDir = biggest.changePct >= 0 ? 'up' : 'down';
  const subjectPct = Math.abs(biggest.changePct).toFixed(1);

  return {
    subject: `${subjectTicker} is ${subjectDir} ${subjectPct}% — Watchlist Alert`,
    text: `Hey ${name},\n\n${movers.length} ticker${movers.length > 1 ? 's' : ''} on your watchlist moved significantly today:\n\n${movers.map(m => `${m.ticker}: $${m.price.toFixed(2)} (${m.changePct >= 0 ? '+' : ''}${m.changePct.toFixed(2)}%)`).join('\n')}\n\nView details: ${DASHBOARD_URL}\n\n- Helm Terminal`,
    html: wrap(`
      ${heading(`Watchlist alert, ${name}.`)}
      ${subtext(`${movers.length} ticker${movers.length > 1 ? 's' : ''} on your watchlist made an unusually large move today.`)}
      <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:16px 0;">
        <tr>
          <td style="padding:8px 12px;font-family:monospace;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#525252;border-bottom:1px solid rgba(255,255,255,0.1);">Ticker</td>
          <td style="padding:8px 12px;font-family:monospace;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#525252;border-bottom:1px solid rgba(255,255,255,0.1);text-align:right;">Price</td>
          <td style="padding:8px 12px;font-family:monospace;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#525252;border-bottom:1px solid rgba(255,255,255,0.1);text-align:right;">Change</td>
        </tr>
        ${moverRows}
      </table>
      ${cta('Open Dashboard', DASHBOARD_URL)}
    `),
  };
}

/* ── Thesis Breach Alert Email ── */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface ThesisBreachParams {
  ticker: string;
  claim: string;
  excerpt: string;
  sourceTitle: string;
  sourceUrl?: string | null;
  userName?: string;
}

export function getThesisBreachTemplate(p: ThesisBreachParams): EmailTemplate {
  const claim = escapeHtml(p.claim);
  const excerpt = escapeHtml(p.excerpt);
  const sourceTitle = escapeHtml(p.sourceTitle);
  const safeUrl = p.sourceUrl && /^https?:\/\//i.test(p.sourceUrl) ? p.sourceUrl : null;
  const source = safeUrl
    ? `<a href="${escapeHtml(safeUrl)}" style="color:#E6B94D;">${sourceTitle}</a>`
    : sourceTitle;
  const url = `https://helmterminal.dev/dashboard/holdings/${p.ticker}`;
  return {
    subject: `Helm found a break in your ${p.ticker} thesis`,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body bgcolor="#FFFFFF" style="margin:0;padding:0;background:#FFFFFF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px 48px;"><table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width:500px;"><tr><td><table role="presentation" width="100%" bgcolor="#1E1E1E" style="background:#1E1E1E;border-radius:8px;"><tr><td height="2" bgcolor="#F87171" style="height:2px;line-height:2px;font-size:0;border-radius:8px 8px 0 0;">&nbsp;</td></tr><tr><td style="padding:36px 40px 12px;"><p style="margin:0;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#F87171;font-family:monospace;">Helm &#183; thesis alert &#183; ${p.ticker}</p></td></tr><tr><td style="padding:0 40px 8px;"><h1 style="margin:0;font-size:20px;font-weight:700;color:#FAFAFA;line-height:1.35;">I was monitoring ${p.ticker}, and new evidence broke one of your reasons for holding it.</h1></td></tr><tr><td style="padding:12px 40px 0;"><p style="margin:0 0 6px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#8F8F8F;font-family:monospace;">Your pillar</p><p style="margin:0 0 18px;font-size:15px;color:#FAFAFA;line-height:1.6;">${claim}</p><p style="margin:0 0 6px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#8F8F8F;font-family:monospace;">What the record says</p><p style="margin:0 0 8px;font-size:15px;line-height:1.7;color:#D4D4D4;font-family:Georgia,'Times New Roman',serif;">&ldquo;${excerpt}&rdquo;</p><p style="margin:0 0 24px;font-size:12px;color:#8F8F8F;">Source: ${source}</p><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="#E6B94D" style="border-radius:6px;"><a href="${url}" target="_blank" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:700;color:#0A0A0A;text-decoration:none;">Review the evidence &rarr;</a></td></tr></table></td></tr><tr><td style="padding:20px 40px 28px;"><p style="margin:0;font-size:10px;color:#525252;">Status is derived from sourced evidence, never invented. Not financial advice.</p></td></tr></table></td></tr></table></td></tr></table></body></html>`,
    text: `I was monitoring ${p.ticker}, and new evidence broke one of your reasons for holding it.\n\nYour pillar: ${p.claim}\n\nWhat the record says: "${p.excerpt}"\nSource: ${p.sourceTitle}${p.sourceUrl ? ` (${p.sourceUrl})` : ''}\n\nReview the evidence: ${url}\n\nStatus is derived from sourced evidence, never invented. Not financial advice.`,
  };
}

/* ── Watch My Tickers: confirm + digest ── */

export function getWatchConfirmTemplate(tickers: string[], confirmUrl: string): EmailTemplate {
  const list = tickers.join(', ');
  return {
    subject: `Confirm your watch: ${list}`,
    text: `Helm will read the filings, news, and price action on ${list} and email you when something changes.\n\nConfirm your email to start: ${confirmUrl}\n\nIf you didn't request this, ignore this email and nothing will be sent.`,
    html: wrap(`
      ${heading(`One click and Helm starts <span style="font-weight:700;color:#E6B94D;">watching.</span>`)}
      ${subtext(`You asked Helm to watch <span style="color:#FAFAFA;font-family:monospace;">${escapeHtml(list)}</span>. We read the filings and the news so you don't have to, and email you only when something actually changes. Confirm to start:`)}
      ${cta('Start watching my tickers', confirmUrl)}
      <p style="margin:20px 0 0;font-size:11px;color:#525252;">If you didn't request this, ignore this email and nothing will be sent.</p>
    `),
  };
}

export interface WatchDigestTicker {
  ticker: string;
  verdict: string; // supports | contradicts | neutral | quiet
  claim: string;
  cite: string;
  sourceUrl: string;
  sourceType: string;
  /** Computed house-thesis health label (e.g. "Intact", "Under pressure"); omitted when no house thesis. */
  health?: string;
}

export function getWatchDigestTemplate(
  items: WatchDigestTicker[],
  opts: { unsubUrl: string; signupUrl: string; isRoundup: boolean },
): EmailTemplate {
  const active = items.filter((i) => i.verdict !== 'quiet');
  const quiet = items.filter((i) => i.verdict === 'quiet');

  const subject = opts.isRoundup
    ? `Quiet week on ${items.map((i) => i.ticker).join(', ')} — that's the point`
    : `Helm caught something on ${active.map((i) => i.ticker).join(', ')}`;

  const itemHtml = active.map((i) => {
    const color = i.verdict === 'contradicts' ? '#F87171' : i.verdict === 'supports' ? '#4ADE80' : '#8A8A8A';
    const label = i.verdict === 'contradicts' ? 'a reason weakened' : i.verdict === 'supports' ? 'a reason held' : 'noted';
    const src = i.sourceType === 'filing' ? 'From the filing' : 'From the reporting';
    const safeUrl = /^https?:\/\//i.test(i.sourceUrl) ? i.sourceUrl : null;
    return `
      <div style="margin:0 0 22px;">
        <p style="margin:0 0 4px;font-family:monospace;font-size:13px;"><span style="font-weight:700;color:#FAFAFA;">${escapeHtml(i.ticker)}</span> <span style="color:${color};text-transform:uppercase;font-size:10px;letter-spacing:0.12em;">&nbsp;${label}</span>${i.health ? `<span style="color:#8F8F8F;font-size:10px;text-transform:uppercase;letter-spacing:0.12em;">&nbsp;&middot;&nbsp;thesis: ${escapeHtml(i.health)}</span>` : ''}</p>
        ${i.claim ? `<p style="margin:0 0 6px;font-size:13px;color:#8F8F8F;">Watched reason: ${escapeHtml(i.claim)}</p>` : ''}
        <p style="margin:0 0 4px;font-size:14px;line-height:1.65;color:#D4D4D4;font-family:Georgia,'Times New Roman',serif;">&ldquo;${escapeHtml(i.cite)}&rdquo;</p>
        <p style="margin:0;font-size:11px;color:#525252;">${src}${safeUrl ? ` &middot; <a href="${escapeHtml(safeUrl)}" style="color:#E6B94D;">source</a>` : ''}</p>
      </div>`;
  }).join('');

  const quietHtml = quiet.length
    ? `<p style="margin:0 0 18px;font-size:13px;color:#8F8F8F;">Quiet on <span style="font-family:monospace;color:#D4D4D4;">${escapeHtml(quiet.map((q) => q.ticker).join(', '))}</span> — nothing in the filings or reporting touched the reasons investors watch these names. No news is the product working.</p>`
    : '';

  const textItems = active.map((i) => `${i.ticker} — ${i.verdict === 'contradicts' ? 'a reason weakened' : 'a reason held'}\n"${i.cite}"\n${i.sourceUrl}`).join('\n\n');
  const textQuiet = quiet.length ? `\n\nQuiet on ${quiet.map((q) => q.ticker).join(', ')} — nothing touched the watched reasons this week.` : '';

  return {
    subject,
    text: `${opts.isRoundup ? 'Your weekly watch roundup.' : 'Helm caught something on your tickers.'}\n\n${textItems}${textQuiet}\n\nSee the full picture with a free account: ${opts.signupUrl}\n\nUnsubscribe: ${opts.unsubUrl}\n\nEvidence is quoted verbatim from public sources, never invented. Not financial advice.`,
    html: wrap(`
      ${heading(opts.isRoundup ? 'Quiet week. <span style="font-weight:700;color:#E6B94D;">That’s the point.</span>' : 'Helm caught <span style="font-weight:700;color:#E6B94D;">something.</span>')}
      ${subtext(opts.isRoundup ? 'Helm read the filings and reporting on your tickers all week. Here is the honest verdict:' : 'New evidence landed on the tickers you watch:')}
      ${itemHtml}
      ${quietHtml}
      ${cta('See the full picture, free account', opts.signupUrl)}
      <p style="margin:24px 0 0;font-size:10px;color:#525252;">Evidence is quoted verbatim from public sources, never invented. Not financial advice. <a href="${escapeHtml(opts.unsubUrl)}" style="color:#525252;">Unsubscribe</a></p>
    `),
  };
}

/* ── Material portfolio events ──────────────────────────────────────────────
 *
 * The other half of the alert story. A thesis breach says a reason stopped
 * being true; this says something moved in the book itself: concentration,
 * a harvestable loss, earnings exposure, idle cash.
 *
 * One email per person per run, never one per finding. Six separate emails is
 * not six times the signal, it is an unsubscribe.
 */

export interface MaterialEventLine {
  priority: string;
  title: string;
  description: string;
}

/** Insight titles are generated with raw arithmetic and reach here as things
 *  like "$62,745.4 tax-loss harvesting opportunity". Cents on an estimate are
 *  false precision, and in a subject line they read as a bug. Rounds to the
 *  dollar and groups thousands; changes nothing else about the sentence. */
export function tidyAmounts(text: string): string {
  return text.replace(/\$\s?([\d,]+(?:\.\d+)?)/g, (whole, num: string) => {
    const n = Number(num.replace(/,/g, ''));
    if (!Number.isFinite(n)) return whole;
    return `$${Math.round(n).toLocaleString('en-US')}`;
  });
}

/** Some insight titles are written as action prompts: "Trim AAPL?", "Harvest
 *  the loss on PRIM?". Inside the terminal those sit directly above the
 *  evidence that produced them and the figures behind it. In a subject line
 *  they arrive alone, on a lock screen, reading as an instruction from a
 *  company that is not a registered investment adviser. The body still carries
 *  them word for word, unchanged from what the person sees in the app; the
 *  subject is chosen from a line that states a fact instead. */
const ACTION_SHAPED = /^(trim|harvest|sell|buy|add|rebalance|consider|reduce|close|exit|move)\b/i;

/** The findings as a block, for embedding in another email.
 *
 *  The morning brief and the standalone alert say the same thing in the same
 *  words; which envelope carries it depends only on whether a brief is already
 *  going out to that person. Two Helm emails in the same minute is worse than
 *  either of them, so the brief absorbs the block and the standalone email is
 *  reserved for people not receiving one. */
export function materialEventsBlock(events: MaterialEventLine[]): { html: string; text: string } | null {
  if (events.length === 0) return null;
  const rows = events.map((e) => {
    const isCritical = e.priority === 'critical';
    const chipColor = isCritical ? '#F87171' : '#E6B94D';
    return `<tr><td style="padding:0 0 16px;">
<p style="margin:0 0 5px;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${chipColor};font-family:monospace;">${isCritical ? 'Critical' : 'Worth a look'}</p>
<p style="margin:0 0 3px;font-size:15px;font-weight:700;color:#FAFAFA;line-height:1.4;">${escapeHtml(tidyAmounts(e.title))}</p>
<p style="margin:0;font-size:13px;color:#B4B4B4;line-height:1.6;">${escapeHtml(tidyAmounts(e.description))}</p>
</td></tr>`;
  }).join('');
  return {
    html: `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;">
<tr><td style="padding:0 0 12px;border-top:1px solid rgba(255,255,255,0.10);"></td></tr>
<tr><td style="padding:0 0 14px;"><p style="margin:0;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#8F8F8F;font-family:monospace;">${events.length === 1 ? 'And one thing in your book' : `And ${events.length} things in your book`}</p></td></tr>
${rows}</table>`,
    text: [
      '',
      events.length === 1 ? 'And one thing in your book:' : `And ${events.length} things in your book:`,
      '',
      events
        .map((e) => `${e.priority === 'critical' ? '[critical] ' : ''}${tidyAmounts(e.title)}\n${tidyAmounts(e.description)}`)
        .join('\n\n'),
    ].join('\n'),
  };
}

export function getMaterialEventsTemplate(
  events: MaterialEventLine[],
  opts: { unsubUrl: string },
): EmailTemplate | null {
  if (events.length === 0) return null;
  const url = 'https://helmterminal.dev/dashboard/actions';
  const stated = events.find((e) => !ACTION_SHAPED.test(e.title.trim()));
  const more = events.length - 1;
  // Every line is an action prompt: say how many there are and let the person
  // open the inbox, rather than putting the prompt in the subject.
  const subject = stated
    ? (more > 0
      ? `${tidyAmounts(stated.title)}, and ${more} more in your portfolio`
      : tidyAmounts(stated.title))
    : `${events.length === 1 ? 'One thing' : `${events.length} things`} Helm flagged on your book`;

  const rows = events.map((e) => {
    const isCritical = e.priority === 'critical';
    const chipColor = isCritical ? '#F87171' : '#E6B94D';
    return `<tr><td style="padding:0 0 20px;">
<p style="margin:0 0 6px;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${chipColor};font-family:monospace;">${isCritical ? 'Critical' : 'Worth a look'}</p>
<p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#FAFAFA;line-height:1.4;">${escapeHtml(tidyAmounts(e.title))}</p>
<p style="margin:0;font-size:14px;color:#B4B4B4;line-height:1.6;">${escapeHtml(tidyAmounts(e.description))}</p>
</td></tr>`;
  }).join('');

  const textLines = events
    .map((e) => `${e.priority === 'critical' ? '[critical] ' : ''}${tidyAmounts(e.title)}\n${tidyAmounts(e.description)}`)
    .join('\n\n');

  return {
    subject,
    text: `Helm read your book this morning. ${events.length === 1 ? 'One thing' : `${events.length} things`} worth your attention:\n\n${textLines}\n\nOpen the inbox: ${url}\n\nEvery figure is computed from the positions in your linked accounts. Not financial advice.\nStop these alerts: ${opts.unsubUrl}`,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body bgcolor="#FFFFFF" style="margin:0;padding:0;background:#FFFFFF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px 48px;"><table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width:500px;"><tr><td><table role="presentation" width="100%" bgcolor="#1E1E1E" style="background:#1E1E1E;border-radius:8px;"><tr><td height="2" bgcolor="#E6B94D" style="height:2px;line-height:2px;font-size:0;border-radius:8px 8px 0 0;">&nbsp;</td></tr><tr><td style="padding:36px 40px 12px;"><p style="margin:0;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#8F8F8F;font-family:monospace;">Helm &#183; your portfolio</p></td></tr><tr><td style="padding:0 40px 20px;"><h1 style="margin:0;font-size:20px;font-weight:700;color:#FAFAFA;line-height:1.35;">I read your book this morning. ${events.length === 1 ? 'One thing is' : `${events.length} things are`} worth your attention.</h1></td></tr><tr><td style="padding:0 40px;"><table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">${rows}</table></td></tr><tr><td style="padding:4px 40px 0;"><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="#E6B94D" style="border-radius:6px;"><a href="${url}" target="_blank" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:700;color:#0A0A0A;text-decoration:none;">Open the inbox &rarr;</a></td></tr></table></td></tr><tr><td style="padding:24px 40px 28px;"><p style="margin:0;font-size:10px;color:#525252;line-height:1.6;">Every figure is computed from the positions in your linked accounts. Not financial advice. <a href="${escapeHtml(opts.unsubUrl)}" style="color:#525252;">Stop these alerts</a></p></td></tr></table></td></tr></table></td></tr></table></body></html>`,
  };
}
