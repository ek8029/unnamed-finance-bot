type SavedPillar = { id: string; confirmed: boolean; lifecycle?: string; claim?: string; breaks_if?: string };
type SavedThesis = { thesis: { id: string; tracked: boolean }; pillars: SavedPillar[] };
export type OnboardingSaveResult = { thesisId: string; monitored: boolean; existing: boolean };

/** Advance only after persisted reasons can be read back. Safe to retry partial draft saves. */
export async function saveOnboardingReasons(input: {
  ticker: string; drafted?: boolean; pillars?: { id?: string }[];
  selected: string[]; customReason?: string; customBreaksIf?: string;
}, request: typeof fetch = fetch): Promise<OnboardingSaveResult> {
  if (!input.selected.length && !input.customReason) throw new Error('Choose at least one reason to save.');
  const path = `/api/thesis/${encodeURIComponent(input.ticker)}`;
  const read = async (): Promise<SavedThesis> => {
    const response = await request(path, { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not verify your saved reasons. Your choices are still here; please retry.');
    const data = await response.json() as SavedThesis;
    if (!data.thesis?.id || !Array.isArray(data.pillars)) throw new Error('Could not verify your saved reasons. Please retry.');
    return data;
  };
  const write = async (url: string, method: string, body?: unknown) => request(url, {
    method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  const requireOK = async (response: Response) => {
    if (response.ok) return;
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || 'Could not save all your choices. Please retry.');
  };
  let existing = false;
  if (input.drafted) {
    const before = await read();
    for (const id of input.selected) {
      await requireOK(await write(`/api/thesis/pillars/${encodeURIComponent(id)}`, 'PATCH', { confirmed: true }));
    }
    if (input.customReason && !before.pillars.some(p => p.confirmed && p.claim === input.customReason && p.breaks_if === input.customBreaksIf)) {
      await requireOK(await write(path, 'POST', { claim: input.customReason, breaks_if: input.customBreaksIf }));
    }
    // Never delete a previously confirmed reason. Missing drafts were already removed on a prior attempt.
    for (const p of input.pillars ?? []) {
      if (!p.id || input.selected.includes(p.id) || !before.pillars.some(saved => saved.id === p.id && !saved.confirmed)) continue;
      const response = await write(`/api/thesis/pillars/${encodeURIComponent(p.id)}`, 'DELETE');
      if (response.status !== 404) await requireOK(response);
    }
    const tracking = await write(path, 'PATCH', { tracked: true });
    if (tracking.status !== 403) await requireOK(tracking);
  } else {
    const response = await write('/api/thesis/adopt', 'POST', {
      ticker: input.ticker, pillarIds: input.selected,
      customReason: input.customReason || undefined, customBreaksIf: input.customBreaksIf || undefined,
    });
    existing = response.status === 409;
    if (!existing) await requireOK(response);
  }
  const saved = await read();
  const confirmed = saved.pillars.filter(p => p.confirmed && p.lifecycle !== 'dismissed');
  if (!confirmed.length || (input.drafted && input.selected.some(id => !confirmed.some(p => p.id === id))) ||
      (!existing && input.customReason && !confirmed.some(p => p.claim === input.customReason && p.breaks_if === input.customBreaksIf))) {
    throw new Error('Your reasons are not confirmed yet. Please retry; your choices are still here.');
  }
  return { thesisId: saved.thesis.id, monitored: saved.thesis.tracked === true, existing };
}
