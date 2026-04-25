# Full Redesign Plan — Pryce (fka Dealesty)
> Reference: spoken.io (layout + cards + nav) × dupe.com (search + dark mode + structure)
> Senior frontend engineer standard throughout

---

## 1. Brand

### Name: **Pryce**
- 1 syllable, globally pronounceable, implies value/price without being generic
- Works as a verb: "Pryce it before you buy it"
- Domain options: getpryce.com · pryce.so · pryce.co
- Tagline: **"Find similar. Pay less."**
- Sub-tagline: **"Compare prices across stores, instantly."**
- Optional: keep Dealesty internally, only change UI text and meta — zero backend work

### Logo direction
- Wordmark-only: "Pryce" in Inter 700, tight letter-spacing
- Accent mark: a small downward arrow (↓) or price-tag icon before or after
- Monochrome — works on any background in both modes

---

## 2. Design System

### Typography
**One font, mastered** — Inter (Google Fonts, variable weight 100–900).
No second font. This is how Linear, Vercel, and Stripe achieve premium without fuss.

| Role | Size | Weight | Tracking |
|------|------|--------|----------|
| Display hero | clamp(2.5rem, 6vw, 3.75rem) | 700 | -0.03em |
| H1 page | 2rem–2.5rem | 700 | -0.025em |
| H2 section | 1.5rem–1.75rem | 600 | -0.02em |
| H3 card | 1rem–1.125rem | 600 | -0.01em |
| Body | 1rem (16px) | 400 | 0 |
| Caption | 0.75rem–0.875rem | 400–500 | 0 |
| Label/badge | 0.6875rem (11px) | 600 | 0.02em |

### Color System — Semantic Tokens (light / dark)

**NOT a blue/navy/purple brand. Clean editorial: near-black on white.**
The accent is the green savings indicator — it becomes the brand signature.

```
Light mode:
  --bg:           #FFFFFF        canvas
  --bg-subtle:    #FAFAFA        card backgrounds, sections
  --bg-muted:     #F4F4F5        skeleton, chip backgrounds
  --border:       #E4E4E7        default borders
  --border-strong:#A1A1AA        hover/active borders
  --text:         #09090B        primary text
  --text-secondary:#52525B       secondary text
  --text-muted:   #A1A1AA        captions, placeholders
  --accent:       #18181B        interactive (links, icons on hover)
  --savings:      #16A34A        savings badges, CTAs
  --savings-bg:   #F0FDF4        savings badge background
  --savings-text: #166534        savings badge text
  --price-old:    #A1A1AA        strikethrough price
  --badge-hot:    #DC2626        hot/urgent badge
  --badge-intl:   #0EA5E9        international badge

Dark mode:
  --bg:           #09090B        canvas
  --bg-subtle:    #111113        card backgrounds
  --bg-muted:     #1C1C1E        chip backgrounds
  --border:       #27272A        default borders
  --border-strong:#3F3F46        hover/active
  --text:         #FAFAFA        primary text
  --text-secondary:#A1A1AA       secondary
  --text-muted:   #71717A        captions
  --accent:       #FAFAFA        interactive
  --savings:      #22C55E        savings (brighter in dark)
  --savings-bg:   #052E16        dark savings bg
  --savings-text: #86EFAC        dark savings text
  --price-old:    #52525B        strikethrough
```

### Spacing (8pt grid)
- `4px` — micro gaps (icon-text, badge internals)
- `8px` — tight (card inner spacing)
- `12px` — compact elements
- `16px` — standard padding
- `24px` — card padding
- `32px` — section inner padding
- `48px` — section vertical padding (mobile)
- `64px` — section vertical padding (desktop)
- `96px` — major section gaps (desktop)

