/**
 * Post-signup drip email templates.
 * Plain text + minimal HTML. No heavy templates.
 */

const DASHBOARD_URL = 'https://helmterminal.dev/dashboard';
const ACCOUNTS_URL = 'https://helmterminal.dev/dashboard/accounts';

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

function wrap(body: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;">
<div style="margin-bottom:32px;">
  <span style="color:#E6B94D;font-size:20px;font-weight:bold;letter-spacing:1px;">HELM</span>
</div>
${body}
<div style="margin-top:40px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.06);">
  <p style="color:rgba(255,255,255,0.25);font-size:11px;margin:0;">
    Helm Financial Intelligence · <a href="https://helmterminal.dev" style="color:rgba(255,255,255,0.25);">helmterminal.dev</a><br>
    <a href="https://helmterminal.dev/dashboard/settings" style="color:rgba(255,255,255,0.25);">Manage email preferences</a>
  </p>
</div>
</div>
</body>
</html>`;
}

function cta(text: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;background:#E6B94D;color:#0A0A0A;padding:14px 28px;font-size:15px;font-weight:700;text-decoration:none;margin:8px 0;">${text}</a>`;
}

export function getTemplate(dayIndex: number, userName?: string): EmailTemplate | null {
  const name = userName || 'there';

  switch (dayIndex) {
    case 0: return {
      subject: 'Welcome to Helm',
      text: `Hey ${name},\n\nWelcome to Helm. You now have access to institutional-grade financial intelligence.\n\nNext step: connect your first account. It takes 30 seconds and unlocks your full dashboard.\n\n${ACCOUNTS_URL}\n\nRead-only access via Plaid. We can never move money.\n\n- The Helm Team`,
      html: wrap(`
        <h1 style="color:#FAFAFA;font-size:24px;font-weight:700;margin:0 0 16px;">Welcome to Helm, ${name}.</h1>
        <p style="color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;margin:0 0 24px;">
          You now have access to institutional-grade financial intelligence. Portfolio tracking, tax-loss harvesting, daily briefs, and AI-powered insights.
        </p>
        <p style="color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;margin:0 0 24px;">
          One step left: connect your first financial account.
        </p>
        ${cta('Connect Account — 30 seconds', ACCOUNTS_URL)}
        <p style="color:rgba(255,255,255,0.3);font-size:13px;margin:16px 0 0;">
          Read-only access via Plaid. We can never move money or place trades.
        </p>
      `),
    };

    case 1: return {
      subject: 'Your dashboard is waiting',
      text: `Hey ${name},\n\nYou signed up for Helm but haven't connected an account yet.\n\nOnce you link a brokerage or bank, Helm immediately shows you:\n- Your net worth across all accounts\n- Portfolio concentration risks\n- Tax-loss harvesting opportunities\n- A personalized daily brief\n\nTakes 30 seconds: ${ACCOUNTS_URL}\n\n- The Helm Team`,
      html: wrap(`
        <h1 style="color:#FAFAFA;font-size:22px;font-weight:700;margin:0 0 16px;">Your dashboard is waiting.</h1>
        <p style="color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;margin:0 0 20px;">
          You signed up for Helm but haven't connected an account yet. Here's what lights up the moment you do:
        </p>
        <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
          ${['Net worth across all accounts', 'Portfolio concentration risks', 'Tax-loss harvesting opportunities', 'Personalized daily market brief'].map(item =>
            `<tr><td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.8);font-size:14px;">
              <span style="color:#4ADE80;margin-right:8px;">&#9679;</span>${item}
            </td></tr>`
          ).join('')}
        </table>
        ${cta('Connect Account', ACCOUNTS_URL)}
      `),
    };

    case 3: return {
      subject: 'How Helm keeps your data safe',
      text: `Hey ${name},\n\nWe get it. Connecting financial accounts to a new platform takes trust.\n\nHere's how Helm protects your data:\n\n1. Read-only access. We see balances and transactions. We can never move money, place trades, or access your login credentials.\n\n2. Plaid infrastructure. Same system used by Venmo, Robinhood, and Coinbase. SOC 2 compliant.\n\n3. AES-256 encryption. Your data is encrypted in transit and at rest.\n\n4. You're in control. Disconnect any account at any time from Settings.\n\nReady to try it? ${ACCOUNTS_URL}\n\n- The Helm Team`,
      html: wrap(`
        <h1 style="color:#FAFAFA;font-size:22px;font-weight:700;margin:0 0 16px;">How Helm keeps your data safe.</h1>
        <p style="color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;margin:0 0 24px;">
          Connecting financial accounts to a new platform takes trust. Here's exactly how we protect yours.
        </p>
        ${[
          ['Read-only access', 'We see balances and transactions. We can never move money, place trades, or access your credentials.'],
          ['Plaid infrastructure', 'Same system used by Venmo, Robinhood, and Coinbase. SOC 2 Type II compliant.'],
          ['AES-256 encryption', 'Your data is encrypted in transit and at rest. Always.'],
          ['You control everything', 'Disconnect any account at any time from your settings page.'],
        ].map(([title, desc]) =>
          `<div style="margin-bottom:16px;padding-left:16px;border-left:2px solid #E6B94D;">
            <p style="color:#FAFAFA;font-size:14px;font-weight:600;margin:0 0 4px;">${title}</p>
            <p style="color:rgba(255,255,255,0.5);font-size:13px;line-height:1.5;margin:0;">${desc}</p>
          </div>`
        ).join('')}
        <div style="margin-top:24px;">
          ${cta('Connect Your Account', ACCOUNTS_URL)}
        </div>
      `),
    };

    case 7: return {
      subject: 'Last nudge: your Helm dashboard',
      text: `Hey ${name},\n\nJust one more note. You signed up for Helm a week ago, and your dashboard is still empty.\n\nIf you're not ready to connect a real account, you can try demo mode to see the dashboard with sample data: ${DASHBOARD_URL}\n\nWhen you're ready for real data, connecting takes 30 seconds: ${ACCOUNTS_URL}\n\nNo more emails about this. We'll be here when you're ready.\n\n- The Helm Team`,
      html: wrap(`
        <h1 style="color:#FAFAFA;font-size:22px;font-weight:700;margin:0 0 16px;">Last nudge.</h1>
        <p style="color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;margin:0 0 20px;">
          You signed up a week ago, and your dashboard is still empty. No pressure.
        </p>
        <p style="color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;margin:0 0 24px;">
          If you're not ready to connect a real account, try <a href="${DASHBOARD_URL}" style="color:#E6B94D;">demo mode</a> to see the dashboard with sample data.
        </p>
        ${cta('Connect Account', ACCOUNTS_URL)}
        <p style="color:rgba(255,255,255,0.3);font-size:13px;margin:16px 0 0;">
          No more emails about this. We'll be here when you're ready.
        </p>
      `),
    };

    default: return null;
  }
}

/** Which day indices to send */
export const DRIP_DAYS = [0, 1, 3, 7] as const;
