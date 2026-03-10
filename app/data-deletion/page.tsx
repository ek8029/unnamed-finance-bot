import { LegalPageLayout } from '@/components/legal-page-layout';

export const metadata = {
  title: 'Data Deletion - Helm',
  description: 'How to delete your Helm account and all associated financial data.',
};

// TODO: Update with specific data retention timelines and compliance details before launch.

export default function DataDeletionPage() {
  return (
    <LegalPageLayout title="Data Deletion" lastUpdated="March 10, 2026">
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
          <li>Navigate to <strong>Settings &gt; Data &amp; Privacy</strong></li>
          <li>Click <strong>Delete Account</strong></li>
          <li>Enter your password and type &ldquo;DELETE&rdquo; to confirm</li>
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
          <a href="mailto:privacy@helmterminal.dev">privacy@helmterminal.dev</a> with the subject line
          &ldquo;Account Deletion Request.&rdquo; Include the email address associated with your account.
        </p>
        <p>
          We will verify your identity and process the deletion within 30 days of receiving your request.
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

      {/* Contact */}
      <section>
        <h2>Questions</h2>
        <p>
          For questions about data deletion or your privacy rights, contact{' '}
          <a href="mailto:privacy@helmterminal.dev">privacy@helmterminal.dev</a>.
        </p>
      </section>
    </LegalPageLayout>
  );
}
