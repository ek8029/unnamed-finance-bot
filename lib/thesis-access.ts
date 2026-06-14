// lib/thesis-access.ts
// Hard allowlist gate for the thesis + agentic layer while it is shipped but not
// yet launched. Only allowlisted accounts can see or use any thesis feature; to
// everyone else the feature does not exist (routes 404, page 404s, nav hidden).
// This is the SECURITY boundary, on top of Supabase RLS. Pure + edge-safe so the
// middleware can import it.
//
// To launch to everyone: remove the gate calls (or make isThesisUser return true).

const THESIS_ALLOWLIST = new Set<string>([
  'evank8029@gmail.com',
]);

export function isThesisUser(email?: string | null): boolean {
  return !!email && THESIS_ALLOWLIST.has(email.trim().toLowerCase());
}
