// Isolated local UI checks. All APIs are fixtures; no customer session or writes.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const origin = 'http://127.0.0.1:3000';
const output = path.resolve('test-screenshots/app-account-ux');
const moves = [
  { ticker: 'NVDA', name: 'NVIDIA', changePct: 1.8, dollarImpact: 410 },
  { ticker: 'AAPL', name: 'Apple', changePct: -0.9, dollarImpact: -180 },
];

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const checks = [];
  try {
    for (const width of [320, 390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: 'reduce' });
      await context.addInitScript(() => {
        localStorage.setItem('helm-cookie-consent', 'rejected');
        localStorage.setItem('helm-preview-tier', 'pro');
        localStorage.setItem('helm-preview-datastate', 'demo');
        localStorage.setItem('helm:conviction-collapsed', '1');
        sessionStorage.setItem('helm_demo_mode', '1');
      });
      await context.route('**/*', route => {
        const req = route.request(), url = new URL(req.url());
        if (url.origin !== origin || !['GET', 'HEAD'].includes(req.method())) return route.abort();
        if (!url.pathname.startsWith('/api/')) return route.continue();
        const data = url.pathname === '/api/user/profile' ? { profile: { full_name: 'Sample portfolio' } }
          : url.pathname === '/api/user/tier' ? { tier: 'pro', realTier: 'pro' }
          : url.pathname === '/api/plaid/health' ? { lastSync: null, itemCount: 0, errorCount: 0, items: [] }
          : url.pathname === '/api/dashboard/brief' ? { allHoldings: moves, movers: moves }
          : url.pathname === '/api/dashboard/watchlist' ? { watchlist: [] }
          : url.pathname === '/api/market/intelligence' ? { intelligence: [] } : null;
        return route.fulfill({ status: data ? 200 : 401, contentType: 'application/json', body: JSON.stringify(data || { error: 'Isolated test session' }) });
      });
      const page = await context.newPage();
      const errors = [];
      const blockedIntegrations = [];
      page.on('pageerror', e => {
        if (e.message === 'Failed to load Stripe.js') blockedIntegrations.push(e.message);
        else errors.push(e.message);
      });
      await page.goto(origin + '/testing/redesign', { waitUntil: 'networkidle', timeout: 120000 });
      for (const [name, appPath] of [
        ['accounts', '/dashboard/accounts'], ['analyze', '/dashboard/analyze'],
        ['manual', '/dashboard/portfolio/add'], ['portfolio', '/dashboard/portfolio'],
      ]) {
        await page.locator('#preview-screen').selectOption(appPath);
        await page.locator('#main-content h1').first().waitFor();
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(600);
        const dimensions = await page.evaluate(() => ({
          viewport: document.documentElement.clientWidth,
          scroll: document.documentElement.scrollWidth,
          heading: document.querySelector('#main-content h1')?.textContent,
        }));
        // The workbench bar stays visible to make the fixture context explicit.
        await page.screenshot({ path: path.join(output, `${name}-${width}.png`), animations: 'disabled' });
        checks.push({ name, width, ...dimensions, overflow: dimensions.scroll > dimensions.viewport + 1 });
        if (name === 'accounts') {
          const card = page.getByRole('button', { name: /^View .* account details$/ }).first();
          await card.focus();
          await page.keyboard.press('Enter');
          await page.getByRole('dialog').waitFor();
          const focusedInside = await page.getByRole('dialog').evaluate(el => el.contains(document.activeElement));
          await page.screenshot({ path: path.join(output, `account-details-${width}.png`), animations: 'disabled' });
          await page.keyboard.press('Escape');
          const focusReturned = await card.evaluate(el => el === document.activeElement);
          checks.push({ name: 'account-keyboard-dialog', width, focusedInside, focusReturned });
          if (!focusedInside || !focusReturned) throw new Error('Account dialog focus failed');
        }
      }
      checks.push({ width, pageErrors: [...new Set(errors)], expectedBlockedIntegrations: [...new Set(blockedIntegrations)] });
      await context.close();
    }
    fs.writeFileSync(path.join(output, 'audit.json'), JSON.stringify(checks, null, 2));
    console.log(JSON.stringify(checks));
    if (checks.some(check => check.overflow || check.pageErrors?.length)) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
