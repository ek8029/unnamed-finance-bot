'use client';

import { useLayoutEffect } from 'react';
import posthog from 'posthog-js';
import { createSurveyDeferral } from '@/lib/survey-deferral';

const policy = createSurveyDeferral(deferred => {
  if (typeof document === 'undefined') return;
  document.documentElement.toggleAttribute('data-helm-surveys-deferred', deferred);
  if (deferred) {
    // Cancel already scheduled popovers before pausing subsequent eligibility checks.
    posthog.getSurveys(surveys => surveys.forEach(survey => posthog.cancelPendingSurvey(survey.id)));
  }
  // Unlike automatic-display, this flag is also checked by an already loaded survey manager.
  posthog.set_config({ disable_surveys: deferred });
});

export function startSurveyDeferral() { policy.start(); }

export function useSurveyDeferral(active: boolean) {
  useLayoutEffect(() => {
    if (!active) return;
    return policy.hold();
  }, [active]);
}
