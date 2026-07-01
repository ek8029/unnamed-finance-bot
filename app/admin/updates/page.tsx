import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isThesisUser } from '@/lib/thesis-access';
import { getAllUpdates, draftMarketSection } from '@/lib/content/weekly-updates';
import { WeeklyEditor } from '@/components/admin/weekly-editor';

export const dynamic = 'force-dynamic';

export default async function AdminUpdatesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isThesisUser(user?.email)) notFound();

  const [updates, marketDraft] = await Promise.all([getAllUpdates(), draftMarketSection()]);

  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
      <div className="container mx-auto max-w-3xl px-6 py-12">
        <header className="mb-8">
          <h1 className="text-[28px] font-bold tracking-tight">This Week at Helm</h1>
          <p className="mt-2 text-[15px] text-[var(--color-text-muted)]">
            Write the weekly update once. It publishes to <span className="text-[var(--color-gold)]">/this-week</span>,
            shows on the Masthead, and becomes the Monday email. The market section is pre-drafted from real thesis
            activity: edit it, do not invent.
          </p>
        </header>
        <WeeklyEditor updates={updates} marketDraft={marketDraft} />
      </div>
    </main>
  );
}
