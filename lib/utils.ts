import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCategoryName(raw: string): string {
  return raw
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bAnd\b/g, '&');
}

export function guessCategoryGroup(raw: string): string {
  const upper = raw.toUpperCase();
  if (upper.includes('INCOME') || upper === 'SALARY' || upper === 'BONUS') return 'Income';
  if (upper.includes('FOOD') || upper.includes('DRINK') || upper.includes('DINING') || upper.includes('GROCERIES') || upper.includes('COFFEE')) return 'Food & Drink';
  if (upper.includes('TRANSPORT') || upper.includes('GAS') || upper.includes('UBER') || upper.includes('LYFT') || upper.includes('PARKING')) return 'Transportation';
  if (upper.includes('ENTERTAINMENT') || upper.includes('STREAMING') || upper.includes('GAMING') || upper.includes('MUSIC')) return 'Entertainment';
  if (upper.includes('SHOP') || upper.includes('MERCHANDISE') || upper.includes('CLOTHING') || upper.includes('AMAZON') || upper.includes('ELECTRONICS')) return 'Shopping';
  if (upper.includes('RENT') || upper.includes('UTILITIES') || upper.includes('ELECTRIC') || upper.includes('WATER') || upper.includes('INTERNET') || upper.includes('PHONE') || upper.includes('MORTGAGE')) return 'Bills & Utilities';
  if (upper.includes('MEDICAL') || upper.includes('HEALTH') || upper.includes('DOCTOR') || upper.includes('PHARMACY') || upper.includes('DENTAL')) return 'Healthcare';
  if (upper.includes('TRANSFER')) return 'Transfers';
  if (upper.includes('TRAVEL') || upper.includes('FLIGHT') || upper.includes('HOTEL')) return 'Travel';
  if (upper.includes('LOAN') || upper.includes('DEBT')) return 'Debt';
  if (upper.includes('FEE') || upper.includes('BANK_FEE') || upper.includes('SERVICE_CHARGE')) return 'Fees & Charges';
  if (upper.includes('TAX') || upper.includes('GOVERNMENT')) return 'Taxes & Government';
  if (upper.includes('INVEST') || upper.includes('STOCK') || upper.includes('CRYPTO') || upper.includes('RETIREMENT')) return 'Investments';
  if (upper.includes('EDUCATION') || upper.includes('TUITION') || upper.includes('BOOK') || upper.includes('COURSE')) return 'Education';
  return 'Other';
}
