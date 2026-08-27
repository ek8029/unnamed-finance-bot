import { LegalPageLayout } from '@/components/legal-page-layout';

export const metadata = {
  title: 'Information Security Policy - Helm',
  description: 'Helm\'s formal Information Security Policy (ISP) governing the protection of consumer financial data.',
};

export default function ISPPage() {
  return (
    <LegalPageLayout title="Information Security Policy" lastUpdated="March 10, 2026">
      {/* Header block */}
      <section>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
          <dt className="font-semibold text-[var(--color-text-primary)]">Document:</dt>
          <dd>Helm Information Security Policy (ISP)</dd>
          <dt className="font-semibold text-[var(--color-text-primary)]">Version:</dt>
          <dd>1.0</dd>
          <dt className="font-semibold text-[var(--color-text-primary)]">Effective Date:</dt>
          <dd>March 10, 2026</dd>
          <dt className="font-semibold text-[var(--color-text-primary)]">Next Review:</dt>
          <dd>June 10, 2026 (Quarterly)</dd>
          <dt className="font-semibold text-[var(--color-text-primary)]">Classification:</dt>
          <dd>Public</dd>
          <dt className="font-semibold text-[var(--color-text-primary)]">Owner:</dt>
          <dd>Helm Security Team</dd>
        </dl>
      </section>

      {/* 1. Purpose */}
      <section>
        <h2>1. Purpose</h2>
        <p>
          This Information Security Policy (ISP) establishes the security requirements, controls, and
          responsibilities for protecting the confidentiality, integrity, and availability of consumer
          financial data processed by Helm. It applies to all systems, personnel, and third-party services
          involved in the operation of the Helm platform.
        </p>
      </section>

      {/* 2. Scope */}
      <section>
        <h2>2. Scope</h2>
        <p>This policy covers:</p>
        <ul>
          <li>All production systems that store, process, or transmit consumer financial data</li>
          <li>All personnel (employees, contractors, agents) with access to production systems or consumer data</li>
          <li>All third-party services and integrations (Plaid, Supabase, Vercel, Polygon.io)</li>
          <li>The Helm web application, API layer, database layer, and supporting infrastructure</li>
        </ul>
        <p>
          Consumer financial data includes: account balances, transaction history, account identifiers,
          portfolio holdings, and any personally identifiable information (PII) associated with user accounts.
        </p>
      </section>

      {/* 3. Roles & Responsibilities */}
      <section>
        <h2>3. Roles &amp; Responsibilities</h2>

        <h3>3.1 Security Owner</h3>
        <p>
          The Security Owner is responsible for maintaining this policy, conducting access reviews,
          managing incident response, and ensuring compliance with security requirements from
          integration partners (including Plaid). The Security Owner has final authority over
          access grants, revocations, and security exceptions.
        </p>

        <h3>3.2 Engineering Personnel</h3>
        <p>All personnel with access to Helm systems must:</p>
        <ul>
          <li>Enable multi-factor authentication on all accounts that access production systems</li>
          <li>Follow the principle of least privilege when requesting or granting access</li>
          <li>Report suspected security incidents immediately to the Security Owner</li>
          <li>Complete security onboarding before receiving production access</li>
          <li>Return or destroy all access credentials upon departure or role change</li>
        </ul>

        <h3>3.3 Third-Party Services</h3>
        <p>
          Third-party services processing consumer data must maintain SOC 2 Type II certification or
          equivalent security controls. Helm currently uses:
        </p>
        <ul>
          <li><strong>Plaid</strong> - Account aggregation (SOC 2 Type II certified)</li>
          <li><strong>Supabase</strong> - Database and authentication (SOC 2 Type II certified)</li>
          <li><strong>Vercel</strong> - Application hosting (SOC 2 Type II certified)</li>
          <li><strong>Polygon.io</strong> - Market data (public data only, no consumer PII shared)</li>
        </ul>
      </section>

      {/* 4. Access Control */}
      <section>
        <h2>4. Access Control Policy</h2>

        <h3>4.1 Principle of Least Privilege</h3>
        <p>
          Access to systems and data is granted on a need-to-know basis. Personnel receive only the
          minimum access required to perform their assigned duties. Elevated access (service-role
          database access, infrastructure admin) requires explicit approval from the Security Owner.
        </p>

        <h3>4.2 Authentication Requirements</h3>
        <ul>
          <li><strong>Internal systems:</strong> All accounts that access production infrastructure (Supabase, Vercel, GitHub, Plaid dashboard) must have multi-factor authentication enabled. Password-only access is not permitted.</li>
          <li><strong>Consumer accounts:</strong> Password strength is enforced (must meet 4 of 5 complexity requirements). TOTP-based two-factor authentication is available and recommended for all users.</li>
          <li><strong>Service accounts:</strong> API keys and service-role credentials are stored in encrypted environment variable vaults. Keys are scoped to minimum necessary permissions and rotated at least annually.</li>
        </ul>

        <h3>4.3 Access Grant Process</h3>
        <ul>
          <li>New access requests must be approved by the Security Owner</li>
          <li>Access is provisioned with MFA enabled before any production data is accessible</li>
          <li>Access grants are documented and included in the quarterly access review</li>
        </ul>

        <h3>4.4 Access Revocation &amp; De-provisioning</h3>
        <p>
          When a team member departs, is terminated, or transfers to a role that no longer requires
          access to consumer data, the following automated de-provisioning steps are executed within
          one (1) business day:
        </p>
        <ul>
          <li>Removal from Supabase organization (database and auth management access)</li>
          <li>Removal from Vercel team (deployment and environment variable access)</li>
          <li>Removal from GitHub organization/repository (source code and CI/CD access)</li>
          <li>Removal from Plaid dashboard (account aggregation configuration)</li>
          <li>Revocation of any personal API keys or tokens</li>
          <li>Rotation of any shared secrets the individual had access to</li>
        </ul>
        <p>
          De-provisioning is tracked via a checklist maintained by the Security Owner and verified
          during the next quarterly access review.
        </p>
      </section>

      {/* 5. Zero Trust Architecture */}
      <section>
        <h2>5. Zero Trust Architecture</h2>
        <p>Helm implements a zero trust security model with the following controls:</p>
        <ul>
          <li><strong>No implicit trust:</strong> All API requests require valid, non-expired authentication tokens. There are no trusted networks, IP allowlists, or bypassed endpoints</li>
          <li><strong>Database-level enforcement:</strong> Row-Level Security (RLS) policies enforce per-user data isolation at the PostgreSQL level, independent of application logic</li>
          <li><strong>Token lifecycle:</strong> JWT access tokens are short-lived and automatically refreshed. Refresh tokens are stored in secure, HTTP-only, SameSite cookies</li>
          <li><strong>Privilege separation:</strong> Application code uses user-scoped database clients by default. Service-role access is limited to specific server-side operations (audit logging, account deletion, admin workflows) and is never exposed to client-side code</li>
          <li><strong>MFA enforcement:</strong> When a user enables two-factor authentication, the middleware enforces AAL2 (Authenticator Assurance Level 2) on all protected routes. Users at AAL1 are redirected to complete TOTP verification before accessing any dashboard functionality</li>
          <li><strong>Rate limiting:</strong> Authentication endpoints enforce per-identity rate limits. Login, password-change and password-reset limits are stored in Postgres and signup limits in Upstash Redis, so they apply consistently across serverless function instances</li>
        </ul>
      </section>

      {/* 6. Data Protection */}
      <section>
        <h2>6. Data Protection</h2>

        <h3>6.1 Encryption in Transit</h3>
        <p>
          All data transmitted between the client and Helm servers is encrypted using TLS 1.2 or higher.
          HTTPS is enforced on all endpoints with HSTS headers. There is no fallback to unencrypted HTTP.
        </p>

        <h3>6.2 Encryption at Rest</h3>
        <p>
          All data at rest is encrypted using AES-256 encryption provided by the infrastructure
          layer (Supabase / AWS RDS). Database backups are encrypted with the same standard.
          Encryption keys are managed by the infrastructure provider via AWS KMS and are not
          accessible to application code.
        </p>

        <h3>6.3 Data Isolation</h3>
        <p>
          Every database table containing consumer data enforces Row-Level Security (RLS) at the
          PostgreSQL level. Queries are scoped to the authenticated user&apos;s ID via the JWT token.
          Even in the event of an application-level vulnerability, cross-user data access is
          prevented by the database engine itself.
        </p>

        <h3>6.4 Sensitive Credential Handling</h3>
        <ul>
          <li>Passwords are hashed using bcrypt - plaintext passwords are never stored or logged</li>
          <li>Plaid access tokens are encrypted by the application with AES-256-GCM before they are written to the database, under a key held in the deployment environment and never stored in the database; the column is additionally protected by row-level security and disk encryption (section 6.2). Tokens are never sent to client-side code</li>
          <li>API keys and service secrets are stored in Vercel&apos;s encrypted environment variable vault</li>
          <li>No consumer credentials (bank logins) are received or stored by Helm - Plaid handles all bank authentication directly</li>
        </ul>
      </section>

      {/* 7. Vulnerability Management */}
      <section>
        <h2>7. Vulnerability Management</h2>

        <h3>7.1 Automated Scanning</h3>
        <ul>
          <li><strong>Dependency scanning:</strong> GitHub Dependabot monitors all npm dependencies for known CVEs on a weekly basis and creates automated pull requests for remediation</li>
          <li><strong>Static code analysis:</strong> GitHub CodeQL (default setup) scans every push and pull request to the main branch; findings are reviewed in the repository&apos;s Security tab</li>
          <li><strong>Infrastructure scanning:</strong> Vercel and Supabase perform continuous vulnerability assessments on their managed infrastructure</li>
        </ul>

        <h3>7.2 Remediation SLAs</h3>
        <ul>
          <li><strong>Critical</strong> (CVSS 9.0+): Remediated within 48 hours</li>
          <li><strong>High</strong> (CVSS 7.0-8.9): Remediated within 7 days</li>
          <li><strong>Medium</strong> (CVSS 4.0-6.9): Remediated within 30 days</li>
          <li><strong>Low</strong> (CVSS 0.1-3.9): Remediated within 90 days or next release cycle</li>
        </ul>

        <h3>7.3 Responsible Disclosure</h3>
        <p>
          External security researchers can report vulnerabilities to{' '}
          <a href="mailto:security@helmterminal.dev">security@helmterminal.dev</a>.
          Reports are acknowledged within 48 hours and triaged according to the remediation SLAs above.
        </p>
      </section>

      {/* 8. Audit Logging */}
      <section>
        <h2>8. Audit Logging &amp; Monitoring</h2>
        <p>
          Authentication events are logged to a dedicated table (auth_events) with the following attributes. Plaid webhook events are logged to a separate audit_logs table. Both tables are append-only at the database level: a trigger rejects every update and delete, including from service-role access; the one exception is the cascade that follows a user&apos;s own account deletion. Administrative actions and data exports are not currently logged.
        </p>
        <ul>
          <li>Event type (login success, login failure, logout, signup outcome, password change, password reset request, session revocation, account deletion)</li>
          <li>User identifier</li>
          <li>IP address</li>
          <li>User agent (parsed to browser, OS, and device type)</li>
          <li>Timestamp (UTC)</li>
          <li>Event-specific metadata</li>
        </ul>
        <p>
          Audit logs are retained indefinitely; no automated purge is in place. Users can view their own login activity
          from the Settings page. Logs are protected by RLS - users can read only their own events and cannot
          insert, edit or delete them. Service-role read access is restricted to the Security Owner and
          cannot alter or remove rows.
        </p>
      </section>

      {/* 9. Periodic Access Reviews */}
      <section>
        <h2>9. Periodic Access Reviews</h2>
        <p>
          Access to all production systems and consumer data is reviewed on a <strong>quarterly</strong> basis.
          Each review includes:
        </p>
        <ul>
          <li>Enumeration of all personnel with access to each production system</li>
          <li>Verification that MFA is enabled on all privileged accounts</li>
          <li>Confirmation that departed or transferred personnel have been fully de-provisioned</li>
          <li>Review of API key scopes and last usage dates</li>
          <li>Review of database RLS policies for correctness and completeness</li>
          <li>Review of third-party service permissions and data sharing agreements</li>
        </ul>
        <p>
          Reviews are documented and retained. Findings requiring remediation are tracked to completion
          by the Security Owner.
        </p>
      </section>

      {/* 10. Incident Response */}
      <section>
        <h2>10. Incident Response</h2>

        <h3>10.1 Detection</h3>
        <p>
          Security incidents may be detected via audit log anomalies (unusual login patterns, repeated
          failed attempts), automated vulnerability scanning alerts, user reports, or third-party
          notifications (Plaid, Supabase, Vercel security advisories).
        </p>

        <h3>10.2 Response Procedure</h3>
        <ul>
          <li><strong>Identify:</strong> Determine scope, affected systems, and impacted users</li>
          <li><strong>Contain:</strong> Isolate affected systems, revoke compromised credentials, block malicious access</li>
          <li><strong>Eradicate:</strong> Remove the root cause (patch vulnerability, rotate keys, remediate code)</li>
          <li><strong>Recover:</strong> Restore normal operations and verify integrity</li>
          <li><strong>Notify:</strong> Inform affected users within 72 hours if consumer data was compromised. Notify integration partners (Plaid) as required by their security agreements</li>
          <li><strong>Review:</strong> Conduct post-incident review and update this policy if needed</li>
        </ul>
      </section>

      {/* 11. Consumer Application Security */}
      <section>
        <h2>11. Consumer Application Security</h2>
        <ul>
          <li><strong>Multi-factor authentication:</strong> TOTP-based 2FA is available on all consumer accounts and enforced at the middleware level when enabled</li>
          <li><strong>Password policy:</strong> Minimum 8 characters, must meet 4 of 5 complexity requirements (uppercase, lowercase, number, special character, length). Strength is enforced on both client and server</li>
          <li><strong>Session management:</strong> Users can view active sessions, sign out other devices, and monitor login activity</li>
          <li><strong>Account deletion:</strong> Users can self-service delete their account and all associated data from Settings. Deletion cascades through all data tables and removes the auth record</li>
          <li><strong>Rate limiting:</strong> Login (5 attempts / 15 min per email), signup (3 per IP per hour, plus per-domain and global caps), password reset (3 / hour per email)</li>
        </ul>
      </section>

      {/* 12. Third-Party Integration Security */}
      <section>
        <h2>12. Third-Party Integration Security</h2>

        <h3>12.1 Plaid</h3>
        <ul>
          <li>Helm never receives or stores bank login credentials - Plaid handles all bank authentication</li>
          <li>Read-only access only - no transaction initiation or fund transfer capabilities</li>
          <li>Plaid access tokens are encrypted at the application layer (AES-256-GCM) before storage and never exposed to client code (section 6.4)</li>
          <li>Separate API keys for sandbox and production environments</li>
          <li>Webhook signatures verified on all incoming Plaid events</li>
        </ul>

        <h3>12.2 Market Data (Polygon.io)</h3>
        <ul>
          <li>No consumer PII is shared with Polygon - only ticker symbols are queried</li>
          <li>Market data (prices, news, dividends) is stored in shared tables not subject to user RLS</li>
          <li>API key stored in server-side environment variables only</li>
        </ul>
      </section>

      {/* 13. Policy Review */}
      <section>
        <h2>13. Policy Review &amp; Maintenance</h2>
        <p>
          This Information Security Policy is reviewed and updated on a <strong>quarterly</strong> basis,
          or sooner if triggered by:
        </p>
        <ul>
          <li>A security incident</li>
          <li>A material change to the application architecture or data processing</li>
          <li>New regulatory or partner requirements (e.g., Plaid attestation updates)</li>
          <li>Findings from an access review or vulnerability scan</li>
        </ul>
        <p>
          All policy changes are versioned and approved by the Security Owner before taking effect.
        </p>
      </section>

      {/* 14. Contact */}
      <section>
        <h2>14. Contact</h2>
        <p>
          For questions about this policy or to report a security concern, contact:{' '}
          <a href="mailto:security@helmterminal.dev">security@helmterminal.dev</a>
        </p>
      </section>
    </LegalPageLayout>
  );
}
