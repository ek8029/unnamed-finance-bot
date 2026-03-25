# Obsidian & Brass — Navy Depth Layers Redesign

## Design Direction
**Obsidian & Brass with Navy Depth Layers.** Page base is near-black obsidian. Cards are deep navy with navy-tinted box-shadows — floating above a dark ocean. Gold appears only as brass instrument fittings: thin top-edge rules on key cards and label text. Never as background fills or gradients.

## Scope
Everything: dashboard, landing page, pricing, analyze, blog.

---

## 1. Color System Migration

### Backgrounds (obsidian base → navy cards → navy shadows for depth)
| Token | Current | New | Role |
|-------|---------|-----|------|
| `--color-bg-base` | #070C17 | #09090B | Page background — true obsidian, no blue tint |
| `--color-bg-inset` | #060A13 | #07070A | Recessed areas within cards |
| `--color-bg-surface` | #0C1525 | #0F1219 | Cards, panels — deep navy, the "depth" layer |
| `--color-bg-elevated` | #111B2E | #151920 | Elevated cards, dropdowns |
| `--color-bg-overlay` | #162036 | #1A1E27 | Hover states, overlays |

### Borders (shift from white-alpha to match navy cards)
| Token | Current | New |
|-------|---------|-----|
| `--color-border-subtle` | rgba(255,255,255,0.04) | rgba(255,255,255,0.04) | (unchanged)
| `--color-border-base` | rgba(255,255,255,0.08) | rgba(255,255,255,0.05) | (slightly softer)
| `--color-border-strong` | rgba(255,255,255,0.14) | rgba(255,255,255,0.10) |

### Text (shift from blue-platinum to neutral white)
| Token | Current | New |
|-------|---------|-----|
| `--color-text-primary` | #E8ECF1 | #FAFAFA | Brighter, true white |
| `--color-text-secondary` | #8A94A6 | #6B7080 | Zinc-gray, no blue tint |
| `--color-text-muted` | #505A6B | #52525B | Neutral zinc |

### Gold (unchanged values, but new usage rules)
All gold CSS vars stay the same. Usage changes:
- **Brass top-rules:** 2px linear-gradient on top edge of Tier-1 and action cards only
- **Label text:** Gold for section headers like "Net Worth", "Action Items"
- **Selected/active nav:** Gold text + gold-border
- **Never:** Gold background fills, gold gradients on card surfaces

### Semantic data colors
| Token | Current | New |
|-------|---------|-----|
| `--color-positive` | #38D39F | #4ADE80 | Brighter green, pops against obsidian |
| `--color-negative` | #F87171 | #F87171 | (unchanged) |

### New: Shadow tokens (navy depth)
Add to globals.css:
```css
--shadow-card: 0 2px 12px rgba(15, 18, 25, 0.4);
--shadow-card-hover: 0 4px 20px rgba(15, 18, 25, 0.5);
--shadow-elevated: 0 8px 30px rgba(15, 18, 25, 0.6);
```

### Tailwind config color updates
Update `helm.*` tokens to match new values. Add:
```js
shadow: {
  card: 'var(--shadow-card)',
  'card-hover': 'var(--shadow-card-hover)',
  elevated: 'var(--shadow-elevated)',
}
```

---

## 2. Border Radius

### Change all radius tokens:
| Token | Current | New |
|-------|---------|-----|
| `--radius-sm` | 1px | 4px |
| `--radius-md` | 2px | 6px |
| `--radius-lg` | 4px | 8px |
| `--radius-app` | 4px | 8px |

### Tailwind overrides:
| Key | Current | New |
|-----|---------|-----|
| sm | 1px | 4px |
| DEFAULT/md | 2px | 6px |
| lg | 2px | 8px |
| xl | 4px | 8px |
| 2xl | 4px | 10px |
| 3xl | 4px | 12px |

---

## 3. Typography Scale — Tiered Hierarchy

### New/updated type classes:

| Class | Current Size | New Size | Weight | Tracking | Use |
|-------|-------------|----------|--------|----------|-----|
| `.type-statement` | (new) | 40px | 700 | -0.03em | Net Worth — Tier 1 |
| `.type-data` | 24px | 28px | 700 | -0.02em | Portfolio, Cash — Tier 2 |
| `.type-data-sm` | (new) | 20px | 700 | -0.015em | Liabilities, scores — Tier 3 |
| `.type-h2` | 20px | 20px | 600 | -0.015em | (unchanged) |
| `.type-h3` | 14px | 14px | 600 | -0.01em | (unchanged) |
| `.type-body` | 15px | 14px | 400 | 0 | Tighter body text |
| `.type-data-label` | 9px | 10px | 500 | 0.08em | Slightly larger labels |

All data classes retain `font-feature-settings: 'tnum' 1, 'zero' 1`.

---

## 4. DataPanel Component Updates

### Shadow system:
- Remove `elevation` variant entirely (was 'none' | 'hover')
- ALL panels get `box-shadow: var(--shadow-card)` by default
- Hover: `box-shadow: var(--shadow-card-hover)`

