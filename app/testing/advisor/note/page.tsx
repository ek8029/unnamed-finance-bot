// 03 · The notes. One page each, email-native, in the advisor's voice.
//
// Two kinds. The event note: what changed, what the source document says, what
// it means for the pre-committed rule, what we are doing (including nothing),
// with April's call revisited and graded. The legacy position review: the
// names with nothing written down against them, what the company itself last
// filed about each, and a question for the client. No projections, no
// counterfactuals, and each guardrail shows what it would not let through.

import Link from 'next/link';
import { ALL_POSITIONS, ALL_REASONS, LEGACY_NOTE, usd } from '../_data';

const LETTERHEAD = (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 10, marginBottom: 14, borderBottom: '2px solid var(--ink)' }}>
    <span style={{ fontFamily: 'var(--serif)', fontSize: 18 }}>Larkspur Wealth Partners</span>
    <span className="adv-eyebrow">Sarah Whitcomb, CFP · sarah@larkspurwealth.com</span>
  </div>
);

const GATE = (
  <>
    <div style={{ marginTop: 18 }}>
      <button type="button" className="adv-btn fill">Review and sign</button>
      <button type="button" className="adv-btn">Save to CRM as a draft</button>
      <button type="button" className="adv-btn quiet">Do not send</button>
    </div>
    <div style={{ marginTop: 10, fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '.06em', color: 'var(--ink-3)' }}>
      Nothing leaves under your name until you sign it. Drafts are never sent on their own.
    </div>
  </>
);

