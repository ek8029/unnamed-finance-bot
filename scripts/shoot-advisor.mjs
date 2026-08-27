// Screenshot the advisor lab screens for review. Untracked; run from the repo
// root so `playwright` resolves. Usage: node scripts/shoot-advisor.mjs [width...]
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const OUT = 'C:/Users/Evan/AppData/Local/Temp/claude/C--Users-Evan-Desktop-unnamed-fintech-bot/50c17c9c-d9a9-4477-a304-6ee244cb49d5/scratchpad/shots';
mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:3000/testing/advisor';
const SCREENS = ['', '/book', '/book?view=name', '/client', '/note', '/digest', '/consent', '/compliance', '/precall'];
const widths = process.argv.slice(2).map(Number).filter(Boolean);
if (widths.length === 0) widths.push(1440);

// Site chrome that has nothing to do with the lab: the cookie banner, the
// dev preview widget and Next's dev tools button.
const HIDE = `
  nextjs-portal, [data-nextjs-toast], [data-next-badge-root] { display: none !important; }
`;

const browser = await chromium.launch();
for (const width of widths) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  for (const s of SCREENS) {
    const name = s ? s.slice(1).replace(/\?view=/, '-') : 'index';
    await page.goto(BASE + s, { waitUntil: 'networkidle', timeout: 120000 });
    await page.addStyleTag({ content: HIDE });
    // Anything fixed to the viewport that is not part of the lab is site chrome:
    // the cookie banner, the dev preview widget, Next's dev tools.
    await page.evaluate(() => {
      const root = document.querySelector('.adv-root');
      for (const el of Array.from(document.body.querySelectorAll('*'))) {
        if (root && root.contains(el)) continue;
        const cs = getComputedStyle(el);
        if (cs.position === 'fixed' || cs.position === 'sticky') el.remove();
      }
    });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${name}-${width}.png`, fullPage: true });
    // A section that scrolls sideways is invisible in a full-page shot, so say so.
    const clipped = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.adv-section, .adv-root'))
        .filter((el) => el.scrollWidth - el.clientWidth > 2)
        .map((el) => `${el.className.split(' ')[0]}+${el.scrollWidth - el.clientWidth}`),
    );
    console.log('shot', name, width, clipped.length ? `CLIPPED ${clipped.join(' ')}` : '');
  }
  await page.close();
}
await browser.close();
