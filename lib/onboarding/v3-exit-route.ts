// Spec 3.1 exit table. Pure: the screen decides what to render from `to`.
import { PLAID_ERROR_MESSAGES, type LinkExitDetail } from '@/lib/plaid/link-exit';

export type ExitRoute = { to: 'manual' | 'stay' | 'none'; message: string | null };

const TO_MANUAL = new Set(['INSTITUTION_DOWN', 'INSTITUTION_NO_LONGER_SUPPORTED', 'INSTITUTION_REGISTRATION_REQUIRED']);
const STAY = new Set(['INVALID_CREDENTIALS', 'ITEM_LOCKED']);

export function routeLinkExit(detail: LinkExitDetail): ExitRoute {
  const { code } = detail;
  if (!code) return { to: 'none', message: null };
  if (code === 'INSTITUTION_NOT_FOUND') {
    const subject = detail.searchQuery ? `${detail.searchQuery} is not available through Plaid yet.` : 'That brokerage is not available through Plaid yet.';
    return { to: 'manual', message: `${subject} Add those positions by hand. Everything works on positions entered by hand.` };
  }
  if (TO_MANUAL.has(code)) return { to: 'manual', message: PLAID_ERROR_MESSAGES[code] };
  if (STAY.has(code)) return { to: 'stay', message: PLAID_ERROR_MESSAGES[code] };
  return { to: 'stay', message: 'Something went wrong connecting your account. Please try again.' };
}
