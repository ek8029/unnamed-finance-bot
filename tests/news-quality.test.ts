import { describe, it, expect } from 'vitest';
import { isComparisonHeadline } from '../lib/news-quality';

describe('isComparisonHeadline — filters "vs / better buy" clickbait', () => {
  const CLICKBAIT = [
    'Micron Vs. Apple: Why MU Is Still The Better Buy Between These Tech Giants',
    'Nvidia vs. AMD: Which AI CPU Stock Is the Better Buy?',
    'Tesla vs BYD: Two Paths to EV Leadership, One Winner',
    'Intel vs Qualcomm: Which AI Stock Is The Better Buy',
    'Visa vs. PayPal: Which Payments Stock Wins the Upside Race?',
    'Broadcom Vs. Marvell: Why Broadcom’s Custom Silicon Dominance Crushes Marvell’s Premium-Priced AI Growth',
    'Broadcom vs Nvidia: The $100B AI Race and One Winner',
    'Marvell Technology vs Broadcom: One Stock is Better Positioned for the AI Boom',
    'Advanced Micro Devices vs Marvell Technology: The Better AI Chip Maker',
    'NVIDIA vs Micron: Which Stock Will The Market Reward',
    'Broadcom vs. Navitas Semiconductor: Which AI Chip Maker Stock Is a Better Buy in 2026?',
    'Better Custom ASIC Stock: Marvell vs. Broadcom',
    'Palantir Is a Better Buy Than Snowflake Right Now',
  ];
  it.each(CLICKBAIT)('flags: %s', (t) => {
    expect(isComparisonHeadline(t)).toBe(true);
  });
});

describe('isComparisonHeadline — leaves real news alone', () => {
  const LEGIT = [
    // legitimate primary/thesis news that must still be scored
    'Apple beats Q3 revenue vs consensus estimates',
    'Micron reports record data center DRAM demand in latest 10-Q',
    'Swedish Court Further Reschedules Judgment in PriceRunner Vs Google Antitrust Case',
    'Nvidia announces Blackwell GPU shipments ahead of schedule',
    'Tesla Q4 deliveries top forecasts',
    'Alphabet Vs. Amazon: Alphabet’s Ad Machine Fuels AI, Amazon’s Costly Retail Doesn’t', // comparison but no buy/winner verdict → keep (scored on its own merits)
  ];
  it.each(LEGIT)('keeps: %s', (t) => {
    expect(isComparisonHeadline(t)).toBe(false);
  });

  it('handles null/empty', () => {
    expect(isComparisonHeadline(null)).toBe(false);
    expect(isComparisonHeadline('')).toBe(false);
  });
});
