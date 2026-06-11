import { LegalPageLayout } from '@/components/legal-page-layout';

export const metadata = {
  title: 'Privacy Policy - Helm',
  description: 'How Helm collects, uses, and protects your financial data.',
  alternates: { canonical: 'https://helmterminal.dev/privacy' },
};

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="March 10, 2026">
      {/* 1. Introduction */}
      <section>
        <h2>1. Introduction</h2>
        <p>
          Helm (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) operates the Helm financial intelligence
          platform at <strong>helmterminal.dev</strong>. This Privacy Policy explains what information we collect,
          how we use it, and your rights regarding your data. We are committed to protecting your financial
          information with the same diligence you&apos;d expect from an institutional-grade platform.
        </p>
      </section>

      {/* 2. Information We Collect */}
      <section>
        <h2>2. Information We Collect</h2>

        <h3>Account Information</h3>
        <p>When you create an account, we collect:</p>
        <ul>
          <li>Email address</li>
          <li>Full name (optional)</li>
          <li>Encrypted password (we never store plaintext passwords)</li>
        </ul>

        <h3>Financial Data via Plaid</h3>
        <p>
          When you connect financial accounts through Plaid, we receive read-only access to:
        </p>
        <ul>
          <li>Account balances and account metadata (institution name, account type)</li>
          <li>Transaction history (merchant, amount, date, category)</li>
          <li>Investment holdings (ticker, shares, cost basis)</li>
          <li>Liability information (credit cards, loans)</li>
        </ul>
        <p>
          We <strong>never</strong> receive or store your bank login credentials. Plaid handles authentication
          directly with your financial institution. See{' '}
          <a href="https://plaid.com/legal/" target="_blank" rel="noopener noreferrer">
            Plaid&apos;s privacy policy
          </a>{' '}
          for details on their data handling.
        </p>

        <h3>Market Data</h3>
        <p>
          We fetch publicly available market data (prices, dividends, news, splits) from third-party
          providers to enrich your portfolio view. This data is not personal information.
        </p>

        <h3>Usage Data</h3>
        <p>
          We may collect anonymized usage analytics (pages visited, features used) to improve the product.
          You can disable this in Settings &gt; Data &amp; Privacy.
        </p>
      </section>

      {/* 3. How We Use Your Data */}
      <section>
        <h2>3. How We Use Your Data</h2>
        <p>We use your data exclusively to:</p>
        <ul>
          <li>Display your financial dashboard, portfolio, and analytics</li>
          <li>Generate financial insights and intelligence (spending patterns, tax opportunities, risk analysis)</li>
          <li>Detect recurring transactions and subscriptions</li>
          <li>Calculate net worth, financial health scores, and performance metrics</li>
          <li>Send transactional emails (password resets, account confirmations)</li>
          <li>Improve our product and fix bugs</li>
        </ul>
        <p>
          We do <strong>not</strong> sell, rent, or share your personal financial data with third parties
          for advertising or marketing purposes. We do <strong>not</strong> use your data to make
          credit decisions, insurance underwriting, or employment screening.
        </p>
      </section>

      {/* 4. Data Storage & Security */}
      <section>
        <h2>4. Data Storage &amp; Security</h2>
        <ul>
          <li>All data is stored in Supabase (PostgreSQL) with Row-Level Security (RLS) enforced - you can only access your own data</li>
          <li>All connections use TLS 1.2+ encryption in transit</li>
          <li>Data at rest is encrypted via AES-256 by our infrastructure provider</li>
          <li>Authentication tokens are short-lived JWTs with secure HTTP-only cookies</li>
          <li>Auth events (logins, password changes) are logged for security monitoring</li>
          <li>Rate limiting protects against brute-force attacks</li>
        </ul>
      </section>

      {/* 5. Data Retention */}
      <section>
        <h2>5. Data Retention</h2>
        <p>
          We retain your financial data for as long as your account is active. Transaction history
          and portfolio snapshots are kept to provide historical analytics and trend analysis.
        </p>
        <p>
          When you delete your account, access is revoked immediately, all personal data is removed
          from active databases within 24 hours, and purged from encrypted backups within 30 days.
          See our <a href="/data-deletion">Data Deletion</a> page for the full timeline.
        </p>
      </section>

      {/* 6. Your Rights */}
      <section>
        <h2>6. Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li><strong>Access</strong> - Export all your data at any time via Settings &gt; Data &amp; Privacy &gt; Export</li>
          <li><strong>Correction</strong> - Update your profile information in Settings</li>
          <li><strong>Deletion</strong> - Permanently delete your account and all associated data</li>
          <li><strong>Portability</strong> - Download your data in JSON format</li>
          <li><strong>Opt out</strong> - Disable analytics and crash reporting in Settings</li>
        </ul>
      </section>

      {/* 7. Third-Party Services */}
      <section>
        <h2>7. Third-Party Services</h2>
        <p>Helm integrates with the following third-party services:</p>
        <ul>
          <li><strong>Plaid</strong> - Account aggregation and transaction data</li>
          <li><strong>Finazon</strong> - Market data, real-time quotes, and historical prices</li>
          <li><strong>OpenAI</strong> - AI-powered financial analysis (your query and portfolio context are sent for analysis but never used for model training)</li>
          <li><strong>Supabase</strong> - Database and authentication infrastructure</li>
          <li><strong>Vercel</strong> - Application hosting</li>
        </ul>
        <p>Each service operates under its own privacy policy and data handling practices.</p>
      </section>

      {/* 8. Changes */}
      <section>
        <h2>8. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Material changes will be communicated
          via email or an in-app notification. Continued use of Helm after changes constitutes acceptance.
        </p>
      </section>

      {/* 9. Contact */}
      <section>
        <h2>9. Contact</h2>
        <p>
          For privacy-related questions or requests, contact us at{' '}
          <a href="mailto:privacy@helmterminal.dev">privacy@helmterminal.dev</a>.
        </p>
      </section>
    </LegalPageLayout>
  );
}
