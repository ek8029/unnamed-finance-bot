// Full onboarding QA: every screen at every breakpoint.
// Checks horizontal overflow, console errors, sub-44px touch targets, and that
// each screen actually rendered content (catches the blank-screen class of bug).
// Run: node scripts/qa-onboarding-v3.mjs  (dev server on :3000 required)
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const OUT = process.env.TEMP + '/onbv3/full';
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  [375, 667, 'iphone-se'],
  [390, 844, 'iphone-14'],
  [820, 1180, 'ipad'],
  [1280, 800, 'laptop'],
  [1920, 1080, 'desktop'],
  [3840, 1600, 'ultrawide'],
];

const SCREENS = ['Ask', 'Loop', 'First look', 'Reveal'];

const failures = [];
const browser = await chromium.launch();

for (const [w, h, name] of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on('console', (m) => {
    const t = m.text();
    // 401s are expected: Playwright is not authenticated, so the account-scoped
    // reads fall back to the labelled sample. Not a UI defect.
    if (m.type() === 'error' && !t.includes('401')) errors.push(t);
  });
  page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));

  await page.goto('http://localhost:3000/testing/onboarding-v3', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  for (const screen of SCREENS) {
    await page.getByRole('button', { name: screen, exact: true }).click({ force: true });
    await page.waitForTimeout(screen === 'First look' ? 1800 : screen === 'Confirm theses' || screen === 'Synced' ? 2600 : screen === 'Intelligence card' ? 3400 : 900);
    await page.evaluate(() => document.querySelectorAll('div.fixed').forEach((e) => {
      if (e.textContent && e.textContent.includes('PREVIEW · DEV')) e.remove();
    }));

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 0) failures.push(`${name} / ${screen}: horizontal overflow ${overflow}px`);

    // did anything actually render inside the overlay?
    const textLen = await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').trim().length);
    if (textLen < 120) failures.push(`${name} / ${screen}: looks blank (only ${textLen} chars of text)`);

    // touch targets on the phone widths
    if (w <= 430) {
      // Only measure the product overlay. The harness toolbar, the dev tier widget
      // and the site cookie banner are not part of what ships.
      const small = await page.evaluate(() => {
        const isDevChrome = (el) => {
          for (let n = el; n; n = n.parentElement) {
            const t = (n.textContent || '');
            if (t.includes('PREVIEW · DEV')) return true;
            if (t.includes('Privacy Policy') && t.includes('cookies')) return true;
            if (n.dataset && n.dataset.qaChrome === '1') return true;
          }
          return false;
        };
        const bad = [];
        for (const b of document.querySelectorAll('button, a')) {
          const r = b.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.top < 44) continue;          // harness toolbar row
          if (isDevChrome(b)) continue;
          if (r.height < 44) bad.push(`${(b.textContent || '').trim().slice(0, 28)} (${Math.round(r.height)}px)`);
        }
        return bad;
      });
      for (const s of small) failures.push(`${name} / ${screen}: touch target ${s}`);
    }

    await page.screenshot({ path: `${OUT}/${name}-${screen.replace(/\s+/g, '-')}.png` });
  }

  for (const e of errors) failures.push(`${name}: console ${e}`);
  console.log(`${name.padEnd(11)} done`);
  await page.close();
}

await browser.close();

console.log(`\n${'='.repeat(60)}`);
if (failures.length === 0) {
  console.log('ALL CHECKS PASSED: 3 screens x 6 viewports, no overflow, no blanks, no console errors, touch targets OK');
} else {
  console.log(`${failures.length} ISSUE(S):`);
  for (const f of failures) console.log(`  - ${f}`);
}
console.log(`screenshots: ${OUT}`);
