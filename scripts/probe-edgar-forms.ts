/** What getRecentFilings returns before and after the business-form filter. Read-only. */
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { getRecentFilings, BUSINESS_FORMS } = await import('../lib/edgar');
  const since = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);

  for (const t of process.argv.slice(2)) {
    const all = await getRecentFilings(t, since);
    const biz = await getRecentFilings(t, since, BUSINESS_FORMS);

    const count = (rows: { form: string }[]) => {
      const m = new Map<string, number>();
      for (const r of rows) m.set(r.form, (m.get(r.form) ?? 0) + 1);
      return [...m].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f}:${n}`).join(' ');
    };

    console.log(`\n${t}  (filings since ${since})`);
    console.log(`  unfiltered: ${all.length} -> ${count(all) || 'none'}`);
    console.log(`  business  : ${biz.length} -> ${count(biz) || 'none'}`);
    if (biz.length) {
      console.log(`  newest business filings:`);
      for (const f of biz.slice(0, 4)) console.log(`     ${f.form.padEnd(6)} ${f.filingDate}`);
    }
  }
}
main();
