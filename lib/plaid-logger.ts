/**
 * Structured Plaid API call logger.
 * Logs to plaid_logs table for debugging and audit trail.
 */
import { createServiceClient } from '@/lib/supabase/server';

interface PlaidLogEntry {
  userId: string;
  endpoint: string;
  status: 'success' | 'error';
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export async function logPlaidCall(entry: PlaidLogEntry): Promise<void> {
  try {
    const supabase = await createServiceClient();
    await supabase.from('plaid_logs').insert({
      user_id: entry.userId,
      endpoint: entry.endpoint,
      status: entry.status,
      error_code: entry.errorCode || null,
      error_message: entry.errorMessage || null,
      metadata: entry.metadata || null,
    });
  } catch (err) {
    // Logging must never crash the calling code
    console.error('Failed to write plaid_log:', err);
  }
}

/**
 * Convenience wrapper: log a successful Plaid call
 */
export async function logPlaidSuccess(
  userId: string,
  endpoint: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logPlaidCall({ userId, endpoint, status: 'success', metadata });
}

/**
 * Convenience wrapper: log a failed Plaid call
 */
export async function logPlaidError(
  userId: string,
  endpoint: string,
  errorCode: string,
  errorMessage: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logPlaidCall({
    userId,
    endpoint,
    status: 'error',
    errorCode,
    errorMessage,
    metadata,
  });
}
