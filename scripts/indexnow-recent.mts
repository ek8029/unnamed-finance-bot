// Submit recently modified URLs from the live sitemap to IndexNow (Bing, Yandex,
// and the answer engines that read Bing's index).
//
// Why this exists: lib/indexnow.ts has been wired since May, but its only callers
// are the admin actions for masthead and thesis pages. Blog posts and the tool
// pages ship through git and a Vercel deploy, so nothing ever told Bing about
// them. This reads the sitemap production is serving, keeps entries whose
// <lastmod> falls inside the window, and submits them in one request.
//
// Usage (from the repo root, after the deploy is promoted):
//   npx tsx scripts/indexnow-recent.mts             dry run, last 3 days, /blog and /tools only
//   npx tsx scripts/indexnow-recent.mts --days 7    dry run, last 7 days
//   npx tsx scripts/indexnow-recent.mts --all       include every sitemap entry (the analyze,
//                                                    compare and thesis clusters stamp today's
//                                                    date because their data changes daily)
//   npx tsx scripts/indexnow-recent.mts --submit    actually submit
//
// INDEXNOW_KEY comes from .env.local and must match the key file served at
// https://helmterminal.dev/<key>.txt. The script never prints the key.
import { config } from 'dotenv';
config({ path: '.env.local' });
import { recentSitemapUrls, submitToIndexNow } from '../lib/indexnow';

const args = process.argv.slice(2);
const submit = args.includes('--submit');
const daysIdx = args.indexOf('--days');
const days = daysIdx >= 0 ? Number(args[daysIdx + 1]) : 3;
if (!Number.isFinite(days) || days <= 0) throw new Error('--days must be a positive number');

const res = await fetch('https://helmterminal.dev/sitemap.xml');
if (!res.ok) throw new Error(`sitemap fetch failed: ${res.status}`);
const xml = await res.text();

const all = args.includes('--all');
const EDITED_CONTENT = ['https://helmterminal.dev/blog/', 'https://helmterminal.dev/tools'];
const urls = recentSitemapUrls(xml, new Date(), days).filter(
  (u) => all || EDITED_CONTENT.some((p) => u.startsWith(p)),
);
console.log(`${urls.length} URL(s) with lastmod in the last ${days} day(s)${all ? '' : ' under /blog and /tools'}:`);
for (const u of urls) console.log('  ' + u);

if (!submit) {
  console.log('\nDry run. Add --submit to send these to IndexNow.');
} else if (urls.length === 0) {
  console.log('\nNothing to submit.');
} else {
  const out = await submitToIndexNow(urls);
  console.log('\nIndexNow response:', JSON.stringify(out));
  if (!out.ok) process.exitCode = 1;
}
