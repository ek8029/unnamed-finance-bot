-- 066_portfolio_intraday_snapshots.sql
-- One point per user per intraday tick, so the dashboard can draw today.
--
-- portfolio_snapshots is one row per user per DAY, written by the 9:15 cron,
-- which is why the net-worth chart had no 1D range: nothing in the database
-- described the session. The five-minute tick (lib/market/intraday-tick.ts)
-- now appends the book's value here after every repricing, 9:30-16:00 ET.
--
-- Only the portfolio total is stored. Cash and liabilities do not move
-- intraday; the summary route adds them back so the series ends exactly on
-- the net worth the page displays (app/api/financial-summary/route.ts).
--
-- Rows older than seven days are pruned by the tick. Daily and monthly
-- ranges come from portfolio_snapshots / net_worth_snapshots as before.

create table if not exists portfolio_intraday_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  captured_at timestamptz not null default now(),
  total_value numeric(15, 2) not null
);

create index if not exists idx_portfolio_intraday_user_time
  on portfolio_intraday_snapshots (user_id, captured_at desc);

alter table portfolio_intraday_snapshots enable row level security;

-- Users read their own points; only the service role writes.
create policy "Users can view own intraday snapshots"
  on portfolio_intraday_snapshots for select
  using (auth.uid() = user_id);

comment on table portfolio_intraday_snapshots is
  'Portfolio value per user per five-minute tick during the US session; pruned after 7 days';
