import { LegalPageLayout } from '@/components/legal-page-layout';

export const metadata = {
  title: 'Terms of Service — Helm',
  description: 'Terms and conditions for using the Helm financial intelligence platform.',
};

// TODO: Replace placeholder text with formally reviewed legal terms before production launch.

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service" lastUpdated="March 10, 2026">
      {/* 1. Agreement */}
      <section>
        <h2>1. Agreement to Terms</h2>
        <p>
          By accessing or using Helm (&ldquo;the Service&rdquo;), you agree to be bound by these Terms of Service.
          If you do not agree, you may not use the Service. These terms constitute a legally binding agreement
          between you and Helm.
        </p>
      </section>

      {/* 2. Description */}
      <section>
        <h2>2. Description of Service</h2>
        <p>
          Helm is a personal financial intelligence platform that aggregates data from your linked financial
          accounts to provide analytics, portfolio insights, and financial health monitoring. The Service
          is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis.
        </p>
      </section>

      {/* 3. Eligibility */}
      <section>
        <h2>3. Eligibility</h2>
        <p>
          You must be at least 18 years of age and capable of entering into a binding legal agreement
          to use this Service. By creating an account, you represent that you meet these requirements.
        </p>
      </section>

      {/* 4. Account Responsibilities */}
      <section>
        <h2>4. Account Responsibilities</h2>
        <p>You are responsible for:</p>
        <ul>
          <li>Maintaining the confidentiality of your login credentials</li>
          <li>All activity that occurs under your account</li>
          <li>Notifying us immediately if you suspect unauthorized access</li>
          <li>Ensuring the accuracy of the information you provide</li>
        </ul>
        <p>
          We reserve the right to suspend or terminate accounts that violate these terms or exhibit
          suspicious activity.
        </p>
      </section>

      {/* 5. Acceptable Use */}
      <section>
        <h2>5. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any unlawful purpose or in violation of any applicable laws</li>
          <li>Attempt to gain unauthorized access to other users&apos; accounts or data</li>
          <li>Reverse-engineer, decompile, or attempt to extract the source code of the Service</li>
          <li>Use automated systems (bots, scrapers) to access the Service without permission</li>
          <li>Interfere with or disrupt the integrity or performance of the Service</li>
          <li>Misrepresent your identity or affiliation</li>
        </ul>
      </section>

      {/* 6. No Financial Advice */}
      <section>
        <h2>6. No Financial Advice Disclaimer</h2>
        <p>
          <strong>
            Helm is an information and analytics tool. It does not provide financial advice,
            investment recommendations, tax advice, or any other form of professional financial counsel.
          </strong>
        </p>
        <p>
          The insights, scores, projections, and analytics displayed by Helm are for informational purposes
          only and should not be relied upon as the sole basis for any financial decision. Information
          presented may be delayed, incomplete, or inaccurate.
        </p>
        <p>
          You should consult with a qualified financial advisor, tax professional, or other appropriate
          professional before making any financial decisions. Helm is not a registered investment advisor,
          broker-dealer, or tax preparer.
        </p>
      </section>

      {/* 7. Intellectual Property */}
      <section>
        <h2>7. Intellectual Property</h2>
        <p>
          The Service, including its design, code, features, and branding, is owned by Helm and protected
          by copyright and intellectual property laws. You retain ownership of your personal financial data.
          By using the Service, you grant us a limited license to process your data solely to provide the Service.
        </p>
      </section>

      {/* 8. Limitation of Liability */}
      <section>
        <h2>8. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, Helm shall not be liable for any indirect, incidental,
          special, consequential, or punitive damages, including but not limited to:
        </p>
        <ul>
          <li>Loss of profits, revenue, or data</li>
          <li>Financial losses resulting from reliance on information displayed by the Service</li>
          <li>Service interruptions, delays, or errors in data</li>
          <li>Unauthorized access to your account due to your failure to secure your credentials</li>
        </ul>
        <p>
          Our total liability for any claim arising from or related to the Service shall not exceed the
          amount you paid us in the twelve (12) months preceding the claim, or $100, whichever is greater.
        </p>
      </section>

      {/* 9. Account Termination */}
      <section>
        <h2>9. Account Termination</h2>
        <p>
          You may delete your account at any time through Settings &gt; Data &amp; Privacy &gt; Delete Account.
          Upon deletion, your personal data will be permanently removed in accordance with our{' '}
          <a href="/data-deletion">Data Deletion Policy</a>.
        </p>
        <p>
          We may suspend or terminate your access to the Service at our discretion if we believe you have
          violated these Terms, engaged in fraudulent activity, or for any reason with reasonable notice.
        </p>
      </section>

      {/* 10. Changes */}
      <section>
        <h2>10. Changes to Terms</h2>
        <p>
          We reserve the right to modify these Terms at any time. Material changes will be communicated
          via email or in-app notification at least 14 days before they take effect. Your continued use
          of the Service after changes become effective constitutes acceptance of the updated Terms.
        </p>
      </section>

      {/* 11. Governing Law */}
      <section>
        <h2>11. Governing Law</h2>
        <p>
          These Terms shall be governed by and construed in accordance with the laws of the United States.
          Any disputes arising from these Terms or the Service shall be resolved through binding arbitration
          in accordance with the rules of the American Arbitration Association.
        </p>
      </section>

      {/* 12. Contact */}
      <section>
        <h2>12. Contact</h2>
        <p>
          For questions about these Terms, contact us at{' '}
          <a href="mailto:legal@helmterminal.dev">legal@helmterminal.dev</a>.
        </p>
      </section>
    </LegalPageLayout>
  );
}
