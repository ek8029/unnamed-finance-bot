import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

const PLAID_ENV = process.env.PLAID_ENV || 'sandbox';

const configuration = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID!,
      'PLAID-SECRET': PLAID_ENV === 'sandbox'
        ? process.env.PLAID_SECRET_SANDBOX!
        : process.env.PLAID_SECRET!,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);

// Products we request from Plaid
export const PLAID_PRODUCTS = ['transactions'] as const;

// Optional investment products (requested separately for brokerage accounts)
export const PLAID_INVESTMENT_PRODUCTS = ['investments'] as const;

// Country codes
export const PLAID_COUNTRY_CODES = ['US'] as const;

// Webhook URL (set in production)
export function getWebhookUrl(): string | undefined {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl || appUrl.includes('localhost')) return undefined;
  return `${appUrl}/api/plaid/webhook`;
}

// Map Plaid account types to our account_type enum
export function mapPlaidAccountType(
  type: string,
  subtype: string | null
): string {
  switch (type) {
    case 'depository':
      if (subtype === 'savings' || subtype === 'hsa' || subtype === 'cd' || subtype === 'money market') {
        return 'savings';
      }
      return 'checking';
    case 'credit':
      return 'credit_card';
    case 'investment':
    case 'brokerage':
      return 'brokerage';
    case 'loan':
      if (subtype === 'mortgage') return 'mortgage';
      return 'loan';
    default:
      return 'checking';
  }
}
