import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { DashboardOnboarding } from '@/components/onboarding/dashboard-onboarding';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';
import { OnboardingFlowV2 } from '@/components/onboarding/onboarding-flow-v2';
import { OnboardingFlowV3 } from '@/components/onboarding/v3/onboarding-flow-v3';

// Only the existing flow internals are replaced. The real shared mount boundary
// determines whether any portfolio setup component can run at this destination.
vi.mock('@/components/onboarding/onboarding-flow', () => ({ OnboardingFlow: () => null }));
vi.mock('@/components/onboarding/onboarding-flow-v2', () => ({ OnboardingFlowV2: () => null }));
vi.mock('@/components/onboarding/v3/onboarding-flow-v3', () => ({ OnboardingFlowV3: () => null }));

describe.each([
  ['legacy', OnboardingFlow], ['v2', OnboardingFlowV2], ['v3', OnboardingFlowV3],
] as const)('%s onboarding route boundary', (variant, Flow) => {
  it('lets an explicit Classic thesis visit reach drafting without mounting setup or marking it complete', () => {
    const settled = vi.fn();
    expect(DashboardOnboarding({ pathname: '/dashboard/theses/classic', variant, onSettled: settled })).toBeNull();
    expect(settled).not.toHaveBeenCalled();
  });
  it.each(['/dashboard', '/dashboard/portfolio', '/dashboard/theses', '/dashboard/theses/classic-extra'])('retains normal setup at %s', pathname => {
    const onSettled = vi.fn();
    const element = DashboardOnboarding({ pathname, variant, onSettled })!;
    expect(React.isValidElement(element)).toBe(true);
    expect(element.type).toBe(Flow);
    expect(element.props.onSettled).toBe(onSettled);
  });
  it('offers normal setup again after leaving the thesis workspace', () => {
    const props = { variant, onSettled: vi.fn() };
    expect(DashboardOnboarding({ ...props, pathname: '/dashboard/theses/classic' })).toBeNull();
    expect(DashboardOnboarding({ ...props, pathname: '/dashboard/portfolio' })!.type).toBe(Flow);
  });
});
