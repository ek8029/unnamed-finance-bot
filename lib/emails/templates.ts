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
        ${bulletItem('Actions inbox', 'Not just data. What to do with it, prioritized.')}
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
        ${bulletItem('Daily brief', 'What moved overnight. What to do about it.')}
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
      subject: 'Founding member rate: $4.99/mo, locked forever',
      text: `Hey ${name},\n\nHelm's founding member rate is $4.99/mo, locked forever. 50 spots total.\n\nWhat you get:\n- Tax-loss harvesting with wash-sale detection\n- Earnings exposure alerts\n- Annual Portfolio Wrapped\n- Founding member badge\n\nThe free tier already includes the full terminal, AI analysis, daily brief, and actions inbox.\n\nhelmterminal.dev/pricing\n\n- Helm Terminal`,
      html: wrap(`
        <div style="text-align:center;">
        ${heading('<span style="font-weight:700;color:#E6B94D;">$4.99/mo.</span> Locked forever.')}
        ${subtext('Founding member rate. 50 spots. Once they fill, this price is gone.')}
        </div>
        ${dividerLine()}
        ${sectionLabel('What founding members get')}
        ${bulletItem('Tax-loss harvesting', 'Automated detection with wash-sale protection.')}
        ${bulletItem('Earnings exposure', 'Know when your holdings report, before they move.')}
        ${bulletItem('Portfolio Wrapped', 'Your year in review. Shareable.')}
        ${bulletItem('Founding badge', 'Early supporter recognition, permanently.')}
        <div style="height:12px;"></div>
        ${cta('Claim Founding Rate', 'https://helmterminal.dev/pricing')}
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
      ${subtext(`${movers.length} ticker${movers.length > 1 ? 's' : ''} on your watchlist moved more than 3% today.`)}
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
