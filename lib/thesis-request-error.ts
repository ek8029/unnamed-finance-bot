/** Keep plan limits distinct from consent, authentication and provider failures. */
export class ThesisRequestError extends Error {
  constructor(message: string, readonly upgradeRequired = false) {
    super(message);
    this.name = 'ThesisRequestError';
  }
}

/** Read an error body only on failure; successful callers retain their payload. */
export async function requireThesisResponse(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => null) as { error?: unknown; code?: unknown } | null;
  const message = typeof body?.error === 'string' && body.error.trim() ? body.error :
    response.status === 401 ? 'Sign in again to continue.' :
    response.status === 429 ? 'Too many requests. Please try again later.' : fallback;
  throw new ThesisRequestError(message, response.status === 403 && body?.code === 'PRO_REQUIRED');
}

export function thesisRequestError(error: unknown, fallback: string): ThesisRequestError {
  return error instanceof ThesisRequestError ? error : new ThesisRequestError(fallback);
}
