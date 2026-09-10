// Settings: the .helm-detail-heading banner, then the two-column layout —
// a 7-item side nav (desktop) and a section intro + body on the right.
// Wrapper classes match app/dashboard/settings/page.tsx's outer shell.

import { GhostBlock, GhostDetailHeading, GhostShell } from '@/components/dashboard/route-skeleton';

const NAV_ROWS = 7;

export default function SettingsLoading() {
  return (
    <GhostShell label="Loading your settings" className="helm-detail-page helm-settings bg-[var(--color-bg-base)]">
      <GhostDetailHeading action title="h-9 w-72" subtitle="w-[380px]" />
      <div className="helm-settings-layout">
        <aside className="helm-settings-navigation hidden lg:block">
          <ul className="space-y-0.5">
            {Array.from({ length: NAV_ROWS }, (_, i) => (
              <li key={i} className="flex items-center gap-3 px-3 py-2.5">
                <GhostBlock dim className="h-4 w-4 shrink-0 rounded" />
                <GhostBlock dim className="h-3.5 w-24" />
              </li>
            ))}
          </ul>
        </aside>

        <main className="helm-settings-content min-w-0">
          <div className="mb-6">
            <GhostBlock className="h-6 w-64 mb-2.5" />
            <GhostBlock dim className="h-3.5 w-80 max-w-full" />
          </div>
          <div className="space-y-3.5">
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] px-5 py-[18px]"
              >
                <GhostBlock className="h-4 w-40 mb-3" />
                <GhostBlock dim className="h-3.5 w-full mb-2" />
                <GhostBlock dim className="h-3.5 w-2/3" />
              </div>
            ))}
          </div>
        </main>
      </div>
    </GhostShell>
  );
}
