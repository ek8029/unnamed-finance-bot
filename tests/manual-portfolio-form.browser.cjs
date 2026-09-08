// Run: node tests/manual-portfolio-form.browser.cjs
// Real component in a fresh browser; every request is fulfilled locally.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { build } = require('esbuild');
const { chromium } = require('playwright');

(async () => {
  const bundle = await build({
    absWorkingDir: path.resolve(__dirname, '..'),
    stdin: {
      contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {ManualPortfolioForm} from './components/manual-portfolio-form'; createRoot(document.getElementById('root')).render(<ManualPortfolioForm onComplete={() => {window.completed = true;}} />);`,
      resolveDir: path.resolve(__dirname, '..'), loader: 'tsx',
    },
    bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    tsconfigRaw: { compilerOptions: { jsx: 'react-jsx' } },
    define: { 'process.env.NODE_ENV': '"test"' },
    plugins: [{ name: 'demo-context-fixture', setup(builder) {
      builder.onResolve({ filter: /^@\/contexts\/demo-context$/ }, () => ({ path: 'demo-context', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export function useDemo(){return {disableDemo(){}}}', loader: 'js' }));
      // Resolve within explicit workspace paths: the Windows sandbox need not
      // grant the compiler access to scan ancestor directories for configuration.
      builder.onResolve({ filter: /.*/ }, args => {
        let candidate = args.path.startsWith('@/') ? path.resolve(__dirname, '..', args.path.slice(2))
          : args.path.startsWith('.') ? path.resolve(args.resolveDir, args.path) : null;
        if (candidate) {
          for (const suffix of ['', '.tsx', '.ts', '.js', '.json', '/index.js']) {
            if (fs.existsSync(candidate + suffix) && fs.statSync(candidate + suffix).isFile()) return { path: candidate + suffix };
          }
        }
        return { path: require.resolve(args.path, { paths: [args.resolveDir || path.resolve(__dirname, '..')] }) };
      });
    } }],
  });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const requests = [];
    const unexpected = [];
    const origin = 'http://localhost:43217';
    let userId = 'user-a';
    let reply = { status: 503, body: { error: 'Uncertain save' } };
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) { unexpected.push(url.href); await route.abort(); return; }
      if (url.pathname === '/api/auth/session') {
        await route.fulfill({ json: { user: userId ? { id: userId } : null } }); return;
      }
      if (url.pathname === '/api/portfolio/manual') {
        requests.push(route.request().postDataJSON());
        await route.fulfill({ status: reply.status, json: reply.body }); return;
      }
      if (url.pathname === '/bundle.js') { await route.fulfill({ contentType: 'application/javascript', body: bundle.outputFiles[0].text }); return; }
      if (url.pathname === '/login') { await route.fulfill({ contentType: 'text/html', body: '<p>Mock sign-in</p>' }); return; }
      await route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div><script src="/bundle.js"></script></body></html>' });
    });
    const destination = `${origin}/dashboard/portfolio/add`;
    const ticker = number => page.getByLabel(`Position ${number} ticker`, { exact: true });
    const shares = number => page.getByLabel(`Position ${number} shares`, { exact: true });
    const waitEnabled = async name => {
      const button = page.getByRole('button', { name, exact: true });
      await button.waitFor();
      await page.waitForFunction(label => [...document.querySelectorAll('button')].some(button => button.textContent.trim() === label && !button.disabled), name);
      return button;
    };
    const stored = () => page.evaluate(() => sessionStorage.getItem('helm.manual-save.pending.v1:user-a'));

    await page.goto(destination);
    await waitEnabled('Save positions');
    await ticker(1).fill('AAPL'); await shares(1).fill('1');
    await page.getByRole('button', { name: 'Save positions', exact: true }).click();
    await waitEnabled('Retry safely');
    assert.equal(await ticker(1).isDisabled(), true);
    const original = requests[0];
    assert.equal(JSON.parse(await stored()).request.requestId, original.requestId);

    reply = { status: 401, body: { error: 'Unauthorized' } };
    await page.getByRole('button', { name: 'Retry safely', exact: true }).click();
    await page.getByRole('link', { name: 'Sign in and return' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Retry safely', exact: true }).isDisabled(), true);
    assert.deepEqual(requests[1], original);
    await page.getByRole('link', { name: 'Sign in and return' }).click();
    await page.waitForURL('**/login?redirect=%2Fdashboard%2Fportfolio%2Fadd');
    assert.notEqual(await stored(), null);

    userId = 'user-b';
    await page.goto(destination);
    await waitEnabled('Save positions');
    assert.equal(await ticker(1).inputValue(), '');
    assert.equal(await page.getByRole('button', { name: 'Retry safely', exact: true }).count(), 0);
    userId = 'user-a';
    await page.goto(destination);
    await waitEnabled('Retry safely');
    assert.equal(await ticker(1).inputValue(), 'AAPL');
    reply = { status: 200, body: { success: true, added: 1, failed: [] } };
    await page.getByRole('button', { name: 'Retry safely', exact: true }).click();
    await page.getByText('Portfolio saved', { exact: true }).waitFor();
    assert.deepEqual(requests[2], original);
    assert.equal(await stored(), null);

    await page.goto(destination);
    await waitEnabled('Save positions');
    await ticker(1).fill('NVDA'); await shares(1).fill('2');
    reply = { status: 503, body: { error: 'Uncertain save' } };
    await page.getByRole('button', { name: 'Save positions', exact: true }).click();
    await waitEnabled('Retry safely');
    const beforeDiscard = requests.length;
    assert.equal(await page.getByText(/it does not delete saved positions/).count(), 1);
    await page.getByRole('button', { name: 'Stop retrying and review positions' }).click();
    await waitEnabled('Save positions');
    assert.equal(await stored(), null);
    assert.equal(requests.length, beforeDiscard);

    await ticker(1).fill('AAPL'); await shares(1).fill('1');
    reply = { status: 200, body: { success: true, added: 0, failed: [{ ticker: 'AAPL', rowIndex: 0, code: 'EXISTING_POSITION', retryable: false }] } };
    await page.getByRole('button', { name: 'Save positions', exact: true }).click();
    await page.getByRole('link', { name: 'Review and edit existing positions' }).waitFor();
    assert.equal(await ticker(1).isDisabled(), false);
    assert.equal(await stored(), null);
    assert.equal((await page.getByRole('alert').innerText()).includes('try again shortly'), false);

    await page.getByRole('button', { name: 'Add position', exact: true }).click();
    await ticker(2).fill('aapl'); await shares(2).fill('2');
    const beforeDuplicate = requests.length;
    await page.getByRole('button', { name: 'Save positions', exact: true }).click();
    await page.getByText('Enter AAPL once. A manual account keeps one position per ticker.', { exact: true }).waitFor();
    assert.equal(requests.length, beforeDuplicate);
    assert.equal(await stored(), null);
    assert.deepEqual(unexpected, []);
    process.stdout.write('4 manual-form browser checks passed: 401/login recovery, owner isolation, discard without writes, existing/duplicate position handling. All endpoints mocked.\n');
  } finally { await browser.close(); }
})().catch(error => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
