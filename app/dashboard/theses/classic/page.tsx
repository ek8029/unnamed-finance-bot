// /dashboard/theses/classic — the original theses page (cards/standings views,
// onboarding, drafting, ratify queue). The terminal table is the default at
// /dashboard/theses; this remains the creation wizard and the escape hatch.

'use client';

import { ClassicThesesPage } from '@/components/thesis/classic-theses-page';

export default function ClassicRoute() {
  return <ClassicThesesPage />;
}
