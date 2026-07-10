-- 054: newsletter plumbing for This Week at Helm.
-- Opt-out pref (default on, one-click unsubscribe) + send-once stamp.
alter table user_preferences add column if not exists notification_weekly_update boolean default true;
alter table weekly_updates add column if not exists emailed_at timestamptz;
