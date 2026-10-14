// Helm Outbound page copy, as Evan approved it (2026-10-13). Every layout of
// /outbound, the lab variants included, renders from this file so the words
// stay identical while the design changes. Edit wording here or nowhere.
//
// Copy rules for this page: plain American English, no hype, no exclamation
// marks, no dashes used as punctuation, no claims about clients, results or
// reply rates, and every sentence names its subject.

export const OUTBOUND_META = {
  title: 'Helm Outbound | Helm Financial Corp.',
  description:
    'Outbound prospecting and workflow automation for owner-led businesses that sell to other businesses: researched prospects emailed in your name, and small AI tools that take repetitive work off your desk.',
};

// The page stands on its own: it carries its own wordmark and legal links
// instead of the Helm Terminal nav and footer.
export const BRAND = { wordmark: 'Helm Outbound' };
export const LEGAL_LINKS = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
];

export const SAMPLE_MAILTO = 'mailto:evan@helmterminal.dev?subject=Free%20sample%20of%20ten';
export const CALENDLY_URL = 'https://calendly.com/evan-helm';

export const HERO = {
  eyebrow: 'Helm Financial Corp. · Outbound prospecting and automation',
  headline: 'New commercial accounts, researched and contacted in your name.',
  subhead:
    'Helm finds businesses that fit what you sell, emails them in your name using wording you approve, follows up, and sends every interested reply to you. Helm also builds small AI tools that take repetitive office work off your plate.',
  // Scrolls to the intake form on /outbound (SAMPLE_FORM below).
  primary: { label: 'Ask for a free sample of ten', href: '#sample' },
  secondary: { label: 'Book a 15-minute call', href: CALENDLY_URL },
};

export const WHO = {
  heading: 'Who it’s for',
  // Generalized 2026-10-13 at Evan's request: the page no longer names
  // industries. The earlier list was commercial cleaning, staffing and
  // recruiting, security, landscaping and grounds, building trades, and
  // independent insurance agencies.
  body: 'Owner-led businesses that sell to other businesses, in any industry.',
};

export const PROSPECTING = {
  heading: 'Outbound prospecting: how it works',
  steps: [
    {
      lead: 'You set the target.',
      body: 'The kinds of business you want, the area and the size. Current clients and anyone you name are left out.',
    },
    {
      lead: 'Research, then your approval.',
      body: 'Each prospect comes with the reason it fits, from public records such as permits, licenses and property sales, and a named contact with the public source. You approve the list and the wording before anything is sent.',
    },
    {
      lead: 'Outreach in your name.',
      body: 'A first email and up to two follow-ups go out from an address in your name. Interested replies come straight to your inbox, and you take it from there.',
    },
  ],
  sample: {
    heading: 'The free sample',
    items: [
      'Ten prospects that fit what you sell, in the area you choose',
      'Why each one fits, with the public source',
      'A named owner or manager, with where the name was published',
      'A drafted email for each, in your name',
      'Nothing is sent and there is no commitment',
    ],
  },
  pilot: {
    heading: 'The 30-day pilot',
    items: [
      'A few hundred prospects researched the same way',
      'A first email and two follow-ups each, in wording you approve',
      'Interested replies forwarded as they arrive, and a weekly summary',
      '$1,000 to start. The second $1,000 is due only if the pilot brings at least three interested replies',
      'The list and the wording are yours to keep',
    ],
  },
  after:
    'After 30 days, stop, or continue monthly from $1,000 a month depending on volume, agreed in advance.',
};

export const AUTOMATION = {
  heading: 'Workflow automation',
  intro:
    'Small AI tools built around one repetitive task in your business. Each one drafts work for a person to review; nothing goes out without you.',
  items: [
    { label: 'Inquiry intake', body: 'quote requests and inquiries read, sorted and drafted into a reply for your review' },
    { label: 'Follow-up tracking', body: 'open quotes, proposals and inspections listed with the next step, so none go quiet' },
    { label: 'Quotes and proposals', body: 'first drafts built from your own templates and rates' },
    { label: 'Weekly reporting', body: 'a short summary pulled from your inbox, spreadsheets or CRM' },
  ],
  closing:
    'Each automation starts with a free 20-minute review of the task, then a fixed quote before any work begins.',
};

