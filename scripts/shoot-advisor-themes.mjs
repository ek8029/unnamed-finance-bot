// Shoot the advisor lab in every palette. Untracked; run from the repo root.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const OUT = 'C:/Users/Evan/AppData/Local/Temp/claude/C--Users-Evan-Desktop-unnamed-fintech-bot/50c17c9c-d9a9-4477-a304-6ee244cb49d5/scratchpad/shots';
mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:3000/testing/advisor';
const THEMES = ['paper', 'broadsheet', 'clinical', 'dusk', 'terminal', 'slate'];
const SHOTS = process.argv.slice(2).length ? process.argv.slice(2) : ['book', 'client', 'note', 'digest', 'consent', 'compliance', 'precall'];
const HIDE = 'nextjs-portal, [data-nextjs-toast], [data-next-badge-root] { display: none !important; }';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
for (const shot of SHOTS) {
  for (const theme of THEMES) {
    await page.goto(`${BASE}/${shot}?theme=${theme}`, { waitUntil: 'networkidle', timeout: 120000 });
    await page.addStyleTag({ content: HIDE });
    await page.evaluate(() => {
      const root = document.querySelector('.adv-root');
      for (const el of Array.from(document.body.querySelectorAll('*'))) {
        if (root && root.contains(el)) continue;
        const cs = getComputedStyle(el);
        if (cs.position === 'fixed' || cs.position === 'sticky') el.remove();
      }
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${shot}-${theme}.png`, fullPage: false });
    console.log('shot', shot, theme);
  }
}
await browser.close();
