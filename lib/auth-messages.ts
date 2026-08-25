/**
 * Messages /login can surface via `?message=<key>`.
 *
 * The query param is a KEY, never prose. /login renders AUTH_MESSAGES[key] and
 * deliberately renders nothing for an unknown key, so that a crafted URL cannot
 * inject arbitrary text onto the sign-in page. That is a security property, not
 * an oversight, and it must not be relaxed into rendering the raw param.
 *
 * The cost of failing closed is that a redirect passing a full sentence shows
 * nothing at all. That is exactly how the post-signup "confirm your email"
 * prompt went missing: signup pushed the sentence instead of the key, the
 * lookup missed, and the user landed on a bare login form.
 *
 * `tests/auth-messages.test.ts` asserts every `?message=` value in the app is a
 * real key here.
 */
export const AUTH_MESSAGES = {
  'check-email':
    'Check your email to confirm your account. If it is not there, check spam or promotions. It can take a minute to arrive.',
  'password-reset': 'Password reset link sent.',
  'password-updated': 'Password updated successfully. Please sign in.',
  'session-expired': 'Your session expired. Please sign in again.',
} as const;

export type AuthMessageKey = keyof typeof AUTH_MESSAGES;

/**
 * Shown by /login when a password attempt fails while `?message=check-email`
 * is on the URL, i.e. right after an email signup. GoTrue rejects an
 * unconfirmed account before it looks at the password, and the login API
 * deliberately flattens every failure to "Invalid email or password" so the
 * response cannot be used to enumerate accounts. In August 19 of 23 login
 * failures were "Email not confirmed", most within minutes of signing up, and
 * people went to Forgot password. The true reading lives client-side only.
 */
export const UNCONFIRMED_LOGIN_ERROR =
  'Your email is not confirmed yet. Open the link we sent you first, then sign in. If it is not there, check spam or promotions.';
