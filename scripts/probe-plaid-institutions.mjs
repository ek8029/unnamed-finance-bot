// Does Plaid's link-token product config hide brokerages from the picker?
//
// bb7ed22 changed products from [transactions] to [investments] on the theory
// that requiring Transactions filtered investment-only brokerages out of Link,
// hiding Fidelity and Webull. That was never checked against Plaid. This checks
// it, from institution metadata, without needing to drive the Link UI.
//
//   node scripts/probe-plaid-institutions.mjs            # sandbox
//   node scripts/probe-plaid-institutions.mjs production # the real catalogue
//
// Read-only: searches the institution catalogue and reads product support. It
// creates no Item, touches no user and moves no money.
//
// Result on 2026-08-21 against PRODUCTION: every brokerage tested supports
// `transactions` as well as `investments`, so the old config rejected none of
// them, and Webull is not in Plaid's catalogue under any filter. The original
// diagnosis was wrong on both counts. Sandbox cannot answer this — its
// institutions are fixtures that advertise every product.
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env.local','utf8').split(/\r?\n/)
  .filter(l=>l&&!l.startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');
  return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')];}));
const MODE = process.argv[2] || env.PLAID_ENV || 'sandbox';
const HOST = `https://${MODE}.plaid.com`;
const SECRET = MODE === 'sandbox' ? env.PLAID_SECRET_SANDBOX : env.PLAID_SECRET;

const post = async (path, body) => {
  const r = await fetch(HOST + path, { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ client_id: env.PLAID_CLIENT_ID, secret: SECRET, ...body }) });
  return { ok: r.ok, json: await r.json() };
};

console.log(`env=${MODE}\n`);
console.log('institution'.padEnd(30) + 'investments'.padEnd(13) + 'transactions'.padEnd(14) + 'verdict');
console.log('-'.repeat(84));

let brokenByOldConfig = 0;
for (const q of ['Fidelity', 'Webull', 'Charles Schwab', 'Vanguard', 'Edward Jones', 'Robinhood']) {
  const s = await post('/institutions/search', { query: q, products: ['investments'], country_codes: ['US'] });
  const inst = s.json.institutions?.[0];
  if (!inst) { console.log(q.padEnd(30) + 'not in this environment'); continue; }
  const g = await post('/institutions/get_by_id', {
    institution_id: inst.institution_id, country_codes: ['US'],
    options: { include_optional_metadata: false },
  });
  const products = g.json.institution?.products ?? [];
  const inv = products.includes('investments');
  const txn = products.includes('transactions');
  if (inv && !txn) brokenByOldConfig++;
  const verdict = inv && !txn ? 'OLD CONFIG REJECTS IT' : inv && txn ? 'fine either way' : 'no investments support';
  console.log(inst.name.slice(0,28).padEnd(30) + String(inv).padEnd(13) + String(txn).padEnd(14) + verdict);
}
console.log('-'.repeat(84));
console.log(brokenByOldConfig > 0
  ? `${brokenByOldConfig} brokerage(s) support investments but NOT transactions.\nproducts:[transactions] rejected them on selection. bb7ed22 is the correct fix.`
  : 'Every brokerage here supports both products, so the old config would not have rejected any of them.');
