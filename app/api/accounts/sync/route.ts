// Compatibility alias. Every refresh uses the authenticated, rate-limited
// Plaid handler; never manufacture healthy account timestamps here.
export { POST } from '@/app/api/plaid/sync/route';
