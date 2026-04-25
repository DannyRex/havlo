# Dealesty UI/UX Redesign Plan
> Reference: spoken.io + dupe.com hybrid on Dealesty's dark navy theme

---

## What we're keeping
- Dark navy theme (`#050B18` / `#0A1428`) — Dealesty's identity
- Brand green (`#00D68F`) for savings/positive signals
- All existing data architecture — purely visual changes

## What we're borrowing

| Element | From | Applied to |
|---|---|---|
| Tall "chat composer" search box | dupe.com | Homepage hero + compare page |
| Cyan ambient glow behind search | dupe.com | Homepage hero + compare page |
| Category pill chips under search | dupe.com | Homepage + deals page |
| Anchor → alternatives vertical layout | dupe.com | Compare page |
| Verified retailer badge | dupe.com | Compare page store rows |
| `₦X → ₦Y · Save N%` price-drop card | spoken.io | Homepage trending + DealCard |
| Image-dominant vertical card | spoken.io | Deals grid + dupes grid |
| 5-col desktop / 1-col mobile grid | spoken.io | Deals page |
| Price-drop timestamp ("2h ago") | spoken.io | DealCard |
| Horizontal category scroll bar | spoken.io | Deals page top |
| Bottom tab nav on mobile | spoken.io | Global layout |

---

## Phase 1 — Design tokens + global layout
**Model**: Sonnet · **Effort**: Low
**Files**: `src/app/globals.css`, `tailwind.config.ts`, `src/components/layout/Navbar.tsx`

### Tasks
1. Add `font-display` (Lora or Playfair Display) for editorial headings
2. New CSS utilities:
   - `.composer` — tall `rounded-3xl` search box base styles
   - `.ambient-glow` — programmatic cyan blurred circle behind search
   - `.price-arrow` — `₦X → ₦Y` format helper
3. Rewrite `Navbar.tsx`:
   - **Mobile**: Add bottom tab bar (`fixed bottom-0`) with 4 tabs: Home · Deals · Find for Less · Search
   - **Desktop**: Keep current top nav unchanged
   - Active tab indicator: filled brand color pill

---

## Phase 2 — Homepage
**Model**: Sonnet · **Effort**: Medium
**Files**: `src/components/landing/Hero.tsx`, `Stats.tsx`, `Features.tsx`, new `TrendingDeals.tsx`, new `CategoryGrid.tsx`

### Hero (complete rewrite)
- Drop split layout → **full viewport, centered single column** `max-w-2xl`
- Smaller punchier headline: 2 lines, `text-4xl sm:text-5xl font-display`
- 50%-opacity sub-tagline (dupe.com style — barely there, not over-explained)
- **Trust strip**: ★★★★★ · "18,000+ comparisons today" (small, muted)
- **Tall composer search box** (dupe.com):
  - `min-h-[96px]` · `rounded-3xl` · `<textarea>` (not `<input>`)
  - Placeholder: "Paste a Jumia/Amazon link, or search anything…"
  - Bottom-left: 📷 image icon (greyed out, "coming soon" tooltip)
  - Bottom-right: submit arrow (`rounded-full`, grayed when empty)
  - Cyan ambient glow: `absolute blur-[80px]` circle `rgba(0,200,255,0.15)` behind the box
- **Category chips** row below (horizontally scrollable):
  - Phone · Laptop · TV · Sneakers · Earbuds · Home · Fashion · Gaming
- Remove live ticker from hero (move below fold)

### Trending Deals section (new — replaces live ticker)
- Heading: "Trending right now" with 🔴 live dot
- Horizontal scroll on mobile, 4-col grid on desktop
- **spoken.io price-drop card** format:
  ```
  [Image]
  Samsung Galaxy A06
  jumia.com.ng          2h ago
  ₦89,000 → ₦65,000  · Save 27%
  ```
- Card spec: `rounded-2xl`, image top (`aspect-[4/3]`), store domain + timestamp, title, price-drop row with green savings badge

### Category Grid (new — replaces Features section)
- 2-col mobile / 4-col desktop grid of large image tiles
- Each tile: background image (or emoji/gradient fallback), dark gradient overlay, category name in white
- Clicks → `/deals?category=phones` etc.