### Border Radius
- `4px` — badges, tags
- `8px` — inputs, small cards
- `12px` — product cards (spoken.io's `--radius + 4px`)
- `16px` — section cards
- `24px` — composer search box, large CTAs
- `9999px` — pills, category chips

### Shadows
```
--shadow-xs:    0 1px 2px rgba(0,0,0,0.05)
--shadow-sm:    0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)
--shadow-md:    0 4px 6px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.04)
--shadow-lg:    0 10px 15px rgba(0,0,0,0.05), 0 4px 6px rgba(0,0,0,0.04)
--shadow-card:  0 1px 3px rgba(0,0,0,0.08)   (product card resting)
--shadow-card-hover: 0 8px 30px rgba(0,0,0,0.10)
--shadow-composer: 0px 4px 4px rgba(0,0,0,0.04), 0px 4px 80px 8px rgba(0,0,0,0.04)
```
Dark mode: all shadows use `rgba(0,0,0,0.4)` or `rgba(255,255,255,0.04)` inset.

---

## 3. Expanded Category System

Global categories (not Nigeria-specific):

| Slug | Label | Icon |
|------|-------|------|
| all | All | LayoutGrid |
| phones | Phones | Smartphone |
| laptops | Laptops | Laptop |
| tablets | Tablets | Tablet |
| tvs | TVs | Tv |
| audio | Audio | Headphones |
| gaming | Gaming | Gamepad2 |
| cameras | Cameras | Camera |
| smart-home | Smart Home | Home |
| wearables | Wearables | Watch |
| appliances | Appliances | Refrigerator |
| fashion | Fashion | Shirt |
| sneakers | Sneakers | Footprints |
| bags | Bags | ShoppingBag |
| beauty | Beauty | Sparkles |
| fitness | Fitness | Dumbbell |
| furniture | Furniture | Armchair |
| kitchen | Kitchen | UtensilsCrossed |
| books | Books | BookOpen |
| toys | Toys | Puzzle |
| sports | Sports | Trophy |
| automotive | Automotive | Car |
| tools | Tools | Wrench |

---

## 4. Page Architecture

### Site map
```
/                   → Homepage
/deals              → Browse all deals
/compare            → Find for Less (search + results)
/deals/[category]   → Category browse (future)
/sitemap.xml        → Auto-generated
```

### Global layout
- **Navbar** (spoken.io exact): fixed top, 64px, white/surface bg, 1px border-b
  - Desktop: Logo + nav links center-left + CTA right
  - Mobile: Logo only in top bar + **bottom tab bar** (spoken.io: 64px, 4 tabs)
- **Footer**: 3-col grid (Company / Stores / Social), legal line
- **Body padding**: `pb-16 md:pb-0` for bottom tab clearance on mobile

---

## 5. Phase-by-Phase Build Plan

---

### Phase 0: Design Foundation
**Model: Sonnet · Effort: Low · ~20K tokens**

Files:
- `tailwind.config.ts` — full rewrite with semantic tokens, Inter font, new color system
- `src/app/globals.css` — CSS variable system (light/dark), component utilities
- `src/app/layout.tsx` — Inter via next/font, next-themes provider, metadata
- `package.json` — add `next-themes`

Key deliverables:
- Semantic CSS variables for all colors (light + dark)
- `.product-card`, `.composer`, `.cat-pill`, `.price-drop`, `.savings-badge` utilities
- Smooth `color-scheme` transitions (0.15s on bg/border/text)
- `prefers-reduced-motion` respected globally

---

### Phase 1: Navigation + Layout Shell
**Model: Sonnet · Effort: Low · ~15K tokens**

Files:
- `src/components/layout/Navbar.tsx` — spoken.io exact (white, fixed, clean links)
- `src/components/layout/Footer.tsx` — clean 3-col, global tone
- `src/components/layout/ThemeToggle.tsx` — new (sun/moon, top nav right)
- `src/components/layout/BottomNav.tsx` — spoken.io bottom tab bar (split from Navbar)

Navbar spec (spoken.io):
- `fixed top-0 z-50 w-full border-b bg-[--bg] border-[--border]`
- Height: `h-16` (64px)
- Logo: "Pryce" wordmark + small icon
- Desktop links: Home · Deals · Find for Less
- Right: Dark/light toggle + optional "Get started" CTA
- Active link: `text-[--text]` with `border-b-2 border-[--text]` underline (NOT a filled pill)
- Mobile: hide links, show logo + theme toggle only

Bottom tab bar (spoken.io exact):
- `fixed bottom-0 inset-x-0 z-40 h-16 grid grid-cols-4 border-t bg-[--bg] border-[--border]`
- Tabs: Home · Deals · Find for Less · Search
- Active: `text-[--text]` (black/white), inactive: `text-[--text-muted]`
- Icons: 20×20px, labels: 12px font-medium

---

### Phase 2: Homepage
**Model: Sonnet · Effort: Medium · ~35K tokens**

Files:
- `src/app/page.tsx` — updated section order
- `src/components/landing/Hero.tsx` — full rewrite (dupe.com composer + spoken.io feel)
- `src/components/landing/TrendingDeals.tsx` — spoken.io price-drop cards
- `src/components/landing/CategoryGrid.tsx` — image tile grid
- `src/components/landing/StoreLogos.tsx` — keep marquee, clean styling
- Remove: `Stats.tsx`, `Features.tsx`, `HowItWorks.tsx`, `CTA.tsx`

#### Hero (full spec)
Layout: `min-h-[90vh]` centered column, `max-w-2xl`, no split

Structure:
```
[Small badge — "Free · No account needed · 12 stores"]
[H1 — Display size, Inter 700, tight tracking]
  "Find similar products
   for less."
[Sub — "Compare prices across 12 stores. Paste any link or search anything."]
[Composer search box — dupe.com exact]
  - rounded-3xl, min-h-[108px], bg-[--bg-subtle] border border-[--border]
  - shadow-composer (light) / shadow-none (dark)
  - hover: border-[--border-strong]
  - focus-within: border-[--text-muted]
  - textarea: placeholder "Paste a link, or search anything…"
  - bottom-left: + icon (photo, disabled/soon)
  - bottom-right: submit ↑ circle (grayed disabled, filled when text entered)
[Category chips — horizontal scroll, pill style]
  Phone · Laptop · TV · Sneakers · Audio · Gaming · Fashion · Home · More…
[Trust strip — inline, below chips]
  "✓ Free  ·  ✓ No account  ·  ✓ Direct store links"
```

No background orbs/gradients. Clean white (light) or near-black (dark).
The ONLY visual accent in the hero is the green submit button when query is entered.

#### Trending Deals (spoken.io price-drop cards)
```
Section header: "Price drops today" · [See all →]
Card grid: 1 col mobile (horizontal scroll) → 2 col sm → 4 col lg
Card spec:
  - bg-[--bg-subtle] rounded-xl border border-[--border]
  - Image: aspect-[4/3], white bg, object-contain, rounded-t-xl
  - Badge (top-right): "-27%" pill, bg-[--badge-hot] text-white, rounded-full
  - Below image:
    - Store name · time-ago (text-[--text-muted], text-xs)
    - Title: font-semibold, line-clamp-2, text-sm
    - Price row: ~~₦89,000~~ → ₦65,000  [Save ₦24,000]
      - old: text-[--price-old] line-through text-xs
      - arrow: text-[--text-muted] text-xs
      - new: text-[--text] font-semibold text-sm
      - badge: bg-[--savings-bg] text-[--savings-text] rounded px-1.5 py-0.5 text-xs font-semibold
```

#### Category Grid
```
Grid: 2 col → 3 col sm → 4 col lg, gap-3
Each tile: aspect-square rounded-xl overflow-hidden relative cursor-pointer
  - Background image (category lifestyle photo or solid color)
  - Dark gradient overlay: from-transparent to-black/40
  - Category label: bottom-left, text-white, font-semibold, text-sm
  - Hover: scale-[1.02] transition-transform duration-300
```

---

### Phase 3: Deals Page
**Model: Sonnet · Effort: Medium · ~30K tokens**

Files:
- `src/components/deals/DealCard.tsx` — spoken.io vertical card
- `src/components/deals/DealFeed.tsx` — grid update + skeleton update
- `src/components/deals/CategoryNav.tsx` — pill chip style
- `src/app/deals/page.tsx` — metadata update

#### DealCard (spoken.io spec)
```
Always vertical — no horizontal layout at any breakpoint

Container: group cursor-pointer hover:-translate-y-0.5 transition-transform
  duration-200

Image container:
  - aspect-[3/4] w-full rounded-t-xl overflow-hidden
  - bg-white (always white for product image contrast)
  - Image: object-contain p-3, hover:scale-105 transition-transform duration-300
  - Discount badge: absolute top-2 right-2
    - "-27% off" — rounded-md bg-[--badge-hot] text-white text-xs font-bold px-2 py-1
  - INTL badge: absolute bottom-2 left-2
    - bg-[--badge-intl]/10 text-[--badge-intl] text-[10px] rounded px-1.5 py-0.5

Below image:
  - bg-[--bg-subtle] rounded-b-xl p-3 border border-t-0 border-[--border]
  - Store + time: flex row, text-[--text-muted] text-xs
  - Title: text-sm font-medium text-[--text] line-clamp-2 mt-1
  - Price row (mt-2):
    - If discount: ~~original~~ text-[--price-old] line-through text-xs
    - New price: font-semibold text-[--text] text-sm
    - Savings badge: inline, text-[--savings-text] bg-[--savings-bg] text-xs px-1.5 rounded
```

#### Grid columns
```
grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5
gap-3 sm:gap-4
```

#### CategoryNav
```
Horizontal scroll, no scrollbar, pill chips
chip: rounded-full px-4 py-2 text-sm font-medium border border-[--border]
      text-[--text-secondary] bg-transparent cursor-pointer whitespace-nowrap
chip active: bg-[--text] text-[--bg] border-[--text]
chip hover: border-[--border-strong] text-[--text]
transition: all 0.15s ease
```

---

### Phase 4: Find for Less (Compare) Page
**Model: Sonnet · Effort: Medium-High · ~40K tokens**

Files:
- `src/components/compare/SearchComposer.tsx` — new (dupe.com exact)
- `src/app/compare/page.tsx` — layout restructure
- `src/components/compare/AnchorCard.tsx` — new (dupe.com anchor product section)
- `src/components/compare/PriceResults.tsx` — spoken.io store-list style
- `src/components/compare/DupeCard.tsx` — simplified, 2-col, cleaner

#### SearchComposer (dupe.com exact spec)
```typescript
// Dimensions from dupe.com source:
rounded-3xl                // 24px border radius
min-h-[108px]              // expands as user types
border border-[--border]   // 1px
hover:border-[--border-strong]
bg-[--bg-subtle]
shadow-composer            // custom shadow
transition-[min-height,border-radius,box-shadow,border-color] duration-300

// Textarea (no fixed height — auto-resizes):
resize-none bg-transparent placeholder:text-[--text-muted]
px-4 pt-4 pb-0
min-h-[44px] max-h-[180px]

// Bottom action row (absolute):
bottom-3 left-3: + photo icon (disabled, "Image search coming soon")
bottom-3 right-3: ↑ submit button
  - disabled: bg-[--bg-muted] text-[--text-muted] rounded-full size-8
  - active: bg-[--text] text-[--bg] rounded-full size-8
  
// URL detected state:
- border-[--savings] (green border when URL pasted)
- placeholder changes to "Smart switching from [store]…"
```

#### Compare page layout (dupe.com narrow column)
```
Page: max-w-xl mx-auto px-4 py-12

// Sniff loading → result card (from existing feature, restyled)
// Anchor product card:
  - Product image: aspect-square max-h-[280px] rounded-xl bg-white
  - "Your pick" label: text-xs text-[--text-muted] uppercase tracking-wider
  - Title: text-xl font-semibold text-[--text]
  - Price: text-2xl font-bold text-[--text]
  - Stores: pill row (store name + price each)
  - "X alternatives found ↓" scroll CTA

// Separator:
  ─────── X alternatives from ₦Y ───────

// Alternatives grid:
  grid-cols-2 gap-3 (dupe.com — focus on readability, not density)
```

#### PriceResults (spoken.io store-list style)
```
Product header: image left + title/price right (horizontal)
Store rows:
  - Logo (32px rounded) + Store name + "Best" badge if cheapest
  - Price: font-bold text-[--text]
  - Savings vs highest: text-[--savings-text] text-sm
  - "↗ View deal" link right-aligned
  - Verified badge (✓) for known stores: Jumia, Amazon, Konga, Slot
Hover: bg-[--bg-subtle] rounded-lg
```

---

### Phase 5: Polish + Dark Mode Audit
**Model: Sonnet · Effort: Low · ~20K tokens**

- Audit every component for dark mode correctness
- Add `prefers-reduced-motion` to all animations
- Loading skeleton states using CSS variables (not hardcoded colors)
- Empty states for all pages
- Metadata: title, description, OG tags per page
- Favicon update (Pryce wordmark)
- Update all copy: remove Nigeria-specific language from non-localized strings
- Add country selector placeholder in navbar (flag icon, "🇳🇬 Nigeria ▾") — no functionality yet, just UI

---

## 6. Token Budget & Model Allocation

| Phase | Files changed | Estimated tokens | Model |
|-------|--------------|-----------------|-------|
| 0 · Design foundation | 3 | ~15K | Sonnet |
| 1 · Nav + layout | 4 | ~20K | Sonnet |
| 2 · Homepage | 5 | ~40K | Sonnet |
| 3 · Deals page | 3 | ~30K | Sonnet |
| 4 · Compare page | 5 | ~45K | Sonnet |
| 5 · Polish | ~10 | ~30K | Sonnet |
| **Total** | ~30 | **~180K** | **Sonnet** |

**Why Sonnet, not Opus?**
UI implementation at this quality level is a craft task — reading detailed specs and writing precise code. Opus adds value for novel reasoning (architectural decisions, complex debugging). All the hard decisions are made in this plan document. Sonnet executes them faster and cheaper, leaving budget for more iterations.

**Use Opus only for:** complex search logic bugs, architectural questions that arise mid-build.

With Pro Max 20x: ~180K tokens = very comfortable. Each phase fits in one session with room to iterate.

---

## 7. What We Are NOT Doing

- ❌ Recreating the Next.js project from scratch (all business logic stays)
- ❌ Changing API routes, search engine, or data layer
- ❌ Adding Stripe, auth, or user accounts in this iteration
- ❌ Deploying to a new domain (keep existing Vercel deployment)
- ❌ Rebuilding the scraper
- ❌ Adding animated gradients, particle effects, or glowing orbs (explicitly anti-AI feel)

---

## 8. Anti-AI Design Checklist

The user requested zero AI-generated feel. This means:

- ✓ **No gradient text** on body copy or headings
- ✓ **No glassmorphism** (no `backdrop-blur` on hero elements)
- ✓ **No glowing orbs** in the background
- ✓ **No purple/violet brand color** (associated with AI tools)
- ✓ **No animated floating elements**
- ✓ **No "AI-powered" or "smart" copy** in hero text
- ✓ **No neon/cyber aesthetic**
- ✓ **Copy tone**: direct, functional, confident — like Wirecutter or Which.co.uk
- ✓ **Icons**: Lucide (minimal line icons, not filled AI-style)
- ✓ **Shadows**: subtle and natural, not `box-shadow: 0 0 40px rgba(brand, 0.5)`
- ✓ **Animations**: 150ms transitions max on hover states, no entrance animations on product grids
- ✓ **Card style**: flat + border, not floating with glow

---

## 9. Reference Copy (Tone Examples)

**Hero H1:** "Find similar products for less."
**Hero sub:** "Compare prices across 12 stores before you buy. Works with any product link."
**Deals H1:** "Price drops worth your attention."
**Deals sub:** "Fresh offers from stores you already shop. Updated regularly."
**Compare H1 (empty):** "What are you looking for today?"
**Empty state deals:** "No results match your filters. Try resetting or broadening your search."
**Savings badge:** "Save ₦24,000" (not "🔥 HOT DEAL -27% OFF!!!")

---

## 10. Build Start Confirmation

Before starting, confirm:
1. **Name**: Keep "Dealesty" or rename to "Pryce"? (Just a text change)
2. **Accent color**: Green-forward (savings = brand) or add a second accent (e.g. indigo for interactive)?
3. **Start with Phase 0 immediately?**
