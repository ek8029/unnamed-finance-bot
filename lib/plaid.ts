import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

const PLAID_ENV = process.env.PLAID_ENV || 'sandbox';

// Validate environment
const validEnvs = ['sandbox', 'development', 'production'] as const;
if (!validEnvs.includes(PLAID_ENV as typeof validEnvs[number])) {
  throw new Error(`Invalid PLAID_ENV: "${PLAID_ENV}". Must be one of: ${validEnvs.join(', ')}`);
}

// Select the correct secret based on environment
const plaidSecret = PLAID_ENV === 'sandbox'
  ? process.env.PLAID_SECRET_SANDBOX!
  : process.env.PLAID_SECRET!;

const configuration = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID!,
      'PLAID-SECRET': plaidSecret,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);

// Products we always request
export const PLAID_PRODUCTS = ['transactions'] as const;

// Optional products requested if the institution supports them
export const PLAID_OPTIONAL_PRODUCTS = ['investments'] as const;

// Country codes
export const PLAID_COUNTRY_CODES = ['US'] as const;

// Webhook URL (only set in production, not for localhost/sandbox)
export function getWebhookUrl(): string | undefined {
  if (PLAID_ENV === 'production') return 'https://helmterminal.dev/api/plaid/webhook';
  return undefined;
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
