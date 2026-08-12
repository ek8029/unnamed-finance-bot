import type { Metadata } from 'next';
import DashboardShell from './dashboard-shell';

/**
 * Server layout that exists only to own the terminal's browser-tab titles.
 *
 * The shell itself is a client component (sidebar, command palette, keyboard
 * nav) and client components cannot export metadata, so every terminal route
 * used to inherit the site-wide default and the tab read "Helm Terminal |
 * Agentic Thesis Monitoring..." no matter which screen you were on.
 *
 * The template is scoped to /dashboard rather than the root layout on purpose:
 * marketing pages already spell out their own suffix, and a root-level
 * template would double it on all forty of them.
 */
export const metadata: Metadata = {
  title: {
    default: 'Overview | Helm Terminal',
    template: '%s | Helm Terminal',
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