### Collapse Stats + HowItWorks
- Merge into one slim 3-stat strip: "12 stores · Real-time prices · Free"
- Remove HowItWorks section (dupe.com doesn't explain itself — it shows)

---

## Phase 3 — Deals page
**Model**: Sonnet · **Effort**: Medium
**Files**: `src/components/deals/DealCard.tsx`, `DealFeed.tsx`, `CategoryNav.tsx`

### Grid layout
| Breakpoint | Columns |
|---|---|
| Mobile (`<sm`) | **1** (user requirement) |
| Tablet (`sm`) | 2 |
| Desktop (`lg`) | 4 |
| Wide (`xl`) | 5 |

### DealCard rewrite — vertical, image-dominant (spoken.io style)
```
┌─────────────────────┐
│                     │  ← aspect-[3/4], rounded-xl, bg-white, object-contain
│    [product image]  │  ← discount badge top-right (rotated pill, red-orange)
│                 −27%│
└─────────────────────┘
  Jumia · 2h ago          ← text-xs muted
  Samsung Galaxy A06      ← text-sm font-semibold, line-clamp-2
  ₦89,000 → ₦65,000       ← price-drop arrow format
  💚 Save ₦24,000          ← green, small
```
- **Remove**: horizontal layout, delivery days, star rating (shown in compare detail)
- **Keep**: INTL badge, store name, discount %
- **Add**: time-since scraped ("2h ago"), price-drop arrow format

### CategoryNav update
- spoken.io pill-chip style: `rounded-full px-4 py-2 text-sm border`
- Active = filled brand color
- Horizontally scrollable, `scrollbar-none`, no wrap
- **Expanded categories**: All · Phones · Laptops · TVs · Earbuds · Speakers · Smartwatches · Gaming · Fashion · Sneakers · Home · Appliances

---

## Phase 4 — Find for Less (compare) page
**Model**: Sonnet · **Effort**: Medium-High
**Files**: new `src/components/compare/SearchComposer.tsx`, `src/app/compare/page.tsx`, `PriceResults.tsx`, `DupeCard.tsx`

### SearchComposer (replaces SearchBar)
- dupe.com tall composer: `rounded-3xl min-h-[96px]` textarea
- Same cyan ambient glow as homepage
- Camera icon bottom-left (future image search hook — disabled for now)
- URL detection: border changes to brand color, placeholder becomes "Smart switching from [store]…"
- Suggestion chips below (not inside) the box — horizontal pill row

### Similar mode — dupe.com narrow column layout
- **`max-w-xl mx-auto`** narrow centered column (phone-app feel on desktop)
- **Anchor section**:
  - Product image full-width within column, `aspect-square`, `rounded-2xl`, white bg
  - Retailer domain + ✓ verified shield badge
  - Product name: `text-xl font-semibold font-display`
  - Price as button: `₦240,000` (links to store)
  - Store pills (up to 3, with price each)
  - `"See X alternatives ↓"` scroll CTA
- **Separator**: `───── X alternatives from ₦Y ─────`
- **Alternatives grid**: `grid-cols-2` (readability over density)
  - Image top + savings badge (`Save 32%`) + title + price + store

### Single mode — spoken.io store-list style
- Retailer rows: logo + name + price + "Best" badge if cheapest
- Add ✓ verified badge for trusted stores (Jumia, Konga, Slot, Amazon)
- spoken.io arrow format: strikethrough old, bold new

### Empty state — actually useful
- "We couldn't find [query]"
- 4 suggestion chips for related searches
- "Browse [category] deals →" shortcut button

---

## Build order summary

| Phase | Scope | Model | Files |
|---|---|---|---|
| 1 · Tokens + mobile nav | globals.css, tailwind.config, Navbar.tsx | **Sonnet** | 3 |
| 2 · Homepage | Hero.tsx, Stats.tsx, + 2 new components | **Sonnet** | 5–6 |
| 3 · Deals page | DealCard.tsx, DealFeed.tsx, CategoryNav.tsx | **Sonnet** | 3 |
| 4 · Compare page | SearchComposer.tsx, compare/page.tsx, PriceResults.tsx, DupeCard.tsx | **Sonnet** | 4 |

All phases use **Sonnet** — UI rewrites don't need Opus reasoning depth.
Each phase is independent and shippable on its own.

---

## Reference sites
- https://spoken.io — price-drop cards, image-dominant grid, bottom tab nav
- https://dupe.com — tall composer search, cyan glow, narrow anchor+alternatives layout
