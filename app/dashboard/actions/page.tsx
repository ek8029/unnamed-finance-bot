import { createClient } from '@/lib/supabase/server';
import { getUserTier, tierAtLeast } from '@/lib/tier';
import { readInsights } from '@/lib/insights-reader';
import { ActionsClient, type ActionItem } from './actions-client';

export const metadata = { title: 'Actions' };

export default async function ActionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initialActions: ActionItem[] = [];
  let isPro = false;
  let initialError: string | null = null;

  if (user) {
    const tier = await getUserTier(user.id);
    isPro = tierAtLeast(tier, 'pro');
    try {
      initialActions = await readInsights(supabase, user, {}, isPro);
    } catch (error) {
      console.error('Error loading actions:', error);
      initialError = 'Your saved actions could not be loaded. Try refreshing the page.';
    }
  }

  return <ActionsClient initialActions={initialActions} isPro={isPro} initialError={initialError} />;
}
