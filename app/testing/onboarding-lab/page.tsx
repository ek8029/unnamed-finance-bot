import Link from 'next/link';
import s from './_lab/lab.module.css';

export default function OnboardingLabHub() {
  return <div className={s.frame}>
    <p className={s.demo}>Design lab · dev only · demo data</p>
    <h1 className={s.title} style={{ marginTop: 14 }}>Book-first onboarding, three ways</h1>
    <p className={s.lede}>Same first ask in all three: connect a brokerage or add positions by hand, at equal weight, with the multi-account loop. They differ in where the reveals about the book live. Plaid is simulated with its three real outcomes; nothing writes to the database.</p>
    <div className={s.hub}>
      <Link href="/testing/onboarding-lab/wizard"><span>A · wizard</span><div><strong>Guided sequence, then the terminal</strong><p>Ask → add another → exposure → receipt → one action → brief promise → portfolio. Cleanest story. Every screen is also a place to leave.</p></div></Link>
      <Link href="/testing/onboarding-lab/terminal"><span>B · terminal</span><div><strong>The product is the onboarding</strong><p>Land on Portfolio with the ask inline. Sections fill as the book grows; the sidebar unlocks in place. No wizard to maintain, harder to make legible.</p></div></Link>
      <Link href="/testing/onboarding-lab/hybrid"><span>C · hybrid</span><div><strong>One reveal screen, then the terminal</strong><p>Ask and loop, one screen with exposure and the receipt side by side, then Portfolio with actions and the brief unlocking in place. The recommendation.</p></div></Link>
    </div>
    <div className={s.note}>What the numbers say, from the 9/8 analysis: a book returns 50% at two days versus 15% without; demo returns 9% and 0% at seven days; day-one breadth does not hurt return; the thesis step before the book retains 24% and 8%; the manual path had one start in sixty days. So the ask comes first, manual is co-equal, demo is gone, and thesis adoption waits for the brief.</div>
  </div>;
}
