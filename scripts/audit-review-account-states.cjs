// Exercise actual account/search components with fixture APIs, no real session.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const origin = 'http://127.0.0.1:3000';
const output = path.resolve('test-screenshots/review-account-states');
const accounts = [
  { id: 'unknown', institution: 'Fixture Bank', account_name: 'Awaiting balances', account_type: 'brokerage', balance: null, sync_status: 'healthy', source: 'plaid' },
  { id: 'zero', institution: 'Fixture Bank', account_name: 'Actual zero', account_type: 'checking', balance: 0, sync_status: 'healthy', source: 'plaid' },
  { id: 'credit', institution: 'Fixture Bank', account_name: 'Card credit', account_type: 'credit_card', balance: -100, sync_status: 'healthy', source: 'plaid' },
];
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const width of [320, 390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: 'reduce' });
      await context.addInitScript(() => {
        localStorage.setItem('helm-cookie-consent', 'rejected');
        localStorage.setItem('helm-preview-tier', 'pro');
        localStorage.setItem('helm:conviction-collapsed', '1');
      });
      let healthFails = true;
      let accountFails = false;
      await context.route('**/*', route => {
        const req = route.request(), url = new URL(req.url());
        if (url.origin !== origin || !['GET', 'HEAD'].includes(req.method())) return route.abort();
        if (!url.pathname.startsWith('/api/')) return route.continue();
        const data = url.pathname === '/api/user/profile' ? { profile: { full_name: 'Fixture' } }
          : url.pathname === '/api/user/tier' ? { tier: 'pro', realTier: 'pro' }
          : url.pathname === '/api/accounts' && !accountFails ? { accounts, balanceHistory: [] }
          : url.pathname === '/api/plaid/health' && !healthFails ? { lastSync: null, itemCount: 1, errorCount: 1, items: [{ id: 'fixture-item', institution_name: 'Fixture Bank', status: 'error', last_balances_sync: null, last_transactions_sync: null }] }
          : url.pathname === '/api/dashboard/brief' ? { allHoldings: [{ ticker: 'BRK.B', name: 'Fixture share class', dollarImpact: 10, changePct: 1 }], movers: [] }
          : null;
        return route.fulfill({ status: data ? 200 : 503, contentType: 'application/json', body: JSON.stringify(data || { error: 'Fixture unavailable' }) });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', err => { if (err.message !== 'Failed to load Stripe.js') errors.push(err.message); });
      await page.goto(origin + '/testing/redesign', { waitUntil: 'networkidle', timeout: 120000 });
      // Workbench initializes demo state once. Remount Accounts against our API
      // fixtures instead; this storage belongs only to the isolated browser.
      await page.evaluate(() => sessionStorage.removeItem('helm_demo_mode'));
      await page.locator('#preview-screen').selectOption('/dashboard/accounts');
      const missing = page.locator('article').filter({ hasText: 'Awaiting balances' });
      await missing.getByText('Balance unavailable', { exact: true }).waitFor();
      assert.equal(await missing.getByText('$0', { exact: true }).count(), 0);
      const contentOutsideButton = await missing.evaluate(el => [...el.querySelectorAll('div')].some(node => node.textContent.trim() === 'Balance unavailable' && !node.closest('button')));
      assert.equal(contentOutsideButton, true);
      assert.equal(await page.getByRole('button', { name: 'Retry connection status', exact: true }).isEnabled(), true);
      const known = await page.locator('#main-content').innerText();
      assert.match(known, /Known account balances/i);
      assert.match(known, /1 account has no reported balance/);
      assert.match(known, /credit/);
      const card = missing.getByRole('button', { name: /account details/ });
      await card.focus(); await page.keyboard.press('Enter');
      await page.getByRole('dialog').getByText('Balance unavailable', { exact: true }).waitFor();
      await page.keyboard.press('Escape');
      assert.equal(await card.evaluate(el => document.activeElement === el), true);
      await page.screenshot({ path: path.join(output, `accounts-${width}.png`), animations: 'disabled' });
      healthFails = false;
      await page.locator('#preview-screen').selectOption('/dashboard/analyze');
      await page.getByRole('button', { name: 'Research BRK.B', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Research BRK.B', exact: true }).isDisabled(), true);
      await page.locator('#preview-screen').selectOption('/dashboard/accounts');
      await page.getByText('Needs attention', { exact: true }).first().waitFor();
      assert.equal(await page.getByRole('button', { name: 'Refresh connections', exact: true }).isEnabled(), true);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      assert.equal(overflow, false);
      accountFails = true;
      await page.locator('#preview-screen').selectOption('/dashboard/analyze');
      await page.locator('#preview-screen').selectOption('/dashboard/accounts');
      await page.getByText('Failed to fetch accounts', { exact: false }).first().waitFor();
      assert.equal(await page.getByRole('button', { name: 'Retry accounts', exact: true }).isEnabled(), true);
      results.push({ width, nullVersusZero: 'pass', cardContentOutsideButton: 'pass', keyboard: 'pass', healthFailureRecovery: 'enabled', allErrorRefresh: 'enabled', unsupportedResearch: 'disabled with explanation', accountFailure: 'shown', overflow, pageErrors: errors });
      assert.deepEqual(errors, []);
      await context.close();
    }
    fs.writeFileSync(path.join(output, 'audit.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
