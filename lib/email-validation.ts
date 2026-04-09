/**
 * Email validation for the signup endpoint.
 *
 * Three rejection categories:
 *   1. Disposable domains (mailinator, guerrillamail, etc.) — via
 *      the `disposable-email-domains` package (20k+ domains, updated weekly)
 *   2. DDNS / dynamic DNS / free subdomain providers (dpdns.org, duckdns.org,
 *      no-ip.com, etc.) — not in the disposable list but used by bot rings
 *   3. Bot-shaped username patterns (ratelimit-test-1, test99, user42)
 *
 * Design notes:
 *   - Username pattern matching is the LOWEST-precision layer. We intentionally
 *     keep it narrow — only three patterns that are overwhelmingly bot signals.
 *     The generic `[a-z]+\d{3,}$` pattern was explicitly rejected because it
 *     rejects real users like mike2024, pokemon1999, sarah2020.
 *   - Rejection reasons are returned to the caller for LOGGING ONLY. The
 *     signup route returns a generic error to the client to avoid letting
 *     attackers tune their tooling against our rules.
 */

import disposableDomains from 'disposable-email-domains';

const disposableSet: Set<string> = new Set(disposableDomains);

/**
 * DDNS / dynamic-DNS / free-subdomain providers. These domains hand out
 * arbitrary subdomains to anyone who registers, so they're indistinguishable
 * from disposable email from our perspective and frequently used by bot rings.
 *
 * Match rule: reject if the email domain EQUALS the suffix or ENDS WITH
 * `.` + suffix. So `dpdns.org`, `foo.dpdns.org`, and `bar.baz.dpdns.org` all
 * match, but `notdpdns.org` does NOT match.
 */
const ddnsSuffixes: readonly string[] = [
  'dpdns.org',
  'duckdns.org',
  'afraid.org',
  'freedns.afraid.org',
  'ddnss.org',
  'no-ip.com',
  'no-ip.org',
  'hopto.org',
  'zapto.org',
  'dynu.net',
  'dynv6.net',
  'changeip.com',
  'sytes.net',
  'noip.com',
  'serveftp.com',
  'serveblog.net',
];

/**
 * Username patterns that are overwhelmingly bot-generated.
 *
 * These are intentionally narrow:
 *   - `^[a-z]+-test-\d+$`  matches ratelimit-test-1, helm-test-91, foo-test-42
 *   - `^test\d+$`           matches test1, test42, test999
 *   - `^user\d+$`           matches user1, user42, user999
 *
 * NOT included (explicitly rejected by operator):
 *   - `^[a-z]+\d{3,}$`      would reject real users like mike2024, pokemon1999
 *
 * Username matching is the lowest-precision defense layer. Do not rely on
 * it in isolation — CAPTCHA + rate limiting + disposable-domain check are
 * the primary defenses.
 */
const suspiciousUsernamePatterns: readonly RegExp[] = [
  /^[a-z]+-test-\d+$/i,
  /^test\d+$/i,
  /^user\d+$/i,
];

export type EmailRejectionReason =
  | 'malformed_email'
  | 'disposable_domain'
  | 'ddns_domain'
  | 'suspicious_username_pattern';

export interface EmailValidationResult {
  valid: boolean;
  reason?: EmailRejectionReason;
  /** Lowercased domain — populated even on rejection so it can be logged */
  domain?: string;
}

/**
 * Validate an email address against the disposable + DDNS + username-pattern
 * blocklist. Format validation is basic — relies on HTML5 `type=email` and
 * Supabase's own format check for the final word.
 */
export function validateEmailDomain(email: string): EmailValidationResult {
  if (typeof email !== 'string' || email.length === 0) {
    return { valid: false, reason: 'malformed_email' };
  }
  const normalized = email.toLowerCase().trim();
  const atIdx = normalized.lastIndexOf('@');
  if (atIdx <= 0 || atIdx === normalized.length - 1) {
    return { valid: false, reason: 'malformed_email' };
  }
  const localPart = normalized.slice(0, atIdx);
  const domain = normalized.slice(atIdx + 1);

  // Basic sanity
  if (!localPart || !domain || !domain.includes('.')) {
    return { valid: false, reason: 'malformed_email', domain };
  }

  // Disposable domain check (exact match against 20k+ known providers)
  if (disposableSet.has(domain)) {
    return { valid: false, reason: 'disposable_domain', domain };
  }

  // DDNS suffix check (exact or suffix match)
  for (const suffix of ddnsSuffixes) {
    if (domain === suffix || domain.endsWith('.' + suffix)) {
      return { valid: false, reason: 'ddns_domain', domain };
    }
  }

  // Suspicious username pattern check
  for (const pattern of suspiciousUsernamePatterns) {
    if (pattern.test(localPart)) {
      return { valid: false, reason: 'suspicious_username_pattern', domain };
    }
  }

  return { valid: true, domain };
}

/**
 * Extract the lowercased domain from an email without validating anything.
 * Used when we need the domain for logging even if other validation failed
 * further up the pipeline.
 */
export function extractEmailDomain(email: string): string | null {
  if (typeof email !== 'string') return null;
  const atIdx = email.lastIndexOf('@');
  if (atIdx <= 0 || atIdx === email.length - 1) return null;
  return email.slice(atIdx + 1).toLowerCase().trim();
}
