-- Migration 062: link realized capital gains to the account they happened in
-- Date: 2026-08-04
--
-- Why: IRC §408(e)(1) exempts individual retirement accounts from tax, so a
-- disposition inside an IRA, 401(k), HSA or 529 is not reported on Form 8949 or
-- Schedule D at all. capital_gains carried no account reference, so the Form
-- 8949 export had no way to exclude those rows — once realized gains are
-- populated from a whole-book Plaid sync that includes retirement accounts, a
-- tax-exempt IRA sale would appear on the user's 8949, overstating proceeds and
-- gain and creating a 1099-B mismatch.
--
-- Nullable on purpose: existing rows predate the column, and the Form 8949 route
-- treats a NULL account_id as "cannot classify" and says so on the artifact
-- rather than silently assuming the disposition was taxable.

ALTER TABLE capital_gains
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES linked_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_capital_gains_account ON capital_gains(account_id);

COMMENT ON COLUMN capital_gains.account_id IS
  'Linked account the disposition occurred in. NULL means unknown — the Form 8949 export cannot then tell whether the row is a taxable disposition or a tax-exempt retirement-account trade (IRC 408(e)(1)).';
