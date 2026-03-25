# Landing Page Content Expansion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 new sections to `/landing-test` — dashboard preview with live data, terminal-style "how it works", security audit log, and social proof session excerpts.

**Architecture:** All new sections are added to `app/landing-test/page.tsx`. A reusable `TerminalBlock` component is extracted into `app/landing-test/effects.tsx` to avoid duplicating the terminal styling across 3 sections. The existing `/api/metrics/platform` endpoint is reused as-is — no API changes needed. All animations use existing `FadeIn` for scroll-triggered reveal.

**Tech Stack:** Next.js (App Router, client components), Framer Motion, Tailwind CSS, existing custom CSS properties from `globals.css`.

**Spec:** `docs/superpowers/specs/2026-03-24-landing-page-content-expansion-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `app/landing-test/effects.tsx` | Modify | Add `TerminalBlock` component |
| `app/landing-test/page.tsx` | Modify | Add 4 new sections, integrate `TerminalBlock` |
| `.gitignore` | Modify | Add `.superpowers/` entry |

---

### Task 1: Add `TerminalBlock` component to effects.tsx

**Files:**
- Modify: `app/landing-test/effects.tsx` (append to end of file)

The terminal block pattern is used 3 times (How It Works, Security, Social Proof). Extract it once.

- [ ] **Step 1: Read the current end of effects.tsx**

Read `app/landing-test/effects.tsx` to confirm the last export is `FadeIn` (around line 426).

- [ ] **Step 2: Add `TerminalBlock` component**

Append to `app/landing-test/effects.tsx`:

```tsx
/* ═══════════════════════════════════════════════════════════════════════════
   Terminal Block
   Reusable dark terminal container with optional command header
   ═══════════════════════════════════════════════════════════════════════════ */

export function TerminalBlock({
  command,
  children,
  className = '',
}: {
  command?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-[rgba(10,10,10,0.8)] border border-white/[0.06] rounded-lg px-5 py-4 font-mono text-sm ${className}`}
    >
      {command && (
        <div className="text-[var(--color-text-muted)] mb-3 text-xs">
          {command}
        </div>
      )}
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Verify the dev server compiles without errors**

Run: `npm run dev` (check terminal for compilation errors)
Expected: No errors. The component isn't used yet but should compile.

- [ ] **Step 4: Commit**

```bash
git add app/landing-test/effects.tsx
git commit -m "feat(landing-test): add reusable TerminalBlock component"
```

---

### Task 2: Add Dashboard Preview section

**Files:**
- Modify: `app/landing-test/page.tsx` (insert after Metrics Strip section, before "What Helm Watches")

This section renders a browser-frame mockup with live data from the existing `totalNetWorth` state.

- [ ] **Step 1: Read the current page.tsx**

Read `app/landing-test/page.tsx`. Locate the closing `</section>` of the Metrics Strip (around line 331) and the opening of "What Helm Watches" (around line 336). The new section inserts between them.

- [ ] **Step 2: Insert Dashboard Preview section**

After the Metrics Strip closing `</section>` and its gold divider comment (if present), insert:

```tsx
      {/* ════════════════════════════════════════════════════════════════════
          DASHBOARD PREVIEW — hybrid mockup with live data
          ════════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 container mx-auto px-6 py-28">
        <div className="max-w-4xl mx-auto">
          <FadeIn>
            <h2 className="text-center text-2xl md:text-3xl font-bold uppercase tracking-wider mb-12 text-[var(--color-text-secondary)]">
              Your Command Center.
            </h2>
          </FadeIn>

          <FadeIn delay={200}>
            <div className="rounded-xl overflow-hidden border border-[var(--color-gold)]/20 shadow-[0_0_80px_rgba(230,185,77,0.06)]">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03]">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/40" />
                <span className="ml-2 text-[10px] font-mono text-[var(--color-text-muted)]">
                  helm terminal — dashboard
                </span>
              </div>

              {/* Dashboard content */}
              <div className="p-6 bg-[rgba(10,10,10,0.9)]">
                {/* Stat cards row */}
                <div className="grid grid-cols-3 gap-4 mb-5">
                  <div className="bg-white/[0.03] rounded-lg p-4">
                    <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] font-mono mb-1">
                      Net Worth
                    </div>
                    <div className="font-mono font-bold text-xl md:text-2xl text-[var(--color-gold)]">
                      {totalNetWorth > 0 ? (
                        <CountUp
                          end={totalNetWorth}
                          formatter={(v) => `$${Math.round(v).toLocaleString()}`}
                          duration={2000}
                        />
                      ) : (
                        '$—'
                      )}
                    </div>
                    <div className="text-xs text-[var(--color-positive)] font-mono mt-0.5">
                      +2.4% this month
                    </div>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-4">
                    <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] font-mono mb-1">
                      Actions
                    </div>
                    <div className="font-mono font-bold text-xl md:text-2xl">
                      <CountUp end={3} duration={1500} />
                    </div>
                    <div className="text-xs text-[var(--color-gold)] font-mono mt-0.5">
                      2 high priority
                    </div>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-4">
                    <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] font-mono mb-1">
                      Tax Savings
                    </div>
                    <div className="font-mono font-bold text-xl md:text-2xl text-[var(--color-positive)]">
                      <CountUp
                        end={2400}
                        formatter={(v) => `$${Math.round(v).toLocaleString()}`}
                        duration={2000}
                      />
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] font-mono mt-0.5">
                      YTD estimated
                    </div>
                  </div>
                </div>

                {/* Chart placeholder */}
                <div className="bg-white/[0.02] rounded-lg h-32 flex items-center justify-center">
                  <span className="text-xs font-mono text-[var(--color-text-muted)]">
                    ▁▂▃▅▆▇█▇▆▅▆▇█▇▅▃▅▆▇█
                  </span>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>
