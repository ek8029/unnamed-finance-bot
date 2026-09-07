import { LegalPageLayout } from '@/components/legal-page-layout';

export const metadata = {
  title: 'Data Deletion - Helm',
  description: 'How to delete your Helm account and associated financial data.',
  // Without its own canonical this page inherits the root layout's, which is
  // hardcoded to the homepage, so the page sat in the sitemap while telling
  // Google it was a duplicate of /. Apple links here from the App Store
  // listing, so it has to be indexable in its own right.
  alternates: { canonical: 'https://helmterminal.dev/data-deletion' },
};

export default function DataDeletionPage() {
  return (
    <LegalPageLayout title="Data Deletion" lastUpdated="September 7, 2026">
      <section>
        <h2>Delete your account</h2>
        <p>You can request permanent account deletion from Helm itself. You do not need to call support to begin.</p>
        <ul>
          <li><strong>iOS app:</strong> Open Account, choose Delete account, and complete the confirmations.</li>
          <li><strong>Website:</strong> Open <a href="/dashboard/settings#danger">Settings &gt; Danger zone</a>, choose Delete account, and enter your password and DELETE. For an account without an email/password login, enter CONFIRM in the password field.</li>
          <li><strong>Sign in with Apple:</strong> Confirm the Apple account linked to Helm when prompted. We verify the identity and revoke Helm&apos;s Apple authorization before removing account data.</li>
        </ul>
        <p>Deletion is permanent. Export any information you want to keep from the website&apos;s Settings &gt; Data &amp; privacy first.</p>
      </section>

      <section>
        <h2>Subscriptions</h2>
        <p>Apple manages App Store subscriptions separately. Deleting Helm does not cancel an Apple subscription. You can manage or cancel it in iOS Settings &gt; your name &gt; Subscriptions, or <a href="https://apps.apple.com/account/subscriptions">open Apple subscription settings</a>.</p>
        <p>For web subscriptions, we verify that Stripe billing is canceled before completing account deletion. If that verification fails, the account data is retained so you can retry. Provider billing records needed for receipts, refunds or legal obligations may remain with Apple, RevenueCat or Stripe under their policies.</p>
      </section>

      <section>
        <h2>What successful deletion removes</h2>
        <ul>
          <li>Your Helm login, profile, preferences and account-linked referral answers</li>
          <li>Linked financial accounts, holdings, transactions, balances and connection tokens</li>
          <li>Saved portfolio history, tax calculations, personal theses and generated insights</li>
          <li>Device push registrations, AI permission records and account-linked authentication events</li>
        </ul>
        <p>We revoke brokerage access through Plaid before removing its connection tokens. If a required disconnection cannot be confirmed, we show an error and retain account data. Some already completed disconnections or billing cancellations may remain in effect; retrying resumes the process.</p>
      </section>

      <section>
        <h2>What remains separate</h2>
        <ul>
          <li>Your bank and brokerage accounts remain open. Helm has read-only access and cannot close them.</li>
          <li>Public company research and market data are shared information and remain available.</li>
          <li>You can also manage connected apps through your bank or <a href="https://my.plaid.com" target="_blank" rel="noopener noreferrer">Plaid&apos;s portal</a>.</li>
          <li>Third-party API, payment and infrastructure records follow their providers&apos; retention and legal requirements. See the <a href="/privacy">Privacy Policy</a>.</li>
        </ul>
      </section>

      <section>
        <h2>Retention and timing</h2>
        <p>Account-associated financial information remains available while your account is active. Successful self-service deletion removes the account and its associated records from active databases and signs you out. A failed request does not mean deletion completed.</p>
        <p>Encrypted infrastructure backups expire on the configured recovery schedule and are not used to reactivate deleted accounts. Contact <a href="mailto:support@helmterminal.dev">support@helmterminal.dev</a> for the current schedule or confirmation of a deletion request. Separate provider records required for security, billing or legal obligations may outlast the active account.</p>
        <p>Pausing personal AI processing stops future personal-data requests. A request already sent may finish; API providers may retain it under the retention policies linked from our Privacy Policy. Screenshot inputs are not saved by Helm.</p>
      </section>

      <section>
        <h2>Request help or deletion by email</h2>
        <p>If you cannot access your account, email <a href="mailto:support@helmterminal.dev">support@helmterminal.dev</a> with the subject &ldquo;Account Deletion Request&rdquo; and the email associated with Helm. Do not send passwords, access tokens or full financial account numbers. We will verify ownership and respond to the request within 30 days.</p>
        <p>You can also contact us to request access, correction or a portable copy of your information.</p>
      </section>
    </LegalPageLayout>
  );
}