export const QUESTIONS = {
  heading: 'Questions',
  items: [
    {
      q: 'Who sends the emails, and from what address?',
      a: 'A separate address in your name, on a domain set up only for this. Your main email and website domain are never used for outreach. Every reply forwards to your normal inbox.',
    },
    {
      q: 'Do you sell leads?',
      a: 'No. Helm does not sell lists or leads. The prospects are researched for your business alone, and you talk to the ones who answer.',
    },
    {
      q: 'Where do the prospects come from?',
      a: 'Public records and the businesses’ own websites: permits, license lists, property sales, new registrations, company announcements and careers pages. No bought lists.',
    },
    {
      q: 'Is it compliant?',
      a: 'Every email names you and your business, carries your mailing address and a one-line opt-out, and anyone who opts out is never emailed again.',
    },
    {
      q: 'Who is behind Helm?',
      a: 'Helm Financial Corp. is run by Evan Kim. The company also builds Helm Terminal, investment research software, and this service runs on the same research tools.',
    },
  ],
};

// The free sample intake form on /outbound. It posts to
// /api/outbound/sample, which emails the request to `to` with reply-to set
// to the sender. New wording 2026-10-14, not reviewed yet.
export const SAMPLE_FORM = {
  id: 'sample',
  to: 'evan@helmterminal.dev',
  heading: 'Ask for a free sample of ten',
  intro:
    'Tell Helm what you sell and who you want to reach. Ten researched prospects come back to you by email, and nothing is sent in your name.',
  fields: {
    name: { label: 'Your name', placeholder: '' },
    business: { label: 'Business name', placeholder: '' },
    email: { label: 'Email', placeholder: '' },
    phone: { label: 'Phone (optional)', placeholder: '' },
    sells: { label: 'What you sell', placeholder: 'Office and medical cleaning' },
    targets: { label: 'Who you want to reach', placeholder: 'Property managers, clinics' },
    area: { label: 'Area', placeholder: 'Queens and Nassau' },
    exclude: { label: 'Names to leave out (optional)', placeholder: 'Current clients, open bids' },
  },
  submit: 'Ask for a free sample of ten',
  sending: 'Sending',
  note: 'Helm uses these details only to research your sample.',
  sent: {
    title: 'Your request is in.',
    body: 'Evan will reply by email from evan@helmterminal.dev.',
  },
  error: 'The request did not send. Please try again, or email evan@helmterminal.dev.',
};

// The Outbound cookie notice. Shorter than the site-wide banner, whose
// wording refers to Helm Terminal accounts and settings (approved 2026-10-13).
export const COOKIE_NOTICE = {
  text: 'This site uses cookies and similar tools for analytics.',
  link: { label: 'Privacy Policy', href: '/privacy' },
  button: 'Got it',
};

export const FOOTER = {
  company: 'Helm Financial Corp.',
  address: '51-35 Reeder St, Elmhurst, NY 11373',
  email: 'evan@helmterminal.dev',
};

// Illustrations on /outbound, for an example commercial cleaning client:
// the target (How it works), one researched prospect (beside The free
// sample) and an automation draft. Invented businesses and people, labeled
// "Example" on the page. Evan wrote the prospect card and kept the target
// card (2026-10-13); the automation draft has not been reviewed yet.
export const EXAMPLES = {
  tag: 'Example',
  target: {
    title: 'Target',
    rows: [
      { label: 'Kind of business', chips: ['Medical offices', 'Property managers', 'Private schools'] },
      { label: 'Area', value: 'Queens and western Nassau' },
      { label: 'Size', value: '10,000 to 80,000 square feet' },
      { label: 'Left out', value: 'Current clients and 6 names you listed' },
    ],
  },
  prospect: {
    title: 'Prospect 3 of 10',
    rows: [
      { label: 'Building', value: 'Four-story office building, 38,000 square feet' },
      { label: 'Why it fits', value: 'Sold in August 2026, per county property records' },
      { label: 'Contact', value: 'Dana Reyes, Property Manager' },
      { label: 'Source', value: 'The management company’s website' },
    ],
    emailLabel: 'Drafted email',
    email:
      'Hi Dana, I saw the building changed owners in August. If the cleaning contract is up for review, I’d be glad to walk the floors and send a quote.',
  },
  draft: {
    source: 'Quote request from your website',
    subject: 'Weekly cleaning, 3 floors, 12,000 square feet',
    tags: ['Commercial cleaning', 'Quote needed'],
    replyLabel: 'Drafted reply',
    reply: 'Thanks for reaching out. To put a quote together, could you tell me how many restrooms there are and what time the office closes?',
    status: 'Waiting for your review',
  },
};