import { LegalPageLayout } from '@/components/legal-page-layout';

export const metadata = {
  title: 'Security — Helm',
  description: 'How Helm protects your financial data and account security.',
};

// TODO: Update with specific certifications and audit results as they become available.

export default function SecurityPage() {
  return (
    <LegalPageLayout title="Security Practices" lastUpdated="March 10, 2026">
      {/* Overview */}
      <section>
        <h2>Our Commitment</h2>
        <p>
          Helm handles sensitive financial data. We treat security as a foundational requirement,
          not an afterthought. Below is an overview of the measures we take to protect your information.
        </p>
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

      {/* Authentication */}
      <section>
        <h2>Authentication &amp; Access Control</h2>
        <ul>
          <li>Passwords are hashed using bcrypt before storage — we never store plaintext passwords</li>
          <li>Password strength is enforced at signup and password change (uppercase, lowercase, number, special character, minimum 8 characters)</li>
          <li>Authentication uses short-lived JWT tokens with secure, HTTP-only cookies</li>
          <li>Login attempts are rate-limited (5 failed attempts per 15-minute window triggers a temporary lockout)</li>
          <li>All authentication events (logins, password changes, session revocations) are logged for audit purposes</li>
          <li>You can view your login activity and sign out all other devices from Settings &gt; Security</li>
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
          <li><strong>Dependencies:</strong> Regularly audited for known vulnerabilities</li>
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
