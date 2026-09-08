type TokenAttempt = { controller: AbortController; promise: Promise<string | null> };

/** Coalesce repeated clicks and discard responses from an unmounted attempt. */
export function createLinkTokenLoader(fetcher: typeof fetch) {
  let active: TokenAttempt | null = null;

  return {
    load(): Promise<string | null> {
      if (active) return active.promise;
      const attempt: TokenAttempt = { controller: new AbortController(), promise: Promise.resolve(null) };
      active = attempt;
      attempt.promise = (async () => {
        try {
          const response = await fetcher('/api/plaid/create-link-token', {
            method: 'POST', signal: attempt.controller.signal,
          });
          const data: unknown = await response.json();
          if (active !== attempt) return null;
          if (!response.ok) {
            const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
              ? data.error : 'Could not prepare your connection. Please retry.';
            throw new Error(message);
          }
          const token = data && typeof data === 'object' && 'link_token' in data ? data.link_token : null;
          // Keep provider tokens opaque; reject wrong token types and whitespace
          // without constraining the provider's identifier alphabet or length.
          if (typeof token !== 'string' || !/^link-\S+$/.test(token)) {
            throw new Error('Could not prepare your connection. Please retry.');
          }
          return token;
        } catch (error) {
          if (active !== attempt) return null;
          throw error;
        } finally {
          if (active === attempt) active = null;
        }
      })();
      return attempt.promise;
    },
    cancel() {
      const attempt = active;
      active = null;
      attempt?.controller.abort();
    },
  };
}

export function linkButtonStatus({ initializing, tokenError, ready, exchanging, linkOpen }: {
  initializing: boolean; tokenError: boolean; ready: boolean; exchanging: boolean; linkOpen: boolean;
}): { label: string | null; disabled: boolean; busy: boolean } {
  if (exchanging) return { label: 'Linking...', disabled: true, busy: true };
  if (initializing) return { label: 'Preparing connection...', disabled: true, busy: true };
  if (tokenError) return { label: 'Retry connection', disabled: false, busy: false };
  if (linkOpen) return { label: 'Connecting...', disabled: true, busy: true };
  if (!ready) return { label: 'Preparing connection...', disabled: true, busy: true };
  return { label: null, disabled: false, busy: false };
}
