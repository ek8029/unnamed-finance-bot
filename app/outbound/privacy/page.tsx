import { LegalPageLayout } from '@/components/legal-page-layout';

// Helm Outbound's own policy and SMS terms, separate from the Helm Terminal
// app policy at /privacy. The wording is Evan's (2026-11-08); carriers and
// Meta read this page, so change it only with him. Keep id="sms-terms": links
// go straight to that section.

export const metadata = {
  title: 'Helm Outbound Privacy Policy',
  description: 'Helm Outbound Privacy Policy',
  alternates: { canonical: 'https://helmterminal.dev/outbound/privacy' },
};

const EMAIL = 'evan@helmterminal.dev';
const emailLink = <a href={`mailto:${EMAIL}`}>{EMAIL}</a>;

export default function OutboundPrivacyPage() {
  return (
    <LegalPageLayout title="Helm Outbound Privacy Policy" dateLabel="Effective" lastUpdated="November 8, 2026">
      <section>
        <h2>Who we are</h2>
        <p>
          Helm Outbound is a lead generation service run by Helm Financial Corp. (&quot;Helm&quot;, &quot;we&quot;, &quot;us&quot;). We run ads, lead forms, text message follow-up and appointment booking for home improvement and home service contractors (&quot;our clients&quot;). This policy covers Helm Outbound only. The Helm Terminal app has its own policy at helmterminal.dev/privacy.
        </p>
      </section>

      <section>
        <h2>Information we collect</h2>
        <ul>
          <li>From homeowners who fill out a lead form on Facebook, Instagram or a client&apos;s website: your name, phone number, email, zip code or address, and your answers about your project, such as whether you own the home, the type of project and your timing.</li>
          <li>The messages you send in reply to our texts, and the appointment you book.</li>
          <li>From businesses we contact about our own service: the business name, email and phone number published on the business&apos;s website or in public business listings.</li>
          <li>Basic technical information from our booking pages, such as browser type and pages visited, used to keep them working.</li>
        </ul>
      </section>

      <section>
        <h2>How we use it</h2>
        <ul>
          <li>To contact you about the estimate you asked for, by text, phone or email.</li>
          <li>To confirm details about your project, and to book, remind you of or reschedule your appointment.</li>
          <li>To pass your request to the contractor you asked to hear from.</li>
          <li>To measure how well our clients&apos; ads and forms perform.</li>
          <li>For businesses: to email you about Helm Outbound. Reply &quot;no&quot; to any of our emails and we will stop.</li>
        </ul>
      </section>

      <section>
        <h2>Who we share it with</h2>
        <ul>
          <li>The contractor whose ad or form you responded to, so they can give you your estimate. They handle your information under their own privacy practices.</li>
          <li>Service providers that run our systems for us, such as our CRM and messaging platform (HighLevel / LeadConnector), Meta when you use a Facebook or Instagram lead form, and our email and calendar providers. They may use your information only to provide services to us.</li>
          <li>Authorities, when the law requires it.</li>
        </ul>
        <p>
          We do not sell personal information. No mobile information will be shared with third parties or affiliates for marketing or promotional purposes. All of the categories above exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.
        </p>
      </section>

      <section>
        <h2 id="sms-terms">Text messages (SMS terms)</h2>
        <ul>
          <li>Program: estimate and appointment text messages from the home improvement contractor you contacted, sent through Helm Outbound.</li>
          <li>When you submit a form with your phone number and agree to receive texts, we text you about your estimate request: questions about your project, scheduling, confirmations and reminders.</li>
          <li>Message frequency varies. Message and data rates may apply.</li>
          <li>Reply STOP at any time to stop receiving texts. Reply HELP for help, or email {emailLink}.</li>
          <li>Agreeing to receive texts is not a condition of any purchase.</li>
          <li>Carriers are not liable for delayed or undelivered messages.</li>
        </ul>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <p>
          We keep lead and appointment records while we work with the contractor you contacted and for up to 24 months after that, unless you ask us to delete them sooner or the law requires us to keep them longer.
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <ul>
          <li>Reply STOP to any text, or &quot;no&quot; to any email, to stop hearing from us.</li>
          <li>Email {emailLink} to see, correct or delete your information. We respond within 30 days.</li>
          <li>Depending on where you live, you may have additional privacy rights. We honor those requests.</li>
        </ul>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          We protect your information with access controls and encrypted connections through our providers. No method of storage or transmission is completely secure.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>
          Helm Outbound is not directed to children under 16, and we do not knowingly collect their information.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          If we change this policy, we will post the new version here with a new effective date.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Helm Financial Corp.
          <br />
          {emailLink}
        </p>
      </section>
    </LegalPageLayout>
  );
}