export default function AdvisorNote() {
  const legacyValue = LEGACY_NOTE.reduce((s, n) => s + n.value, 0);

  return (
    <main className="adv-page">
      {/* ── note one: the event note ── */}
      <div className="adv-cols" style={{ gridTemplateColumns: 'minmax(0, 1fr) 300px' }}>
        <div className="adv-note">
          {LETTERHEAD}
          <div className="adv-eyebrow">Draft 01 · Event note · NVDA · for the Okafor household</div>
          <h1 className="adv-note-subj">What the NVIDIA 10-Q said, and what we are doing about it</h1>
          <div className="adv-note-from">From Sarah Whitcomb · to Harold and June Okafor · drafted 06:34, not sent</div>

          <div className="adv-note-block">
            <div className="adv-eyebrow">What changed</div>
            <p>
              NVIDIA filed its quarterly report yesterday evening. One line in it bears on the reason we hold the position,
              and I want you to see it before Thursday rather than after.
            </p>
          </div>

          <div className="adv-note-block">
            <div className="adv-eyebrow">What the filing says</div>
            <blockquote>
              &ldquo;Inventory of data center products increased to $9.1 billion, reflecting purchase commitments made in
              anticipation of demand that did not fully materialize in the quarter.&rdquo;
            </blockquote>
            <div className="adv-note-src">Form 10-Q, filed 2026-08-25, page 23. Retrieved 2026-08-26 06:31 ET.</div>
          </div>

          <div className="adv-note-block">
            <div className="adv-eyebrow">What it means for the reason we own it</div>
            <p>
              When we reviewed this in April, Harold&rsquo;s case rested on supply not keeping up with data-center demand.
              This is the first filing in six quarters where the company describes the opposite: product built ahead of
              orders that did not arrive. The backlog they report is still large. The supply-constraint part of the case is
              no longer something the company itself is saying.
            </p>
          </div>

          <div className="adv-note-block">
            <div className="adv-eyebrow">What we said in April, revisited</div>
            <div className="adv-note-grade">
              <div>
                <div className="adv-eyebrow" style={{ color: 'var(--ink-3)' }}>Apr 9, 2026</div>
                &ldquo;We are holding through the tariff selloff because the data-center order book is intact and supply is
                the constraint, not demand.&rdquo;
              </div>
              <div>
                <div className="adv-eyebrow" style={{ color: 'var(--ink-3)' }}>Aug 26, 2026</div>
                The order book held. Supply as the constraint did not. Half of that call is still right, and the half that
                changed is the half that mattered for the size of the position.
              </div>
            </div>
          </div>

          <div className="adv-note-block">
            <div className="adv-eyebrow">What we are doing</div>
            <p>
              Nothing before we speak. NVDA is 18% of the household across your three accounts, and two of those three are
              accounts you run rather than ones we manage. On Thursday I would like to talk about risk-sizing it, which
              means you keep the exposure and the idea while we bring the weight down. No decision is needed from you today.
            </p>
          </div>

          <div className="adv-note-block" style={{ borderBottom: '1px solid var(--rule)' }}>
            <p style={{ color: 'var(--ink-2)' }}>Sarah</p>
          </div>

          {GATE}
        </div>

        <aside className="adv-rail">
          <div className="adv-eyebrow">Also holds NVDA</div>
          <div className="adv-stat">
            <div className="adv-stat-l">
              <b>10 other households.</b> Each gets its own draft with its own weight, its own April note and its own
              accounts. Nothing is sent in bulk.
            </div>
            <div style={{ marginTop: 10 }}>
              <button type="button" className="adv-btn quiet">Draft the other ten</button>
            </div>
          </div>

          <div className="adv-eyebrow" style={{ marginTop: 22 }}>Left out of this note</div>
          <div className="adv-stat">
            <div className="adv-guard">
              <span className="adv-struck">&ldquo;Had we trimmed in March you would be $41,000 better off.&rdquo;</span>
              <br /><b>Left out.</b> A hypothetical figure would make this note an advertisement under the Marketing Rule,
              206(4)-1(e)(1).
              <br /><br />
              <span className="adv-struck">&ldquo;Our model expects the stock to recover by Q1.&rdquo;</span>
              <br /><b>Left out.</b> A forecast. The note quotes the filing and stops there.
            </div>
          </div>

          <div className="adv-eyebrow" style={{ marginTop: 22 }}>Notes this week</div>
          <div className="adv-stat">
            <div className="adv-stat-l" style={{ lineHeight: 1.7 }}>
              Event note · Okafor, NVDA<br />
              Legacy position review · Okafor, four names<br />
              Nothing changed, here is why · 27 households<br />
              Before a vest · Lindqvist, Sep 1
            </div>
          </div>

          <div className="adv-eyebrow" style={{ marginTop: 22 }}>Receipts in this note</div>
          <div className="adv-stat">
            <div className="adv-stat-l" style={{ fontFamily: 'var(--mono)', fontSize: 11.5, lineHeight: 1.7 }}>
              10-Q 2026-08-25 p.23 · retrieved 06:31<br />
              April note · sent 2026-04-09 · on file<br />
              Household weights · synced 06:12<br />
              Reasons tested: 6 · contradicted: 1
            </div>
          </div>

          <div style={{ marginTop: 22 }}>
            <Link href="/testing/advisor/client" className="adv-btn quiet">Back to the household</Link>
          </div>
        </aside>
      </div>

      {/* ── note two: the legacy position review ── */}
      <div style={{ borderTop: '2px solid var(--ink)', marginTop: 44, paddingTop: 28 }}>
        <div className="adv-cols" style={{ gridTemplateColumns: 'minmax(0, 1fr) 300px' }}>
          <div className="adv-note">
            {LETTERHEAD}
            <div className="adv-eyebrow">Draft 02 · Legacy position review · for the Okafor household</div>
            <h1 className="adv-note-subj">Why we still own this: four names, and a question for Thursday</h1>
            <div className="adv-note-from">From Sarah Whitcomb · to Harold and June Okafor · drafted 06:41, not sent</div>

            <div className="adv-note-block">
              <div className="adv-eyebrow">Why I am writing</div>
              <p>
                Four of the companies you own have no reason written down beside them in our file. Three came across in the
                2019 transfer and one was bought in 2021, and none has come up in a review since. Together they are{' '}
                {usd(legacyValue)}. Nothing is wrong with any of them. I would just rather we owned them on purpose.
              </p>
            </div>

            {LEGACY_NOTE.map((n) => (
              <div key={n.ticker} className="adv-note-block">
                <div className="adv-eyebrow">{n.ticker} · {n.name} · {usd(n.value)} · {n.where}</div>
                <p style={{ color: 'var(--ink-2)', fontSize: 13.5, marginBottom: 6 }}>{n.held}</p>
                <blockquote>&ldquo;{n.quote}&rdquo;</blockquote>
                <div className="adv-note-src">{n.source}</div>
              </div>
            ))}

            <div className="adv-note-block">
              <div className="adv-eyebrow">What I would like from you</div>
              <p>
                For each of the four, tell me in a sentence what you were buying. If the answer is that you inherited it, or
                that you never thought about it, that is a real answer and a useful one. Anything you can put in a sentence,
                I will write down and check every quarter against what the company files. Anything you cannot, we should
                talk about on Thursday.
              </p>
            </div>

            <div className="adv-note-block" style={{ borderBottom: '1px solid var(--rule)' }}>
              <p style={{ color: 'var(--ink-2)' }}>Sarah</p>
            </div>

            {GATE}
          </div>

          <aside className="adv-rail">
            <div className="adv-eyebrow">Across the book</div>
            <div className="adv-stat">
              <div className="adv-stat-n">{ALL_POSITIONS - ALL_REASONS} <small>of {ALL_POSITIONS}</small></div>
              <div className="adv-stat-l">
                Single-name positions across all 38 households with nothing written down. This note is one household&rsquo;s
                share of that number. It is the same letter every time, with different names in it.
              </div>
            </div>

            <div className="adv-eyebrow" style={{ marginTop: 22 }}>Left out of this note</div>
            <div className="adv-stat">
              <div className="adv-guard">
                <span className="adv-struck">&ldquo;XOM has lagged the S&amp;P by 34% since you received it.&rdquo;</span>
                <br /><b>Left out.</b> Performance against a benchmark in a client letter is an advertisement the moment it
                leaves the firm without the required presentation.
                <br /><br />
                <span className="adv-struck">&ldquo;We would suggest selling KO and PG and buying the index.&rdquo;</span>
                <br /><b>Left out.</b> The note asks the client a question. Helm does not recommend, and this draft does not
                recommend on your behalf.
              </div>
            </div>

            <div className="adv-eyebrow" style={{ marginTop: 22 }}>Receipts in this note</div>
            <div className="adv-stat">
              <div className="adv-stat-l" style={{ fontFamily: 'var(--mono)', fontSize: 11.5, lineHeight: 1.7 }}>
                {LEGACY_NOTE.map((n) => (
                  <span key={n.ticker}>{n.source}<br /></span>
                ))}
                Positions · synced 06:12
              </div>
            </div>

            <div style={{ marginTop: 22 }}>
              <Link href="/testing/advisor/book?view=name" className="adv-btn quiet">The book, by name</Link>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
