import { LegalPageLayout } from '@/components/legal-page-layout';

export const metadata = {
  title: 'Security — Helm',
  description: 'How Helm protects your financial data and account security.',
};

export default function SecurityPage() {
  return (
    <LegalPageLayout title="Security Practices" lastUpdated="March 10, 2026">
      {/* Overview */}
      <section>
        <h2>Our Commitment</h2>
        <p>
          Helm handles sensitive financial data. We treat security as a foundational requirement,
          not an afterthought. This document outlines our Information Security Policy (ISP), security
          architecture, and the controls we enforce to protect your data.
        </p>
      </section>

      {/* Zero Trust Architecture */}
      <section>
        <h2>Zero Trust Architecture</h2>
        <p>
          Helm follows a zero trust security model. Every request is authenticated, authorized,
          and validated regardless of origin:
        </p>
        <ul>
          <li><strong>No implicit trust:</strong> All API requests require valid authentication tokens — there are no trusted internal networks or bypassed endpoints</li>
          <li><strong>Row-Level Security (RLS):</strong> Database-level policies enforce data isolation per user. Even service-level vulnerabilities cannot access another user&apos;s data</li>
          <li><strong>Short-lived tokens:</strong> JWT access tokens expire frequently and are refreshed via secure HTTP-only cookies</li>
          <li><strong>Least privilege:</strong> Application code uses user-scoped database clients by default. Service-role access is restricted to admin operations (account deletion, audit logging) and never exposed to client code</li>
          <li><strong>Multi-factor authentication:</strong> TOTP-based 2FA is available on all consumer accounts, adding a second verification layer beyond passwords</li>
          <li><strong>Rate limiting:</strong> Authentication endpoints enforce per-identity rate limits to prevent brute force and credential stuffing attacks</li>
        </ul>
      </section>

      {/* Encryption */}
      <section>
        <h2>Encryption</h2>

        <h3>In Transit</h3>
        <p>
          All data transmitted between your browser and our servers is encrypted using TLS 1.2 or higher.
          This includes API requests, authentication flows, and financial data transfers. Our infrastructure
          enforces HTTPS on all endpoints with no fallback to unencrypted connections.
        </p>

        <h3>At Rest</h3>
        <p>
          Your data is stored in encrypted databases using AES-256 encryption provided by our infrastructure
          partners (Supabase / AWS). Database backups are also encrypted. Encryption keys are managed by
          the infrastructure provider and are not accessible to application code.
        </p>
      </section>

      {/* Authentication & Access Control */}
      <section>
        <h2>Authentication &amp; Access Control</h2>
        <ul>
          <li>Passwords are hashed using bcrypt before storage — we never store plaintext passwords</li>
          <li>Password strength is enforced at signup and password change (uppercase, lowercase, number, special character, minimum 8 characters — must meet 4 of 5 requirements)</li>
          <li>Two-factor authentication (TOTP) is available and recommended for all accounts</li>
          <li>Authentication uses short-lived JWT tokens with secure, HTTP-only cookies</li>
          <li>Login attempts are rate-limited (5 failed attempts per 15-minute window triggers a temporary lockout)</li>
          <li>Signup and password reset requests are rate-limited to prevent abuse</li>
          <li>All authentication events (logins, password changes, session revocations) are logged for audit purposes</li>
          <li>You can view your login activity and sign out all other devices from Settings &gt; Security</li>
        </ul>
      </section>

      {/* MFA */}
      <section>
        <h2>Multi-Factor Authentication</h2>
        <p>
          Helm supports time-based one-time password (TOTP) two-factor authentication on all consumer accounts.
          When enabled, users must provide a verification code from their authenticator app (Google Authenticator,
          Authy, 1Password, etc.) in addition to their password when signing in.
        </p>
        <ul>
          <li>MFA can be enabled from Settings &gt; Security &gt; Two-Factor Authentication</li>
          <li>MFA is enforced at login — the session is not granted full access until the TOTP challenge is completed</li>
          <li>Protected routes verify the authentication assurance level (AAL) and redirect to MFA verification when required</li>
        </ul>
      </section>

      {/* Data Isolation */}
      <section>
        <h2>Data Isolation</h2>
        <p>
          Every database table enforces Row-Level Security (RLS) policies at the database level. This means
          your financial data is isolated from every other user — even in the event of an application-level
          vulnerability, the database itself prevents cross-user data access.
        </p>
      </section>

      {/* Access Control Policy */}
      <section>
        <h2>Access Control Policy</h2>
        <p>
          Helm maintains a defined access control policy governing who can access consumer financial data
          and under what conditions:
        </p>
        <ul>
          <li><strong>Production database:</strong> Access restricted to service-role credentials, used only by automated server-side processes. No direct human access to production data during normal operations</li>
          <li><strong>Infrastructure access:</strong> Cloud provider accounts (Supabase, Vercel, GitHub) require multi-factor authentication for all team members</li>
          <li><strong>API keys and secrets:</strong> Stored in encrypted environment variable vaults (Vercel), never in source code or client-side bundles</li>
          <li><strong>Third-party integrations:</strong> Plaid API credentials use separate keys per environment (sandbox, production) with minimum necessary scopes</li>
          <li><strong>Code access:</strong> Source code repositories require authenticated access with MFA-enabled accounts</li>
        </ul>
      </section>

      {/* Internal Security Controls */}
      <section>
        <h2>Internal Security Controls</h2>

        <h3>MFA on Internal Systems</h3>
        <p>
          All internal systems that store or process consumer data require multi-factor authentication:
        </p>
        <ul>
          <li>Supabase dashboard (database, auth management)</li>
          <li>Vercel dashboard (deployment, environment variables)</li>
          <li>GitHub (source code, CI/CD pipelines)</li>
          <li>Plaid dashboard (account aggregation configuration)</li>
        </ul>

        <h3>Periodic Access Reviews</h3>
        <p>
          Access to production systems and consumer data is reviewed on a quarterly basis. Reviews include:
        </p>
        <ul>
          <li>Auditing active team member access to all internal systems</li>
          <li>Revoking access for any departed or transferred personnel</li>
          <li>Verifying MFA is enabled on all privileged accounts</li>
          <li>Reviewing API key scopes and rotating credentials as needed</li>
          <li>Reviewing database RLS policies for correctness</li>
        </ul>

        <h3>Employee Offboarding</h3>
        <p>
          When a team member departs or transfers to a role that no longer requires access to consumer data,
          their access is revoked within one business day. This includes:
        </p>
        <ul>
          <li>Removal from all cloud provider accounts (Supabase, Vercel)</li>
          <li>Removal from source code repositories</li>
          <li>Revocation of any API keys or tokens associated with the individual</li>
          <li>Rotation of shared secrets if applicable</li>
        </ul>
      </section>

      {/* Vulnerability Management */}
      <section>
        <h2>Vulnerability Management</h2>
        <ul>
          <li><strong>Dependency scanning:</strong> Automated vulnerability scanning via GitHub Dependabot monitors all dependencies for known CVEs and creates alerts for remediation</li>
          <li><strong>Static analysis:</strong> GitHub CodeQL performs automated code scanning on every pull request to detect security vulnerabilities before they reach production</li>
          <li><strong>Infrastructure scanning:</strong> Cloud infrastructure providers (Vercel, Supabase) perform their own continuous vulnerability assessments</li>
          <li><strong>Remediation SLA:</strong> Critical vulnerabilities are addressed within 48 hours. High-severity issues within 7 days. All others within 30 days</li>
        </ul>
      </section>

      {/* Plaid Integration */}
      <section>
        <h2>Plaid Integration Security</h2>
        <p>
          We use <a href="https://plaid.com" target="_blank" rel="noopener noreferrer">Plaid</a> to connect
          your financial accounts. Key security details:
        </p>
        <ul>
          <li>Helm <strong>never</strong> receives or stores your bank login credentials</li>
          <li>Plaid authenticates directly with your financial institution using bank-level security</li>
          <li>We receive only read-only access to account data — we cannot initiate transactions or transfers</li>
          <li>Plaid is SOC 2 Type II certified and undergoes regular security audits</li>
          <li>You can revoke Plaid access at any time through your bank&apos;s connected apps settings or by deleting your Helm account</li>
        </ul>
      </section>

      {/* Infrastructure */}
      <section>
        <h2>Infrastructure</h2>
        <ul>
          <li><strong>Hosting:</strong> Vercel (serverless, edge-optimized, automatic DDoS protection)</li>
          <li><strong>Database:</strong> Supabase (managed PostgreSQL with automated backups, RLS, and encryption)</li>
          <li><strong>Secrets:</strong> Environment variables are stored in encrypted vaults, never in source code</li>
          <li><strong>Dependencies:</strong> Continuously monitored for known vulnerabilities via automated scanning</li>
          <li><strong>Audit logging:</strong> All authentication and security events are logged with timestamps, IP addresses, and user agents</li>
        </ul>
      </section>

      {/* Responsible Disclosure */}
      <section>
        <h2>Responsible Disclosure</h2>
        <p>
          If you discover a security vulnerability in Helm, please report it responsibly. Contact us at{' '}
          <a href="mailto:security@helmterminal.dev">security@helmterminal.dev</a>. We ask that you:
        </p>
        <ul>
          <li>Do not access other users&apos; data</li>
          <li>Do not perform destructive actions</li>
          <li>Allow reasonable time for us to address the issue before public disclosure</li>
        </ul>
      </section>

      {/* ISP Link */}
      <section>
        <h2>Information Security Policy</h2>
        <p>
          Our formal Information Security Policy (ISP) is available at{' '}
          <a href="/security/isp">/security/isp</a>. This document covers access control, de-provisioning,
          periodic reviews, vulnerability management, incident response, and all security controls in detail.
          It is provided to regulators and integration partners upon request.
        </p>
      </section>

      {/* Contact */}
      <section>
        <h2>Questions</h2>
        <p>
          For security-related questions, contact{' '}
          <a href="mailto:security@helmterminal.dev">security@helmterminal.dev</a>.
        </p>
      </section>
    </LegalPageLayout>
  );
}
