// Plaid Link exit handling that does not need React.

// User-friendly messages for common Plaid Link error codes
export const PLAID_ERROR_MESSAGES: Record<string, string> = {
  INSTITUTION_REGISTRATION_REQUIRED:
    'Your bank requires online banking to be set up. Please enable online banking with your institution and try again.',
  INSTITUTION_NO_LONGER_SUPPORTED:
    'This institution is no longer supported by Plaid. Try connecting a different account.',
  // "Try a different name" is the wrong advice and it is what nine people were
  // given. Plaid's catalogue genuinely does not include every broker: Public.com,
  // Tradier and moomoo are absent from PRODUCTION (checked 2026-08-28; Webull
  // joined since the 8/21 check), so searching harder cannot work. Say that, and
  // point at the path that does.
  INSTITUTION_NOT_FOUND:
    'Plaid does not reach every broker. Public, Tradier and moomoo are not available through it. You can add those holdings by importing them instead.',
  INSTITUTION_DOWN:
    'This institution is temporarily unavailable. Please try again later.',
  INVALID_CREDENTIALS:
    'The credentials you entered were incorrect. Please try again.',
  ITEM_LOCKED:
    'Your account is locked. Please unlock it with your institution and try again.',
};

export type PlaidLinkExitError = {
  error_code?: string | null;
  display_message?: string | null;
} | null;

/**
 * What to tell the user when Link closes. Plaid reports "institution not
 * found" as `metadata.status` with `err === null`, so a message keyed only on
 * `err.error_code` never fired for the one exit that most needs a next step.
 * A plain close, or a close at the credentials/OAuth pane, stays silent.
 */
export function resolveLinkExitError(
  err: PlaidLinkExitError,
  status: string | null | undefined,
): { code: string; message: string } | null {
  if (!err) {
    return status === 'institution_not_found'
      ? { code: 'INSTITUTION_NOT_FOUND', message: PLAID_ERROR_MESSAGES.INSTITUTION_NOT_FOUND }
      : null;
  }
  const code = err.error_code || '';
  return {
    code,
    message:
      PLAID_ERROR_MESSAGES[code] ||
      err.display_message ||
      'Something went wrong connecting your account. Please try again.',
  };
}
