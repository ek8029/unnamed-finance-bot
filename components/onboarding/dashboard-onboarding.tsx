'use client';

import React from 'react';
import { OnboardingFlow } from './onboarding-flow';
import { OnboardingFlowV2 } from './onboarding-flow-v2';
import { OnboardingFlowV3 } from './v3/onboarding-flow-v3';

/** Keep explicit thesis drafting ahead of optional portfolio setup in every cohort.
 * This does not mark setup complete: leaving Classic restores the usual gate. */
export function DashboardOnboarding({ pathname, variant, onSettled }: {
  pathname: string;
  variant: 'legacy' | 'v2' | 'v3';
  onSettled: () => void;
}) {
  if (pathname === '/dashboard/theses/classic') return null;
  if (variant === 'v3') return <OnboardingFlowV3 onSettled={onSettled} />;
  if (variant === 'v2') return <OnboardingFlowV2 onSettled={onSettled} />;
  return <OnboardingFlow onSettled={onSettled} />;
}