### Brass top-rule variant:
Add `accent` prop: `'none' (default) | 'brass'`
- `brass`: adds `::before` pseudo-element — 2px height, gradient from #B8914A to transparent, spans full width, top-edge

### Background:
- All panels: `bg-[var(--color-bg-surface)]` (now #0F1219, navy depth)
- Hover border: `border-[var(--color-border-strong)]` (now softer at 0.10)

### Padding adjustments:
- `--card-padding`: 20px → 20px (unchanged for comfortable)
- Content still uses `pt-0` for density

---

## 5. Dashboard Page Changes

### financial-summary-cards.tsx
- Grid gap: `gap-3` → `gap-2` (tighter for tier-3 compact cards)
- Card internal number: use `.type-data-sm` (20px) instead of current sizing
- Remove `elevation="hover"` prop

### net-worth-card.tsx
- Net Worth number: use `.type-statement` (40px)
- Add `accent="brass"` to DataPanel
- Chart line color: keep gold (#B8914A)
- Fix `var(--font-inter)` → `var(--font-mono)` (existing bug)

### financial-health-score.tsx
- Score number: `.type-data` (28px) — Tier 2
- Remove `elevation="hover"`

### intelligence-feed.tsx
- Add `accent="brass"` to the feed panel
- Action item rows: subtle tinted backgrounds per severity (as in mockup)
- Severity badges: small pill with color-matched background

### cash-flow-trend.tsx, savings-rate-timeline.tsx, assets-liabilities-composition.tsx
- Remove `elevation="hover"` from all
- Fix any `var(--font-inter)` references → `var(--font-mono)`

### dashboard/page.tsx layout
- Top summary row: Net Worth card spans wider (col-span-3 in 5-col grid)
- Tier-2 cards (Portfolio, Cash) stack in remaining cols
- Tier-3 row: 4-column grid with compact cards
- Section gaps: maintain current `gap-density` system

---

## 6. Landing Page Changes (app/page.tsx)

### Color migration
- All `bg-[var(--color-bg-*)]` references now resolve to obsidian/navy values
- Grid overlay: reduce opacity from 0.02 to 0.015 (subtler on obsidian)

### Hero section
- Main heading: `.type-display` (unchanged 56px)
- Product preview card: apply navy depth shadow system
- "Live" dot: keep pulse animation

### Value propositions, showcase, comparison sections
- Cards get navy depth shadows
- 8px radius throughout
- Brass top-rules on featured/primary cards only

### Security section, social proof
- Inherits new palette naturally via CSS vars

---

## 7. Pricing Page

- Pro card: `accent="brass"` for brass top-rule
- Free card: standard panel (no accent)
- 8px radius, navy depth shadows on all cards
- Feature check marks: use new `--color-positive` (#4ADE80)

---

## 8. Analyze Pages

- Search input: 8px radius, navy surface background
- Analysis result cards: navy depth shadows
- Ticker page nav: inherit new palette
- Email gate modal: navy surface with brass accent

---

## 9. Blog Pages

- Article cards: navy depth shadows, 8px radius
- Blog nav: inherit dashboard nav palette updates

---

## 10. Motion — Refined

### Easing update:
- `--ease-out-expo`: `cubic-bezier(0.16, 1, 0.3, 1)` → `cubic-bezier(0.22, 1, 0.36, 1)` (slightly less bouncy)

### Duration tightening:
- `--duration-chart`: 800ms → 600ms (snappier chart animations)

### Remove:
- `count-up` animation (gimmicky on financial data)
- `float` animation (unnecessary)

### Keep:
- `stagger-fade-in` (refined entry)
- `page-transition` (smooth page changes)
- `draw-line` (chart line drawing)

---

## 11. Light Theme

Update light theme overrides to match new token structure:
- Base: #F5F5F5 (slightly warmer than current #F0F2F5)
- Surface: #FFFFFF
- Text primary: #09090B (matches dark base for consistency)
- Shadows: use rgba(0,0,0,0.06) for card, rgba(0,0,0,0.1) for elevated

---

## Implementation Order

1. **globals.css** — Update all CSS custom properties (colors, shadows, radius, motion, new type classes)
2. **tailwind.config.ts** — Update color tokens, radius, shadow, animation
3. **components/ui/data-panel.tsx** — Add shadow default, brass accent variant, remove elevation
4. **Dashboard components** — Apply tiered typography, brass accents, fix font-inter bug
5. **app/dashboard/page.tsx** — Layout adjustments for tier hierarchy
6. **app/page.tsx** — Landing page palette migration
7. **app/pricing/page.tsx** — Pro card brass accent
8. **app/analyze/** — Search + results styling
9. **app/blog/** — Card styling
10. **app/dashboard/layout.tsx** — Nav palette updates

## What NOT to Change
- Component logic, data fetching, API routes, business logic
- HelmMark SVG brand mark
- Manrope + DM Mono font selections
- Density system (compact/comfortable/spacious)
- Plaid, auth, database — zero backend changes
