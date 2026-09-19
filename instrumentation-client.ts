// HeyCatch 0.7 exposes init/identity/track methods but no opt-out or teardown.
// Initializing it here bypasses account privacy preferences before hydration
// and leaves its automatic capture running after a user opts out. Keep it
// paused until its SDK supports revocable consent. PostHog and Plausible are
// initialized through components/posthog-provider.tsx's preference gate.
export {};
