import { LegalPageLayout } from '@/components/legal-page-layout';

export const metadata = {
  title: 'Data Deletion - Helm',
  description: 'How to delete your Helm account and all associated financial data.',
};

export default function DataDeletionPage() {
  return (
    <LegalPageLayout title="Data Deletion" lastUpdated="March 17, 2026">
      {/* Overview */}
      <section>
        <h2>Your Right to Delete</h2>
        <p>
          You have full control over your data. You can permanently delete your Helm account and all
          associated financial data at any time. We do not retain personal financial information after
          account deletion.
        </p>
      </section>

      {/* Self-Service */}
      <section>
        <h2>Self-Service Account Deletion</h2>
        <p>You can delete your account directly from the app:</p>
        <ul>
          <li>Navigate to <strong>Settings &gt; Danger zone</strong> (direct link: <a href="/dashboard/settings#danger">helmterminal.dev/dashboard/settings#danger</a>)</li>
          <li>Click <strong>Delete account</strong></li>
          <li>Enter your password (if you sign in with Google or Apple, type &ldquo;CONFIRM&rdquo; instead) and type &ldquo;DELETE&rdquo; to confirm</li>
          <li>Your account and all data will be permanently removed</li>
        </ul>
      </section>

      {/* What Gets Deleted */}
      <section>
        <h2>What Gets Deleted</h2>
        <p>When you delete your account, we permanently remove:</p>
        <ul>
          <li>Your user profile and preferences</li>
          <li>All linked financial accounts and connection tokens</li>
          <li>All transaction history</li>
          <li>All investment holdings and portfolio data</li>
          <li>Net worth history and financial health scores</li>
          <li>Tax estimates and capital gains records</li>
          <li>All generated insights and intelligence</li>
          <li>Recurring transaction detection data</li>
          <li>Authentication and login activity logs</li>
        </ul>
      </section>

      {/* What We Don't Delete */}
      <section>
        <h2>What Is Not Affected</h2>
        <p>The following are <strong>not</strong> affected by deleting your Helm account:</p>
        <ul>
          <li><strong>Your bank accounts</strong> - Helm has read-only access. We cannot modify your accounts. Deleting Helm does not close or affect your bank accounts.</li>
          <li><strong>Plaid connections</strong> - We revoke our access, but you may also want to remove Helm from your connected apps in your bank&apos;s settings or via <a href="https://my.plaid.com" target="_blank" rel="noopener noreferrer">Plaid&apos;s portal</a>.</li>
          <li><strong>Shared market data</strong> - Publicly available market prices, news, and events are not personal data and are retained.</li>
        </ul>
      </section>

      {/* Email Request */}
      <section>
        <h2>Request Deletion via Email</h2>
        <p>
          If you are unable to access your account or prefer to request deletion via email, contact us at{' '}
          <a href="mailto:support@helmterminal.dev">support@helmterminal.dev</a> with the subject line
          &ldquo;Account Deletion Request.&rdquo; Include the email address associated with your account.
        </p>
        <p>
          We will verify your identity and process the deletion within 30 days of receiving your request.
        </p>
      </section>

      {/* Data Retention */}
      <section>
        <h2>Data Retention Policy</h2>
        <p>While your account is active, we retain your financial data only as long as needed to provide the service:</p>
        <ul>
          <li><strong>Financial data</strong> (transactions, holdings, balances) — retained while your account is active. Deleted upon account deletion.</li>
          <li><strong>Authentication logs</strong> — retained for 90 days for security and fraud prevention, then automatically purged.</li>
          <li><strong>Plaid access tokens</strong> — revoked and deleted immediately upon account deletion or when you disconnect an institution.</li>
          <li><strong>Analytics</strong> — we use privacy-first analytics (Plausible). No personal identifiers are collected or stored.</li>
        </ul>
        <p>
          We do not sell, rent, or share your personal financial data with third parties for marketing or advertising purposes. Data is processed solely to deliver Helm&apos;s intelligence features to you.
        </p>
      </section>

      {/* Timeline */}
      <section>
        <h2>Deletion Timeline</h2>
        <ul>
          <li><strong>Immediate:</strong> Account access is revoked and you are signed out</li>
          <li><strong>Within 24 hours:</strong> All personal data is removed from active databases</li>
          <li><strong>Within 30 days:</strong> Data is purged from encrypted backups</li>
        </ul>
      </section>

      {/* Your Rights */}
      <section>
        <h2>Your Rights</h2>
        <p>Depending on your jurisdiction, you may have the right to:</p>
        <ul>
          <li><strong>Access</strong> — request a copy of the personal data we hold about you</li>
          <li><strong>Rectification</strong> — correct inaccurate data</li>
          <li><strong>Erasure</strong> — delete your data (as described above)</li>
          <li><strong>Portability</strong> — receive your data in a machine-readable format</li>
        </ul>
        <p>
          To exercise any of these rights, contact{' '}
          <a href="mailto:support@helmterminal.dev">support@helmterminal.dev</a>.
          We will respond within 30 days.
        </p>
      </section>

      {/* Contact */}
      <section>
        <h2>Questions</h2>
        <p>
          For questions about data deletion or your privacy rights, contact{' '}
          <a href="mailto:support@helmterminal.dev">support@helmterminal.dev</a>.
        </p>
      </section>
    </LegalPageLayout>
  );
}
