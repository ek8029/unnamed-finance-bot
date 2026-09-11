// The investor demo login. One place, because two flows need to recognise it.
//
// The address was already committed in components/onboarding/onboarding-flow-v2.tsx,
// so keeping it as the fallback publishes nothing new; DEMO_ACCOUNT_EMAIL
// overrides it without a deploy. It is a house account holding seeded positions,
// never a customer's.
const FALLBACK = 'test@helmterminal.dev';

export function demoAccountEmail(): string {
  return (process.env.DEMO_ACCOUNT_EMAIL || FALLBACK).toLowerCase();
}

/** True for the demo login only. A null or empty email is never the demo. */
export function isDemoAccount(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === demoAccountEmail();
}
