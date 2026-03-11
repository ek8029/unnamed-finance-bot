/**
 * Map Plaid error codes to user-friendly messages
 */
export function getPlaidErrorMessage(
  errorCode: string,
  institutionName?: string
): string {
  const bank = institutionName || 'Your bank';

  switch (errorCode) {
    case 'ITEM_LOGIN_REQUIRED':
      return 'Your bank connection needs to be refreshed. Click to reconnect.';
    case 'INVALID_CREDENTIALS':
      return 'The credentials entered were incorrect. Please try again.';
    case 'INSTITUTION_DOWN':
      return `${bank} is temporarily unavailable. Please try again later.`;
    case 'INSTITUTION_NOT_RESPONDING':
      return `${bank} is not responding. Please try again later.`;
    case 'RATE_LIMIT_EXCEEDED':
      return 'Too many requests. Please wait a moment.';
    case 'ITEM_NOT_FOUND':
      return 'This bank connection no longer exists. Please reconnect.';
    case 'ACCESS_NOT_GRANTED':
      return 'Access was not granted. Please try connecting again.';
    case 'ITEM_LOCKED':
      return 'Your bank account is locked. Please contact your bank.';
    case 'MFA_NOT_SUPPORTED':
      return 'Multi-factor authentication is required but not supported for this flow.';
    case 'INSUFFICIENT_CREDENTIALS':
      return 'Additional information is needed to connect. Please try again.';
    case 'ITEM_NOT_SUPPORTED':
      return `${bank} is not currently supported. Please try a different institution.`;
    case 'NO_ACCOUNTS':
      return 'No eligible accounts found at this institution.';
    default:
      return 'Something went wrong connecting your account. Please try again.';
  }
}

/**
 * Extract a Plaid error from an API error response
 */
export function extractPlaidError(error: unknown): {
  errorType: string;
  errorCode: string;
  errorMessage: string;
  displayMessage: string;
} | null {
  const plaidError = (error as { response?: { data?: {
    error_type?: string;
    error_code?: string;
    error_message?: string;
    display_message?: string;
  } } })?.response?.data;

  if (!plaidError?.error_code) return null;

  return {
    errorType: plaidError.error_type || 'UNKNOWN',
    errorCode: plaidError.error_code,
    errorMessage: plaidError.error_message || '',
    displayMessage: plaidError.display_message || getPlaidErrorMessage(plaidError.error_code),
  };
}
