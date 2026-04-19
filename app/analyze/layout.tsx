import { createClient } from '@/lib/supabase/server';
import DashboardLayout from '@/app/dashboard/layout';

/**
 * Analyze layout — detects auth and conditionally wraps in the dashboard shell.
 *
 * Logged-in users get the full sidebar so they can navigate back to the dashboard.
 * Anonymous visitors get the standalone public page (important for SEO — the
 * /analyze pages are the primary organic-traffic funnel).
 */
export default async function AnalyzeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    return <DashboardLayout>{children}</DashboardLayout>;
  }

  return <>{children}</>;
}
