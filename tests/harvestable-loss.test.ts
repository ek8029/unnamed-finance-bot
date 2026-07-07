import { describe, it, expect } from 'vitest';
import { isRetirementAccount, isHarvestableLoss } from '../lib/tax-analysis';

describe('isRetirementAccount', () => {
  it('detects by Plaid subtype', () => {
    expect(isRetirementAccount('401k', null)).toBe(true);
    expect(isRetirementAccount('roth_ira', null)).toBe(true);
    expect(isRetirementAccount('hsa', null)).toBe(true);
    expect(isRetirementAccount('529', null)).toBe(true);
  });

  it('detects by account NAME when subtype is null (the live bug)', () => {
    expect(isRetirementAccount(null, 'Vanguard 401(k)')).toBe(true);
    expect(isRetirementAccount(null, 'Roth IRA')).toBe(true);
    expect(isRetirementAccount(null, 'Rollover IRA')).toBe(true);
    expect(isRetirementAccount(null, 'My 403b plan')).toBe(true);
    expect(isRetirementAccount(null, 'Fidelity HSA')).toBe(true);
    expect(isRetirementAccount(null, 'SEP-IRA')).toBe(true);
  });

  it('does NOT flag taxable accounts (no false positives that would hide real harvests)', () => {
    expect(isRetirementAccount(null, 'Individual Brokerage')).toBe(false);
    expect(isRetirementAccount('brokerage', 'Investment')).toBe(false);
    expect(isRetirementAccount(null, 'Designated Beneficiary IN')).toBe(false); // ambiguous → taxable
    expect(isRetirementAccount(null, 'Taxable Account')).toBe(false);
    expect(isRetirementAccount(null, null)).toBe(false);
  });
});

describe('isHarvestableLoss', () => {
  const taxable = { account_subtype: 'brokerage', account_name: 'Individual' };
  const ira = { account_subtype: null, account_name: 'Roth IRA' };

  it('harvestable: taxable account, priced, at a loss', () => {
    expect(isHarvestableLoss({ unrealised_gain_loss: -2500, total_value: 8000 }, taxable)).toBe(true);
  });
  it('not harvestable: loss in a retirement account', () => {
    expect(isHarvestableLoss({ unrealised_gain_loss: -2500, total_value: 8000 }, ira)).toBe(false);
  });
  it('not harvestable: position at a gain', () => {
    expect(isHarvestableLoss({ unrealised_gain_loss: 3000, total_value: 12000 }, taxable)).toBe(false);
  });
  it('not harvestable: unpriced position (phantom -costBasis loss, e.g. delisted)', () => {
    expect(isHarvestableLoss({ unrealised_gain_loss: -1900, total_value: 0 }, taxable)).toBe(false);
  });
  it('not harvestable: null loss', () => {
    expect(isHarvestableLoss({ unrealised_gain_loss: null, total_value: 8000 }, taxable)).toBe(false);
  });
});
