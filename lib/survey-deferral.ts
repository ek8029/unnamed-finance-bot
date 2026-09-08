/** Overlapping onboarding/checkout holds share one cooldown. No user flags are persisted. */
export function createSurveyDeferral(apply: (deferred: boolean) => void, cooldownMs = 60_000) {
  const holds = new Set<symbol>();
  let started = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => { if (timer) clearTimeout(timer); timer = undefined; };
  const resume = () => {
    cancel();
    if (started && !holds.size) timer = setTimeout(() => { timer = undefined; if (!holds.size) apply(false); }, cooldownMs);
  };
  return {
    start() { started = true; apply(true); resume(); },
    hold() {
      const key = Symbol();
      holds.add(key);
      cancel();
      apply(true);
      return () => { if (holds.delete(key)) resume(); };
    },
  };
}

export function isSurveySensitiveRoute(pathname: string | null): boolean {
  return !!pathname && /^\/(signup|login|auth|testing)(\/|$)/.test(pathname);
}