```

- [ ] **Step 3: Verify the section renders**

Run dev server, navigate to `/landing-test`, scroll past the metrics strip. The dashboard mockup should appear with a browser chrome frame, 3 stat cards (Net Worth showing live data), and a chart placeholder area.

- [ ] **Step 4: Commit**

```bash
git add app/landing-test/page.tsx
git commit -m "feat(landing-test): add dashboard preview section with live data"
```

---

### Task 3: Add "How It Works" terminal section

**Files:**
- Modify: `app/landing-test/page.tsx` (insert after "What Helm Watches" section, before "Before Helm")
- Uses: `TerminalBlock` from `effects.tsx` (add to import)

- [ ] **Step 1: Update the import statement**

In `app/landing-test/page.tsx`, find the import from `'./effects'` and add `TerminalBlock`:

```tsx
import {
  InteractiveGrid,
  StaggerText,
  CountUp,
  TypingText,
  FadeIn,
  TerminalBlock,
} from './effects';
```

- [ ] **Step 2: Add static data for terminal lines**

Add to the static data section near the top of the file (after the `comparisons` array):

```tsx
const howItWorks = [
  { cmd: 'helm connect', desc: '— link bank, brokerage, crypto via Plaid (90s)' },
  { cmd: 'helm analyze', desc: '— 7 engines scan positions, tax, risk, cash flow' },
  { cmd: 'helm act',     desc: '— prioritized actions land in your inbox daily' },
];
```

- [ ] **Step 3: Insert the section**

After the "What Helm Watches" closing `</section>` (the one with `dataRows.map`), insert:

```tsx
      {/* ════════════════════════════════════════════════════════════════════
          HOW IT WORKS — terminal command sequence
          ════════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 container mx-auto px-6 pb-28">
        <div className="max-w-3xl mx-auto">
          <FadeIn>
            <h2 className="text-center text-2xl md:text-3xl font-bold uppercase tracking-wider mb-12 text-[var(--color-text-secondary)]">
              Get Started.
            </h2>
          </FadeIn>

          <FadeIn delay={150}>
            <TerminalBlock>
              <div className="space-y-3">
                {howItWorks.map((line, i) => (
                  <FadeIn key={line.cmd} delay={300 + i * 200} direction="none">
                    <div>
                      <span className="text-[var(--color-gold)]">→</span>{' '}
                      <span className="text-[var(--color-positive)] font-semibold">{line.cmd}</span>{' '}
                      <span className="text-[var(--color-text-muted)]">{line.desc}</span>
                    </div>
                  </FadeIn>
                ))}
              </div>
            </TerminalBlock>
          </FadeIn>
        </div>
      </section>
```

- [ ] **Step 4: Verify the section renders**

Scroll to the section after "What Helm Watches." Three terminal lines should stagger in with gold arrows, green commands, and muted descriptions.

- [ ] **Step 5: Commit**

```bash
git add app/landing-test/page.tsx
git commit -m "feat(landing-test): add terminal-style how-it-works section"
```

---

### Task 4: Add Trust & Security terminal section

**Files:**
- Modify: `app/landing-test/page.tsx` (insert after "Before Helm" section, replacing the existing gold divider before the final CTA)

- [ ] **Step 1: Add static data for security checks**

Add to the static data section:

```tsx
const securityChecks = [
  { label: 'read-only access',    desc: '— cannot move money or execute trades' },
  { label: 'AES-256 encryption',  desc: '— bank-level, in transit + at rest' },
  { label: 'plaid infrastructure', desc: '— same provider as Venmo, Robinhood, Coinbase' },
  { label: 'zero data selling',   desc: '— your data is never sold or shared. ever.' },
  { label: 'full data deletion',  desc: '— delete everything, anytime, no questions' },
];
```

- [ ] **Step 2: Insert the section**

After the "Before Helm" closing `</section>`, **remove the existing gold divider** (the `w-24 h-px` div with `mb-28`), then insert:

```tsx
      {/* ════════════════════════════════════════════════════════════════════
          TRUST & SECURITY — terminal audit log
          ════════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 container mx-auto px-6 pb-28">
        <div className="max-w-3xl mx-auto">
          <FadeIn>
            <h2 className="text-center text-2xl md:text-3xl font-bold uppercase tracking-wider mb-12 text-[var(--color-text-secondary)]">
              Security.
            </h2>
          </FadeIn>

          <FadeIn delay={150}>
            <TerminalBlock command="$ helm security --verify">
              <div className="space-y-2.5">
                {securityChecks.map((check, i) => (
                  <FadeIn key={check.label} delay={300 + i * 150} direction="none">
                    <div>
                      <span className="text-[var(--color-positive)]">✓</span>{' '}
                      <span className="text-[var(--color-gold)] font-semibold">{check.label}</span>{' '}
                      <span className="text-[var(--color-text-muted)]">{check.desc}</span>
                    </div>
                  </FadeIn>
                ))}
              </div>
              <FadeIn delay={1100} direction="none">
                <div className="mt-4 text-xs text-[var(--color-text-muted)]">
                  All checks passed. System secure. <span className="text-[var(--color-positive)]">●</span>
                </div>
              </FadeIn>
            </TerminalBlock>
          </FadeIn>
        </div>
      </section>
```

- [ ] **Step 3: Verify the section renders**

Scroll to the section after "Before Helm." The terminal block should show `$ helm security --verify` at the top, then 5 green checkmarks staggering in, then the "All checks passed" line.

- [ ] **Step 4: Commit**

```bash
git add app/landing-test/page.tsx
git commit -m "feat(landing-test): add trust & security terminal section"
```

---

### Task 5: Add Social Proof terminal section

**Files:**
- Modify: `app/landing-test/page.tsx` (insert after Trust & Security, before the gold divider / final CTA)

- [ ] **Step 1: Add static data for session excerpts**

Add to the static data section:

```tsx
const sessionExcerpts = [
  {
    lines: [
      { verb: 'flagged', highlight: '$2,847 tax-loss harvest', detail: 'in VXUS position', color: 'positive' },
      { verb: 'detected', highlight: '38% concentration', detail: 'in single sector (tech)', color: 'gold' },
      { verb: 'surfaced', highlight: '$340/mo subscription creep', detail: '— 3 flagged', color: 'positive' },
    ],
  },
  {
    lines: [
      { verb: 'identified', highlight: '$1,200 dividend income', detail: 'not accounted for in planning', color: 'positive' },
      { verb: 'alert:', highlight: 'AAPL earnings in 3 days', detail: '— 34% of portfolio exposed', color: 'gold' },
    ],
  },
];
```

- [ ] **Step 2: Insert the section**

After the Trust & Security closing `</section>`, insert:

```tsx
      {/* Gold divider between terminal sections */}
      <div className="relative z-10 flex justify-center mb-28">
        <div className="w-24 h-px bg-gradient-to-r from-transparent via-[var(--color-gold)] to-transparent opacity-20" />
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          SOCIAL PROOF — terminal session excerpts
          ════════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 container mx-auto px-6 pb-28">
        <div className="max-w-3xl mx-auto">
          <FadeIn>
            <h2 className="text-center text-2xl md:text-3xl font-bold uppercase tracking-wider mb-12 text-[var(--color-text-secondary)]">
              What Helm Found.
            </h2>
          </FadeIn>

          <div className="space-y-4">
            {sessionExcerpts.map((session, si) => (
              <FadeIn key={si} delay={si * 200}>
                <TerminalBlock command="// session — early access user">
                  <div className="space-y-2">
                    {session.lines.map((line, li) => (
                      <div key={li}>
                        <span className="text-[var(--color-gold)]">→</span>{' '}
                        <span className="text-[var(--color-text-muted)]">{line.verb}</span>{' '}
                        <span
                          className={`font-semibold ${
                            line.color === 'positive'
                              ? 'text-[var(--color-positive)]'
                              : 'text-[var(--color-gold)]'
                          }`}
                        >
                          {line.highlight}
                        </span>{' '}
                        <span className="text-[var(--color-text-muted)] opacity-60">{line.detail}</span>
                      </div>
                    ))}
                  </div>
                </TerminalBlock>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>
```

- [ ] **Step 3: Verify the section renders**

Two terminal blocks should appear after Security, separated by a gold divider. Each shows anonymized session findings with color-coded highlights.

- [ ] **Step 4: Commit**

```bash
git add app/landing-test/page.tsx
git commit -m "feat(landing-test): add social proof session excerpts section"
```

---

### Task 6: Add `.superpowers/` to .gitignore

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add entry**

Append to `.gitignore`:

```
# Superpowers brainstorm sessions
.superpowers/
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: add .superpowers/ to gitignore"
```

---

### Task 7: Full-page scroll test and polish

**Files:**
- Possibly modify: `app/landing-test/page.tsx` (spacing/timing adjustments)

- [ ] **Step 1: Full scroll-through verification**

Navigate to `/landing-test` and scroll through the entire page. Verify:
- [ ] Dashboard Preview appears after Metrics Strip with live net worth data
- [ ] "What Helm Watches" data rows still render correctly
- [ ] "How It Works" terminal lines stagger in on scroll
- [ ] "Before Helm" comparisons still render correctly
- [ ] Security checkmarks stagger in with "All checks passed" appearing last
- [ ] Gold divider separates Security from Social Proof
- [ ] Session excerpts render with correct color coding
- [ ] Final CTA and footer still render correctly
- [ ] No horizontal overflow on mobile viewport (check at 375px width)

- [ ] **Step 2: Adjust spacing or animation timing if needed**

If any sections feel too cramped or the stagger timing feels off, adjust `py-*` padding or `delay` values.

- [ ] **Step 3: Final commit**

```bash
git add app/landing-test/page.tsx app/landing-test/effects.tsx
git commit -m "feat(landing-test): polish spacing and animation timing"
```
