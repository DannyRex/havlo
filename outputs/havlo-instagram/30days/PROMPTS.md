# Havlo — 30 Image-Gen Prompts (v2, designed with UI/UX Pro Max intelligence)

This pack is a complete replacement for v1. The previous prompts were monotone editorial — same style on 30 posts produced a flat, samey feed. v2 deliberately rotates between **7 visual languages** mapped to post type, drawn from the `ui-ux-pro-max` design intelligence database. The result is a feed that *moves* — feature highlights pop, founder posts settle, psychological hooks bite, receipts whisper.

**Engines:** Midjourney v6+, Gemini Imagen 3 (best at text), or Nano-Banana / DALL·E 3.
**Output:** 1080×1080 square. Instagram / WhatsApp / sponsored ads.
**Workflow:** if text mis-renders in MJ, generate the LAYOUT, composite real prices in Figma. Gemini Imagen 3 is the safer bet for text-heavy posts.

---

## ★ MASTER BRAND BRIEF (paste at the top of every prompt)

```
You are an award-winning Senior Art Director with 20+ years of experience
across editorial design, product marketing, and brand identity. Your
references include Pentagram, Mark Boulton, Frank Chimero, Stefan Sagmeister
in his restrained period, Monocle magazine, Bloomberg Businessweek, Apple's
first-party marketing under Lee Clow, Linear's launch graphics, MSCHF's
deadpan campaigns, and Aesop's quiet sophistication.

You are art-directing a 30-post Instagram series for HAVLO, an honest
independent price-comparison platform live in 6 countries:
Nigeria · United Kingdom · United States · India · UAE · South Africa.

VOICE: Plain-spoken, direct, founder-led (Danny). Receipts over promises.
Real numbers from a real catalog. No marketing puffery. No urgency tactics.
No exclamation marks. No em-dashes. No "act now". The discipline of
someone who doesn't need to shout.

BRAND COLORS:
  Ink (primary text):     #0F172A
  Ink 2 (secondary):      #475569
  Ink 3 (whisper):        #94A3B8
  Brand blue (inversions):#0057FF
  Success green:          #10B981
  Success bg:             #ECFDF5
  Warn amber:             #CA8A04
  Off-white background:   #F7F8FA
  Paper warm:             #FAF8F3
  Border hairline:        #E2E8F0

CORE COMPOSITION RULES:
  • 1080×1080 square. IG + WhatsApp preview + sponsored ad ready.
  • One bold idea per canvas. Reads in 2 seconds, rewards 30-second study.
  • 'havlo' lowercase wordmark in a corner, never narrating.
  • Country code (NG/UK/US/IN/AE/ZA) as tiny mono label or pill chip.
  • One green chip per canvas only for "the winning price".
  • No drop shadows (except when style explicitly calls for hard-offset).
  • No gradients. No clip art. No emojis. No AI artifacts.
  • Everything aligned to an invisible 4px grid.

OUTPUT: Production-grade, museum-mount craftsmanship. The kind of design
that gets pinned on senior designers' moodboards.
```

---

## ★ STYLE SYSTEM (the 7 visual languages, used selectively)

| # | Style | Use for | Distinguishing marks |
|---|-------|---------|----------------------|
| **S1** | **Swiss Modernism 2.0** | Product comparisons (default) | Strict 12-col grid · Inter / Helvetica · single accent (success green) · mathematical spacing · WCAG AAA |
| **S2** | **Neo-Brutalism** | Witty / psychological / fun hooks | Cream #FFFDF5 base · Hot Red #FF6B6B · Vivid Yellow #FFD93D · Soft Violet · 4px black borders · hard offset shadows (no blur) · slight rotation (-2° / +2°) · Space Grotesk Bold |
| **S3** | **Minimalist Monochrome Editorial** | Receipt-style stats · honesty receipts | Pure B&W · 0 border-radius · no shadows · Playfair Display 900 hero + Source Serif 4 body + JetBrains Mono labels · 4px black section dividers · subtle paper noise (0.03 opacity) |
| **S4** | **Editorial Classic Serif** | Founder pull-quotes | Cormorant Garamond + Libre Baskerville · refined · literary · pull-quote pacing · massive faint opening quote mark |
| **S5** | **Magazine Style (Libre Bodoni)** | Feature spotlights · cross-border explainer | Libre Bodoni hero + Public Sans body · asymmetric grid · drop caps · column hierarchy |
| **S6** | **Liquid Glass / Premium** | High-end product comparisons (MacBook, iPhone Pro) | Translucent depth · iridescent micro-accents · backdrop-blur surfaces · vibrant inner glow on the green chip · premium product photography |
| **S7** | **Vibrant Block-based** | Energetic celebratory / "0 popups" / closing | 4-6 contrasting colors max (success green + brand blue + vivid yellow accents) · 48px+ block gaps · 32px+ type · high contrast 7:1 · scroll-snap rhythm |

**Style-to-post mapping** (so you don't have to think):

```
Post  Style  Reason
01    S1     Product comparison default
02    S6     MacBook Pro premium — liquid glass treatment
03    S1     Soundbar product comparison
04    S1     HP Omen product comparison
05    S5     ROG G700 magazine-style feature
06    S6     iPhone 14 Pro premium liquid glass
07    S1     HP Victus product comparison
08    S5     Hisense 50" magazine feature
09    S6     Galaxy S24 premium liquid glass
10    S1     PS5 Slim product comparison
11    S2     Closed tabs psychological hook — Neo-Brutalism bites
12    S2     Vindication moment — Neo-Brutalism
13    S2     What other tabs knew — Neo-Brutalism
14    S2     Anti-urgency patient flex — Neo-Brutalism
15    S5     Price history chart feature — magazine
16    S7     Price alerts — vibrant block, energetic announcement
17    S2     Barcode scanner — Neo-Brutalism (fun product feature)
18    S5     "Lowest in 30 days" badge — magazine
19    S7     Compare paste — vibrant block
20    S3     12,847 savings stat — receipt monochrome
21    S3     0 popups — monochrome editorial
22    S3     ₦393,000 spread — monochrome receipt
23    S4     Founder quote — classic serif pull-quote
24    S3     3.7% median spread — monochrome data
25    S5     Cross-border explainer — magazine diagram
26    S3     "Some things aren't on sale" — monochrome editorial
27    S7     Paste this Currys URL — vibrant block CTA
28    S4     What we don't do — classic editorial
29    S3     Recap monochrome receipt
30    S7     Closing CTA — vibrant block celebratory
```

---

## ★ ENGINE STYLE SUFFIXES

**Midjourney v6+ universal:**
```
--ar 1:1 --v 6 --style raw --stylize 100
```

**Per-style MJ keyword overrides** (append to base prompt):
- **S1 Swiss:** `, in the style of Pentagram, Bauhaus 1933 poster discipline, single-color accent, 12-column grid`
- **S2 Neo-Brutalism:** `, sticker-book aesthetic, hard 4px black borders, hard offset shadow no blur, slight rotation, Space Grotesk Bold, deadpan humor like MSCHF`
- **S3 Mono Editorial:** `, in the style of Massimo Vignelli, Playfair Display 900 tracking-tight, subtle paper noise texture 0.03 opacity, full-bleed 4px black section dividers, museum-mount print`
- **S4 Classic Serif:** `, Cormorant Garamond display type, Nieman Reports pull-quote layout, massive ghosted opening quote mark watermark`
- **S5 Magazine:** `, Libre Bodoni headlines, drop cap, asymmetric grid, Monocle magazine spread`
- **S6 Liquid Glass:** `, translucent depth, subtle backdrop-blur surfaces, premium product photography on paper-warm cyc, soft directional studio light, iridescent micro-accent on the winning chip only`
- **S7 Vibrant Block:** `, block-based composition with 48px+ gaps, vibrant high-contrast color blocking, 32px+ headline type, Linear product-launch graphic energy`

**Gemini Imagen 3 universal:** `Render at 1080×1080. Aspect ratio 1:1. Photorealistic for product photography. Editorial precision for typography. Render all literal text exactly as specified.`

---

# THE 30 PROMPTS

## 1. LG 4K OLED Smart TV — UK · [S1 Swiss Modernism]

**Real data:**
- Product: LG 4K OLED Smart TV
- Country: UK
- Cheapest: Appliances Direct · £2,419
- Comparison: Very · £3,387
- Save: £968 · 29% less

**Text on canvas (exactly):**
```
[chip: UK]                                    havlo

         [LG OLED TV product photo]
                  LG
        LG 4K OLED Smart TV

  ┌──CHEAPEST──┐         ┌──────────┐
  │            │         │          │
  │ Appliances │         │   Very   │
  │  Direct    │         │          │
  │  £2,419    │         │  £3,387  │
  └────────────┘         └──────────┘

         Same product.
   £968 cheaper at Appliances Direct.

                                    havlo.io
```

**Prompt:**
> [MASTER BRIEF] [S1 Swiss Modernism] Off-white #F7F8FA background. Strict
> 12-column grid. Top-left: small blue pill chip reading "UK" white on
> #0057FF. Top-right: 'havlo' wordmark in #0F172A. Hero product photo of
> a 65" LG 4K OLED TV (curved bezel, slim profile) centered in the upper
> half, real catalog product photography on a clean paper-warm surface,
> no marketing reflections. Beneath the TV, tiny mono label "LG" in
> #94A3B8 centered, then product title "LG 4K OLED Smart TV" centered in
> #475569 Instrument Sans Bold. Below: two horizontally-arrayed cards
> with a 30px gap. LEFT card #ECFDF5 background, 2px #10B981 outline,
> 14px radius, with a small "CHEAPEST" green chip overlapping its top-
> left edge (white text on #10B981), reading "Appliances Direct" on top
> line in #0F172A bold, "£2,419" big Geist Mono below in #0F172A. RIGHT
> card #F7F8FA fill, 1px #E2E8F0 outline, 14px radius, reading "Very"
> top line in #475569, "£3,387" big mono in #94A3B8. Below both cards,
> centered across two lines: "Same product." in #0F172A bold,
> "£968 cheaper at Appliances Direct." in #0F172A bold. Bottom-right
> corner: "havlo.io" tiny mono in #94A3B8. Mathematical spacing on the
> 8px base unit. Single green accent only. No shadows. WCAG AAA.
> `--ar 1:1 --v 6 --style raw --stylize 100`

---

## 2. MacBook Pro 16" M4 — UAE · [S6 Liquid Glass / Premium]

**Real data:** MacBook Pro 16" M4 · 48GB · AE · Macpro La AED 9,099 vs Hitech AED 11,678 · Save AED 2,579

**Prompt:**
> [MASTER BRIEF] [S6 Liquid Glass] Hero: a Space Black 16" MacBook Pro
> M4 photographed at a 30-degree elevated 3/4 angle with the lid open
> ~110°, soft directional studio light from camera-left producing gentle
> falloff. Background: warm off-white paper #FAF8F3 with subtle
> translucent gradient (Liquid Glass treatment). Top-left: glass pill
> chip "AE" with backdrop-blur surface, ink text #0F172A. Top-right:
> 'havlo' wordmark in #0F172A. Below the laptop, two pill chips with
> backdrop-blur depth: LEFT chip iridescent green-tinted, reading
> "Macpro La · AED 9,099" in Instrument Sans Bold #0F172A; small green
> dot prefix. RIGHT chip neutral translucent, reading "Hitech · AED
> 11,678" in #475569. Centered headline below in Instrument Sans Bold:
> "Same machine. Two stores. AED 2,579 between them." in #0F172A.
> Bottom-right: 'havlo.io' tiny mono #94A3B8. Premium feel — like an
> Apple stockholm in-store poster. No marketing language. Real product
> photography. Subtle Liquid Glass micro-accent on the winning chip
> only. `--ar 1:1 --v 6 --style raw, in the style of Apple keynote
> slide, translucent depth, subtle backdrop-blur surfaces, premium
> product photography`

---

## 3. Samsung HW-Q990F Soundbar — US · [S1 Swiss Modernism]

**Real data:** Samsung HW-Q990F 11.1.4 ch · US · Greentoe $877 vs Best Buy $1,498 · Save $621 · 41% less

**Prompt:**
> [MASTER BRIEF] [S1 Swiss Modernism] Off-white #F7F8FA. 12-col grid.
> Hero: a long, low Samsung HW-Q990F soundbar photographed straight-on,
> dead-center, real product shot with the speaker grille visible.
> Above the soundbar: tiny monospace #94A3B8 label reading "11.1.4
> CHANNELS · US · SAMSUNG". Below the soundbar, two horizontal price
> chips on one row: LEFT #ECFDF5 fill with 2px #10B981 border, small
> "CHEAPEST" white-on-green chip overlapping top-left, reading "Greentoe
> · $877" in Geist Mono. RIGHT #F7F8FA fill with 1px #E2E8F0 border,
> reading "Best Buy · $1,498". Below both, centered headline in
> Instrument Sans Bold #0F172A across two lines: "Volume up. / Price
> down." Bottom-left 'havlo' wordmark #0F172A. Bottom-right "havlo.io"
> tiny mono #94A3B8. Bang & Olufsen catalogue page restraint.
> `--ar 1:1 --v 6 --style raw --stylize 100`

---

## 4. HP Omen 16L Gaming PC — UK · [S1 Swiss Modernism, receipts variant]

**Real data:** HP Omen 16L · UK · Amazon UK £1,259 vs Currys £2,096 · Save £837 · 40% less

**Prompt:**
> [MASTER BRIEF] [S1 Swiss Modernism] Off-white #F7F8FA. 60/40 grid:
> RIGHT 40% column holds the HP Omen 16L gaming desktop photographed
> straight-on (RGB internals visible but understated, no fake glow). LEFT
> 60% column is pure typography: top monospace #94A3B8 "RECEIPT · UK ·
> HP OMEN 16L" then a single hairline #E2E8F0 horizontal divider, then
> two stacked data rows in Geist Mono — "Amazon UK · £1,259" with a tiny
> #10B981 dot prefix and the price in #0F172A bold; "Currys · £2,096" in
> #94A3B8 dim. Below the rows, a Bricolage Grotesque Bold headline
> "40% less, same week." in #0F172A. Bottom-left 'havlo' wordmark.
> Bottom-right "havlo.io" mono #94A3B8. Like a Bloomberg Pursuits
> spread. `--ar 1:1 --v 6 --style raw --stylize 100`

---

## 5. ASUS ROG G700 Desktop — US · [S5 Magazine / Libre Bodoni]

**Real data:** ASUS ROG G700 · US · Best Buy $1,219 vs Abt $1,734 · Save $516 · 30% less

**Prompt:**
> [MASTER BRIEF] [S5 Magazine Style] Off-white #F7F8FA with subtle column-
> grid hairlines #E2E8F0. Top-third: a Libre Bodoni 900 magazine
> headline in #0F172A reading "TWO STORES. ONE WINNER." with a real drop
> cap on the "T". Middle-third: hero photo of the ASUS ROG G700 gaming
> tower at three-quarter view, photographed against a clean paper cyc.
> Bottom-third in Public Sans columns: LEFT col "Best Buy" + "$1,219" in
> bold #0F172A with small green dot prefix; RIGHT col "Abt" + "$1,734"
> in #475569 dim. Beneath both columns running full-width: editorial
> body line in Public Sans 14pt "Same week, same SKU, $516 between
> them." Top-right: small mono "US · GAMING". Bottom-left 'havlo' word-
> mark. Monocle magazine spread, asymmetric grid, drop cap, restrained.
> `--ar 1:1 --v 6 --style raw, Libre Bodoni headlines, asymmetric magazine
> grid, drop cap, Monocle spread`

---

## 6. Apple iPhone 14 Pro — NG · [S6 Liquid Glass / Premium]

**Real data:** iPhone 14 Pro 128GB · NG · Jumia ₦850,000 vs Kara ₦1,243,000 · Save ₦393,000 · 32%

**Prompt:**
> [MASTER BRIEF] [S6 Liquid Glass] Hero: a Deep Purple iPhone 14 Pro
> photographed flat-on with a gentle three-quarter tilt, real product
> photography on paper-warm #FAF8F3, soft directional studio light. Top-
> left: a frosted-glass pill chip "NG" with backdrop-blur surface and ink
> text. Top-right: 'havlo' wordmark in #0F172A. Below the iPhone, a
> horizontal split: LEFT half tinted with a translucent green wash
> (#ECFDF5 at 60% opacity over paper), reading "JUMIA" tiny mono label
> on top, "₦850,000" big Bricolage Grotesque Bold #0F172A below. RIGHT
> half plain paper, reading "KARA" tiny mono, "₦1,243,000" big in
> #94A3B8 dim. Below the split, a single editorial sentence in
> Instrument Sans Bold #0F172A: "Same phone. Two prices. Your choice."
> Bottom-right "havlo.io" tiny mono. Like a Lagos design-studio
> catalogue page. No naira-symbol gymnastics. Subtle Liquid Glass
> backdrop-blur on the JUMIA winning chip only.
> `--ar 1:1 --v 6 --style raw, premium product photography, subtle
> backdrop-blur, translucent depth, iridescent green micro-accent`

---

## 7. HP Victus Gaming Laptop — UAE · [S1 Swiss Modernism, spec receipt]

**Real data:** HP Victus · i7-13620H · RTX 3050 · AE · Noon AED 3,038 vs Jumbo AED 3,923 · Save AED 885

**Prompt:**
> [MASTER BRIEF] [S1 Swiss Modernism] Off-white #F7F8FA. Hero: an HP
> Victus 15.6" gaming laptop with lid open ~110°, photographed top-down
> three-quarter view in the upper two-thirds. Below the laptop, a
> horizontal monospaced spec strip in Geist Mono #94A3B8 reading
> "i7-13620H · RTX 3050 · 16 GB · 512 GB SSD". Beneath specs, two side-
> by-side chips: LEFT #ECFDF5 with green border and CHEAPEST tab,
> reading "Noon · AED 3,038". RIGHT #F7F8FA neutral, reading "Jumbo ·
> AED 3,923" in #475569. Centered headline below: "Same machine. AED 885
> difference." in Instrument Sans Bold #0F172A. Bottom-left 'havlo' word-
> mark. Bottom-right "AE · havlo.io" mono #94A3B8. Editorial pacing. No
> gaming-brand swooshes. `--ar 1:1 --v 6 --style raw --stylize 100`

---

## 8. Hisense 50" UHD TV — NG · [S5 Magazine Style]

**Real data:** Hisense 50" UHD · NG · Konga ₦433,400 vs Jumia ₦696,200 · Save ₦262,800 · 38%

**Prompt:**
> [MASTER BRIEF] [S5 Magazine Style] Off-white #F7F8FA, asymmetric grid
> with subtle column-rule hairlines #E2E8F0. Hero: a Hisense 50-inch 4K
> UHD TV photographed straight-on against a clean studio cyc, no fake
> screen content. Top-right: Libre Bodoni section eyebrow in #94A3B8
> reading "LAGOS · ELECTRONICS · DEAL OF THE WEEK". Below the TV,
> magazine-style stacked typography: top line Libre Bodoni 700 #0F172A
> "Konga" big with a small green dot prefix; second line "₦433,400" in
> Public Sans 60pt #0F172A; third line "Jumia" smaller in #475569;
> fourth "₦696,200" in #94A3B8. A short editorial copy line below in
> Public Sans 14pt: "Two stores in Lagos. ₦262,800 between them."
> Top-left small mono "NG". Bottom-left 'havlo' wordmark. Bottom-right
> "havlo.io" mono. Monocle photo editor's restraint.
> `--ar 1:1 --v 6 --style raw, Libre Bodoni headlines, magazine spread`

---

## 9. Samsung Galaxy S24 — India · [S6 Liquid Glass / Premium]

**Real data:** Galaxy S24 256GB · IN · Flipkart ₹64,999 vs Amazon India ₹79,900 · Save ₹14,901

**Prompt:**
> [MASTER BRIEF] [S6 Liquid Glass] Hero: a Cobalt Violet Samsung Galaxy
> S24 photographed flat on a paper-warm surface #FAF8F3 with slight top-
> down angle, soft directional light. Top-left: frosted-glass pill chip
> "IN" with backdrop-blur and ink text. Top-right: 'havlo' wordmark
> #0F172A. Below the phone, two side-by-side translucent chips with
> subtle depth: LEFT chip Liquid Glass iridescent-green tint reading
> "Flipkart · ₹64,999" in Instrument Sans Bold #0F172A; RIGHT chip
> neutral translucent "Amazon India · ₹79,900" in #475569. Centered
> headline below in Instrument Sans Bold #0F172A: "Same phone. Two
> flagship stores. ₹14,901 in your pocket." Bottom-right "havlo.io"
> mono. Like an Apple Sthlm in-store poster, premium and calm.
> `--ar 1:1 --v 6 --style raw, premium product photography, translucent
> depth, Apple keynote slide aesthetic`

---

## 10. PlayStation 5 Slim — South Africa · [S1 Swiss Modernism]

**Real data:** PS5 Slim Disc edition · ZA · Takealot R 13,499 vs Makro R 15,999 · Save R 2,500

**Prompt:**
> [MASTER BRIEF] [S1 Swiss Modernism] Off-white #F7F8FA. 12-col grid.
> Hero: a white PlayStation 5 Slim console placed flat on its side,
> photographed straight-on, real product shot, soft drop shadow.
> Above the console: tiny mono #94A3B8 "PS5 SLIM · DISC · ZA · SONY".
> Below the console, two horizontal chips on one row: LEFT #ECFDF5 with
> 2px #10B981 border and CHEAPEST tab, reading "Takealot · R 13,499" in
> Geist Mono #0F172A. RIGHT #F7F8FA #E2E8F0 border, "Makro · R 15,999"
> in #475569. Centered headline below: "Same console. R 2,500 between
> them." in Instrument Sans Bold #0F172A. Bottom-left 'havlo' wordmark.
> Bottom-right "havlo.io" mono. No PlayStation rainbow key overlay.
> `--ar 1:1 --v 6 --style raw --stylize 100`

---

## 11. Closed Tabs hook — psychological · [S2 Neo-Brutalism]

**Concept:** You closed 4 tabs. We kept the cheapest one open.

**Prompt:**
> [MASTER BRIEF] [S2 Neo-Brutalism] Cream background #FFFDF5 with
> subtle paper grain. Center-top: an illustration of FIVE browser tab
> silhouettes arranged in a horizontal row. Four of them have hard 4px
> black borders, hard offset shadows (4-6px to bottom-right, NO blur),
> slight -1° rotation, and are crossed out with a single thick red
> #FF6B6B diagonal slash. The FIFTH tab in the middle is upright at 0°,
> filled with Vivid Yellow #FFD93D, hard offset shadow black, with a
> tiny "₤2,419" hand-lettered price tag sticking out of its top edge
> like a bookmark. Below the tabs, Space Grotesk Bold #0F172A across
> three lines: "You closed 4 tabs." (line 1) / "We kept 1 open." (line
> 2) / "The cheapest one." (line 3) — each line slightly rotated -1°,
> +1°, -1° respectively for sticker-book energy. Bottom-left 'havlo'
> wordmark. Top-right tiny mono "RECEIPT". Mechanical-press energy.
> Deadpan humor. Like an MSCHF drop.
> `--ar 1:1 --v 6 --style raw, neo-brutalism mobile aesthetic, cream
> background, hard offset shadows no blur, Space Grotesk Bold, slight
> rotation, sticker-book collage`

---

## 12. Vindication — psychological · [S2 Neo-Brutalism]

**Concept:** You were right. The other store was overcharging.

**Prompt:**
> [MASTER BRIEF] [S2 Neo-Brutalism] Cream #FFFDF5 background, paper
> grain. Centered HUGE Space Grotesk Bold/Black 900-weight typography
> filling almost the entire canvas: "YOU WERE / RIGHT." on the top half
> in #0F172A (line break after WERE), and "The other store / was
> overcharging." in smaller weight on the bottom half in #FF6B6B Hot
> Red. The word "RIGHT." has a hard yellow #FFD93D highlight rectangle
> behind it (offset 4px down/right, no blur, 4px black border). Bottom-
> left 'havlo' wordmark in #0F172A. Top-right tiny mono "VINDICATED".
> Slight overall rotation -2°. Sticker-collage punch. Deadpan.
> `--ar 1:1 --v 6 --style raw, neo-brutalism, hot red and vivid yellow
> on cream, hard offset shadows, Space Grotesk Black, slight rotation`

---

## 13. The Other Tab Knew — psychological · [S2 Neo-Brutalism]

**Concept:** Split screen — the price the other tab was showing vs the one you paid.

**Prompt:**
> [MASTER BRIEF] [S2 Neo-Brutalism] Cream #FFFDF5. Hard split-canvas
> diagonal slash from top-right to bottom-left, 6px black line. LEFT
> triangle: Vivid Yellow #FFD93D fill, contains a stylized browser
> bookmark shape with hard offset shadow showing "£89" in big Space
> Grotesk Bold #0F172A. Beside it tiny mono "WHAT IT KNEW". RIGHT
> triangle: Hot Red #FF6B6B fill, contains a receipt-stub shape with
> "£127 PAID" in #FFFDF5 white Space Grotesk Bold. Beside it tiny
> "WHAT YOU PAID". Across the bottom centered in #0F172A Space Grotesk
> Bold: "This never has to happen again." Bottom-left 'havlo' wordmark.
> Top-right tiny mono "PLOT TWIST". Bauhaus collage energy meets MSCHF.
> `--ar 1:1 --v 6 --style raw, neo-brutalism collage, hard split canvas,
> hot red and vivid yellow on cream, hard offset shadows, Space
> Grotesk Black`

---

## 14. Anti-urgency Patient Flex — psychological · [S2 Neo-Brutalism]

**Concept:** Don't act now. Take your time. We'll watch the price.

**Prompt:**
> [MASTER BRIEF] [S2 Neo-Brutalism] Cream #FFFDF5 background. Center-top:
> an illustrated stop-watch shape rendered in Hot Red #FF6B6B with hard
> 4px black border, hard offset shadow (4px down-right, no blur), and
> the watch dial reading "TAKE YOUR TIME" instead of numbers in Space
> Grotesk Bold #0F172A. The watch is slightly rotated -3°. Below the
> watch, three stacked headlines in Space Grotesk Black 900-weight
> #0F172A: "Don't act now." (line 1, slightly rotated -1°) / "Take your
> time." (line 2, slightly rotated +1°, with a Vivid Yellow #FFD93D
> highlight behind the word "time") / "We'll watch the price." (line 3,
> -1°). Below the lines, tiny mono caption in #475569: "Price alerts on
> havlo.io". Bottom-left 'havlo' wordmark. Top-right tiny mono
> "ANTI-URGENCY". The visual punchline is: this is the only stop-watch
> in retail design that doesn't pressure you.
> `--ar 1:1 --v 6 --style raw, neo-brutalism, deadpan anti-marketing,
> hard offset shadows, Space Grotesk Black, slight rotation`

---

## 15. Price History Feature · [S5 Magazine Style]

**Concept:** Watch the price. Not just check it. (Chart line goes DOWN.)

**Prompt:**
> [MASTER BRIEF] [S5 Magazine Style] Off-white #F7F8FA. Top half occupies
> a Libre Bodoni 900-weight headline across two lines in #0F172A: "Watch
> the price." (line 1, big) / "Not just check it." (line 2, slightly
> smaller). A small section-eyebrow above in mono #94A3B8 "NEW · PRICE
> HISTORY". Below the headline: a clean monotone-cubic price line chart
> rendered in #10B981 (success green) starting from upper-left (high
> price ~70% from top) and curving DOWN to lower-right (low price ~85%
> from top). Soft fill #ECFDF5 below the curve. A solid #10B981 dot at
> the end (right edge). Three small date labels along the bottom axis
> in Geist Mono "Mar 23", "Apr 12", "May 28" #94A3B8. A dashed hori-
> zontal reference line at the current-price level in #94A3B8 with a
> tiny "Your price · £79" label floating on the right edge. Below the
> chart, a single Public Sans body line #475569: "A live chart of every
> price change, across stores, for 365 days." Bottom-left 'havlo' word-
> mark. Bottom-right "havlo.io" mono. Financial Times graphics desk
> precision. The line going DOWN is the story.
> `--ar 1:1 --v 6 --style raw, Libre Bodoni headline, Financial Times
> chart aesthetic, monotone-cubic curve, success green #10B981`

---

## 16. Price Alerts Feature · [S7 Vibrant Block-based]

**Concept:** Set your number. We'll email you when any store hits it.

**Prompt:**
> [MASTER BRIEF] [S7 Vibrant Block-based] Full canvas brand blue #0057FF.
> Bottom-third: a giant rectangular block #FFD93D Vivid Yellow with hard
> 4px black border (no blur shadow), 48px+ gap from the edges, containing
> a centered illustrated bell icon in #0F172A with three concentric
> #0F172A outline circles radiating outward (like a quiet siren).
> Inside the bottom of the yellow block, mono caption #0F172A
> "NEW · PRICE ALERTS". Top-half: massive Bricolage Grotesque Bold
> 900-weight headline in white across two lines: "Set your number."
> (line 1) / "Walk away." (line 2 — slightly smaller). Below the
> headline in Public Sans 28pt white-90%: "We'll email you the moment
> any store hits it." Top-left 'havlo' wordmark in white. Block-based,
> bold, energetic, 32px+ type, 7:1 contrast. Linear product-launch
> graphic energy.
> `--ar 1:1 --v 6 --style raw, vibrant block-based, 4-color contrast,
> Bricolage Grotesque, Linear product-launch graphic, IBM 1965 print
> campaign`

---

## 17. Barcode Scanner Feature · [S2 Neo-Brutalism]

**Concept:** In a shop? Scan it.

**Prompt:**
> [MASTER BRIEF] [S2 Neo-Brutalism] Cream #FFFDF5 background, subtle
> paper grain. Center: a stylized vertical barcode rendered in hard
> #0F172A with FOUR L-shaped corner brackets (camera AR scan frame) in
> hard #FF6B6B Hot Red, each bracket 4px thick. A thin horizontal scan
> line crosses the barcode mid-height in #10B981 success green. The
> entire barcode-frame composition is slightly rotated -2° for sticker
> energy and has a hard #FFD93D Vivid Yellow offset shadow behind it
> (6px down-right, no blur). Above the barcode, Space Grotesk Bold/Black
> #0F172A across two lines, big: "In a shop?" (line 1) / "Scan it."
> (line 2, with a Vivid Yellow #FFD93D highlight behind "Scan"). Below
> the barcode, tiny mono #475569: "havlo.io/scan". Bottom-left 'havlo'
> wordmark. Top-right tiny mono "NEW · SCAN". MSCHF drop energy meets
> mechanical receipt printer.
> `--ar 1:1 --v 6 --style raw, neo-brutalism, cream + hot red + vivid
> yellow, hard offset shadows, Space Grotesk Black, slight rotation`

---

## 18. "Lowest in 30 Days" Badge Feature · [S5 Magazine Style]

**Concept:** A badge that earns it.

**Prompt:**
> [MASTER BRIEF] [S5 Magazine Style] Off-white #F7F8FA. Top: a Libre
> Bodoni 900-weight magazine headline in #0F172A across two lines: "A
> badge that earns it." (line 1) with a drop cap on "A". Below the
> headline, centered, the HERO: an oversized pill-shaped chip rendered
> at scale — pill is #ECFDF5 fill with 3px #10B981 success-green hair-
> line border, 80px tall, contains the text "LOWEST IN 30 DAYS" in
> Public Sans Bold #10B981 with a tiny #10B981 dot prefix. The chip is
> the hero of the canvas. Below the chip, in Public Sans 14pt #475569:
> "Only when the current price genuinely matches the 30-day floor
> across stores. Not marketing. Math." Top-left 'havlo' wordmark.
> Top-right tiny mono "NEW · BADGE". Bottom-right "havlo.io" mono.
> Edward Tufte precision applied to a tiny UI element treated as a
> museum object.
> `--ar 1:1 --v 6 --style raw, Libre Bodoni, magazine spread, museum-
> object treatment of UI element`

---

## 19. Compare Paste Feature · [S7 Vibrant Block-based]

**Concept:** Paste a link. See it cheaper.

**Prompt:**
> [MASTER BRIEF] [S7 Vibrant Block-based] Brand blue #0057FF full canvas.
> Left half (center vertically): a stacked column of THREE faint
> white-outlined rectangles 48px apart with hard borders, labelled in
> white Geist Mono — "amazon.co.uk/...", "currys.co.uk/...", "argos.co.uk/
> ...". A bold WHITE arrow with hard outline points from the stack to
> the RIGHT half. Right half: a single SOLID Vivid Yellow #FFD93D
> rectangle (4px black border, no blur shadow) labelled in #0F172A
> Geist Mono "havlo.io". Above the entire diagram, massive white
> Bricolage Grotesque Bold across two lines: "Paste a link." (line 1) /
> "See it cheaper." (line 2). Top-left 'havlo' wordmark in white.
> Bottom-left tiny mono "THE ORIGINAL FEATURE". 32px+ type, 48px+ block
> gaps, high contrast. Anti-clutter Bauhaus-meets-Linear energy.
> `--ar 1:1 --v 6 --style raw, vibrant block-based, Bauhaus meets
> Linear, 4-color contrast`

---

## 20. 12,847 Savings Logged — receipt · [S3 Minimalist Monochrome Editorial]

**Concept:** This week alone, across 6 countries.

**Prompt:**
> [MASTER BRIEF] [S3 Minimalist Monochrome Editorial] Pure off-white
> #FFFFFF background with subtle paper noise texture at 0.03 opacity
> (almost imperceptible). NO color anywhere except pure black #0F172A
> typography. Center: massive Playfair Display 900 numeric type "12,847"
> taking up ~35% of the canvas height in #0F172A, tracking tight. Below
> "12,847", smaller Source Serif 4 body text in #0F172A: "savings
> logged this week." Below in JetBrains Mono uppercase tracking-widest
> #94A3B8: "ACROSS · 6 · COUNTRIES · ACROSS · THOUSANDS · OF · PRODUCTS".
> A 4px black horizontal section divider full-bleed underneath the mono
> line. Top-left 'havlo' wordmark in #0F172A. Top-right JetBrains Mono
> "RECEIPT 1/30" #94A3B8. Bottom-right tiny "havlo.io" mono. Strictly
> 2D. No shadows. Brutalist precision. Massimo Vignelli museum print.
> `--ar 1:1 --v 6 --style raw, Playfair Display 900, Source Serif 4,
> JetBrains Mono, paper noise 0.03 opacity, 4px black section divider,
> Massimo Vignelli museum print`

---

## 21. 0 Popups — receipt · [S3 Minimalist Monochrome Editorial]

**Concept:** No countdown timers. No fake scarcity.

**Prompt:**
> [MASTER BRIEF] [S3 Minimalist Monochrome Editorial] Pure off-white
> #FFFFFF with subtle paper noise 0.03 opacity. Strictly black + white,
> NO other color. Center upper-half: enormous Playfair Display 900 "0"
> in #0F172A, takes up ~45% of canvas height, tracking tight. Below in
> slightly smaller Playfair Display 700: "popups". Beneath in Source
> Serif 4 italic #0F172A across two lines: "No countdown timers. No
> fake scarcity. / No thank you." A 4px full-bleed black horizontal
> divider below. Below the divider, JetBrains Mono uppercase tracking-
> widest #94A3B8: "THE · HONEST · UI · TAX · IS · THE · ONLY · ONE · WE · PAY".
> Top-left 'havlo' wordmark. Top-right mono "RECEIPT 2/30". Hans-Jürgen
> Burkard photograph discipline — one subject, all the room in the world.
> `--ar 1:1 --v 6 --style raw, Playfair Display 900, Source Serif 4
> italic, JetBrains Mono, paper noise, 4px black divider, Massimo
> Vignelli`

---

## 22. ₦393,000 Spread — receipt · [S3 Minimalist Monochrome Editorial]

**Concept:** The gap between Jumia and Kara on the same iPhone 14 Pro.

**Prompt:**
> [MASTER BRIEF] [S3 Minimalist Monochrome Editorial] Pure off-white
> #FFFFFF with paper noise 0.03 opacity. Strictly black + white. Upper
> portion: massive Playfair Display 900 "₦393,000" in #0F172A taking up
> 30% of canvas height, tracking tight. The ₦ symbol is the same
> Playfair Display weight, treated with care. A 4px black full-bleed
> horizontal divider below. Below the divider in Source Serif 4
> #0F172A across two lines: "the gap between Jumia and Kara / on the
> same iPhone 14 Pro this week." Below in italic Source Serif 4
> #0F172A: "Not a percentage. A receipt." Top-left 'havlo' wordmark.
> Top-right JetBrains Mono "RECEIPT 3/30 · NG". Bottom-right "havlo.io"
> mono. The Playfair numeric sits like a museum object.
> `--ar 1:1 --v 6 --style raw, Playfair Display 900, Source Serif 4
> italic, JetBrains Mono, paper noise, 4px black divider`

---

## 23. Founder Quote — Danny · [S4 Editorial Classic Serif]

**Concept:** Online shopping is messy. We replace five tabs with one.

**Prompt:**
> [MASTER BRIEF] [S4 Editorial Classic Serif] Off-white #FAF8F3 paper-
> warm background. Top-left corner ~25% of canvas: a MASSIVE faint
> Cormorant Garamond opening curly quote mark " in #94A3B8 at very low
> opacity (~12%), behaving as a watermark. Center-left aligned: the
> quote across four lines in Cormorant Garamond 700 italic #0F172A,
> generous leading: "Online shopping / is messy. The same / product can
> vary by / 30 to 50% between stores." Below the quote, smaller Cormorant
> 600 (not italic) in #0F172A: "We replace five tabs with one." Beneath
> in Libre Baskerville small caps tracking-widest #94A3B8: "— DANNY,
> FOUNDER". Top-left 'havlo' wordmark very small in #475569. Top-right
> tiny "FROM THE FOUNDER" in Libre Baskerville small caps. Wide left
> margin like a Nieman Reports pull-quote spread.
> `--ar 1:1 --v 6 --style raw, Cormorant Garamond italic, Libre
> Baskerville, Nieman Reports profile pull-quote, ghosted opening quote
> mark watermark`

---

## 24. 3.7% Median Spread — receipt · [S3 Minimalist Monochrome Editorial]

**Concept:** Median spread. The interesting items live in the tail.

**Prompt:**
> [MASTER BRIEF] [S3 Minimalist Monochrome Editorial] Off-white #FFFFFF
> + paper noise 0.03 opacity. Pure B&W. Top: massive Playfair Display
> 900 "3.7%" in #0F172A taking up ~30% canvas height. A 4px black full-
> bleed horizontal section divider. Below the divider: a SMALL clean
> monochrome bell-curve distribution chart in line stroke only — pure
> black #0F172A hairlines on white, mathematical curve, NO fill. A
> single 8px solid black dot marks the long-tail position roughly 75%
> to the right with a tiny annotation arrow pointing right and the
> Source Serif 4 italic label "the interesting items". Below the chart:
> Source Serif 4 #0F172A across two lines: "the median spread between
> cheapest and dearest / across our catalog." Top-left 'havlo' wordmark.
> Top-right JetBrains Mono "RECEIPT 4/30". Edward Tufte rigor applied to
> a single data point.
> `--ar 1:1 --v 6 --style raw, Playfair Display 900, Source Serif 4,
> JetBrains Mono, Edward Tufte chart, monochrome distribution, paper
> noise`

---

## 25. Cross-border Explainer · [S5 Magazine Style]

**Concept:** Cheapest TOTAL wins. Not the cheapest sticker.

**Prompt:**
> [MASTER BRIEF] [S5 Magazine Style] Off-white #F7F8FA with column-rule
> hairlines #E2E8F0. Top: a Libre Bodoni 900-weight section eyebrow in
> #475569 "EXPLAINER". Then a Libre Bodoni 900 headline in #0F172A:
> "Cross-border pricing." with a real drop cap on "C". Middle: an info-
> flow diagram — three horizontal pill chips connected by hairline
> #94A3B8 arrows: LEFT chip #F7F8FA "Sticker price" → MIDDLE chip
> #FAF8F3 "+ ~30% landed (shipping & customs)" → RIGHT chip #ECFDF5
> with #10B981 green border "TOTAL · winning store". Below the diagram,
> Public Sans 16pt #475569: "Cheapest TOTAL wins. Not the cheapest
> sticker." Bottom-left 'havlo' wordmark. Bottom-right "havlo.io" mono.
> Pentagram wayfinding diagram restraint.
> `--ar 1:1 --v 6 --style raw, Libre Bodoni headline drop cap,
> Pentagram wayfinding diagram, magazine asymmetric grid`

---

## 26. Some Things Aren't On Sale — receipt · [S3 Minimalist Monochrome Editorial]

**Concept:** We list them anyway.

**Prompt:**
> [MASTER BRIEF] [S3 Minimalist Monochrome Editorial] Pure off-white
> #FFFFFF + paper noise 0.03 opacity. Center: in massive Playfair Display
> 900 #0F172A across two lines: "Some things aren't / on sale." (line
> break after aren't). A 4px full-bleed black divider below. Below the
> divider in slightly smaller Playfair Display 700 italic: "We list them
> anyway." Below in Source Serif 4 small caps tracking-widest #475569:
> "PHARMACIES · GROCERS · HONEST · STORES · WITHOUT · COMPARE-AT". Bottom-
> left 'havlo' wordmark. Top-right JetBrains Mono "RECEIPT 5/30".
> Quiet typographic confidence.
> `--ar 1:1 --v 6 --style raw, Playfair Display 900 + italic 700, paper
> noise, 4px black divider, Massimo Vignelli`

---

## 27. Try This Currys URL · [S7 Vibrant Block-based, CTA energy]

**Concept:** Paste any Currys URL into havlo.io.

**Prompt:**
> [MASTER BRIEF] [S7 Vibrant Block-based] Brand blue #0057FF full canvas.
> Center: a single floating white-outlined input-field rectangle (4px
> white border, 48px+ padding), deeply minimal, containing a faint white
> placeholder "currys.co.uk/products/..." in Geist Mono with a small
> blinking white cursor at the end. A tiny #10B981 success green dot in
> the input field's left edge. Above the input field, massive Bricolage
> Grotesque Bold in white across two lines: "Try this." (line 1) / "Paste
> any Currys URL." (line 2 smaller). Below the field in Public Sans 18pt
> white-80%: "into havlo.io. We do the rest." Top-left 'havlo' wordmark
> white. Bottom-right tiny mono "havlo.io". Linear product-launch graphic
> energy. 32px+ type, 48px+ gaps, high contrast.
> `--ar 1:1 --v 6 --style raw, vibrant block-based, Linear launch
> graphic, Bricolage Grotesque, anti-clutter`

---

## 28. What We Don't Do · [S4 Editorial Classic Serif]

**Concept:** We don't take payment. Don't ship goods. Don't hold inventory.

**Prompt:**
> [MASTER BRIEF] [S4 Editorial Classic Serif] Off-white #FAF8F3 paper-
> warm background. Center-left aligned: three stacked Cormorant Garamond
> 600 italic lines in #0F172A, each prefixed by a faint hairline #94A3B8
> em-dash: "— We don't take payment." / "— We don't ship goods." / "— We
> don't hold inventory." Generous leading between lines. Below the three
> lines in Libre Baskerville small caps tracking-widest #94A3B8: "EVERY ·
> TRANSACTION · IS · BETWEEN · YOU · AND · THE · STORE". Top-left 'havlo'
> wordmark very small. Top-right tiny Libre Baskerville small caps "HOW
> WE WORK". Wide left margin. Nieman Reports profile-page pacing.
> `--ar 1:1 --v 6 --style raw, Cormorant Garamond italic, Libre
> Baskerville small caps, Nieman Reports profile spread`

---

## 29. 30 Days, Real Prices Recap · [S3 Minimalist Monochrome Editorial]

**Concept:** Every entry sourced from the live catalog.

**Prompt:**
> [MASTER BRIEF] [S3 Minimalist Monochrome Editorial] Pure white #FFFFFF
> + 0.03 paper noise. A single thin printed-receipt graphic running
> vertically down the CENTER of the canvas, slightly offset (5px to the
> right of center), with thermal-print-style perforation marks at top
> and bottom edges. The receipt contains the lines in JetBrains Mono
> uppercase tracking-tight printed on the receipt: "REAL PRICES." /
> "REAL STORES." / "NO STAGED NUMBERS." / a hairline horizontal divider /
> "SOURCED · FROM · THE · LIVE · CATALOG." / "THANK · YOU · FOR · READING
> · THE · RECEIPTS." Beneath the receipt below the canvas centerline,
> small Source Serif 4 italic in #94A3B8: "havlo.io". Top-left 'havlo'
> wordmark. Top-right JetBrains Mono "RECEIPT 30/30". Strictly 2D. No
> shadows. Museum-mount supermarket receipt aesthetic.
> `--ar 1:1 --v 6 --style raw, museum-mount thermal receipt aesthetic,
> JetBrains Mono printed type, Source Serif 4 italic, paper noise`

---

## 30. Closing CTA — Earn Your Second Visit · [S7 Vibrant Block-based]

**Concept:** Try one product. See if we earn your second visit.

**Prompt:**
> [MASTER BRIEF] [S7 Vibrant Block-based] Brand blue #0057FF full canvas
> inverted. Upper half: massive Bricolage Grotesque Bold 900 in white
> across two lines: "Try one product." (line 1) / "See if we earn your
> second visit." (line 2, slightly smaller). Generous leading. Below the
> headline, centered, a single thin white horizontal underline rule (~35%
> canvas width) with the word "havlo.io" floating above it in white
> Bricolage Grotesque Bold. Below the underline in white-70% Geist Mono
> "(the underline is the link.)" Bottom-left 'havlo' wordmark in white.
> Top-right tiny mono in white "CLOSING". The single editorial moment:
> the underline isn't decorative, it IS the click target. Stefan
> Sagmeister letterpress poster restraint.
> `--ar 1:1 --v 6 --style raw, vibrant block-based, Stefan Sagmeister
> letterpress poster, Bricolage Grotesque Bold 900`

---

# WORKFLOW NOTES

**Recommended generation order:**
1. Anchor the rhythm — generate posts **16, 19, 27, 30** first (all S7 Vibrant Block brand blue inversions). These set the punctuation marks across the 30-post grid.
2. Generate the **Neo-Brutalism block** (posts 11, 12, 13, 14, 17) together — they share cream + hot red + vivid yellow palette and should feel like a coherent run when scrolled.
3. Generate the **Monochrome Editorial block** (posts 20, 21, 22, 24, 26, 29) — these are the receipt-paper foundation. Pure B&W, paper noise, Playfair Display 900.
4. Generate the **Founder Voice / Classic Serif block** (posts 23, 28).
5. Generate the **Magazine block** (posts 5, 8, 15, 18, 25).
6. Generate the **Liquid Glass premium block** (posts 2, 6, 9) — high-value product hero shots.
7. Generate the remaining **Swiss Modernism comparisons** (posts 1, 3, 4, 7, 10).

This order locks the visual rhythm of the feed before filling in middles.

**Text mis-rendering fallback:**
- Midjourney v6 reliably renders short slogans but stumbles on multi-line price data.
- Generate the **LAYOUT** in MJ (product photo + composition + general typography).
- Open the result in Figma (1080×1080 frame).
- Composite the literal price text using the brand font stack:
  - **Bricolage Grotesque Bold** for hero numbers
  - **Instrument Sans Bold** for headlines
  - **Work Sans Regular** for body
  - **Geist Mono** for prices, country codes, labels
- For S3 Monochrome use **Playfair Display 900 + Source Serif 4 + JetBrains Mono** instead.
- For S2 Neo-Brutalism use **Space Grotesk Black 900** for all type.
- For S4 Classic use **Cormorant Garamond + Libre Baskerville**.
- For S5 Magazine use **Libre Bodoni + Public Sans**.

**Gemini Imagen 3 is the safer bet for text-heavy posts** — it renders multi-line copy faithfully. Use Gemini for posts 1, 3, 4, 7, 10, 20-26.

**Color discipline reminder:**
- Posts 1-10 + 25 + 26 + 28: Havlo brand palette only (#0F172A · #0057FF · #10B981 etc).
- Posts 11-14 + 17: Neo-Brutalism palette (Cream #FFFDF5 + Hot Red #FF6B6B + Vivid Yellow #FFD93D + #0F172A).
- Posts 20-22 + 24 + 26 + 29: Pure black + white only. No other color.
- Posts 16, 19, 27, 30: Brand blue #0057FF inversion with white type + one Vivid Yellow #FFD93D block accent.

**File naming convention:**
```
havlo-lg-oled-uk.png         (post 01)
havlo-mbp-m4-ae.png          (post 02)
havlo-soundbar-us.png        (post 03)
havlo-omen-uk.png            (post 04)
havlo-rog-us.png             (post 05)
havlo-iphone-ng.png          (post 06)
havlo-victus-ae.png          (post 07)
havlo-hisense-ng.png         (post 08)
havlo-s24-in.png             (post 09)
havlo-ps5-za.png             (post 10)
havlo-closed-tabs.png        (post 11)
havlo-vindication.png        (post 12)
havlo-other-tab.png          (post 13)
havlo-anti-urgency.png       (post 14)
havlo-history.png            (post 15)
havlo-alerts.png             (post 16)
havlo-scan.png               (post 17)
havlo-badge.png              (post 18)
havlo-compare.png            (post 19)
havlo-savings.png            (post 20)
havlo-zero-popups.png        (post 21)
havlo-iphone-spread.png      (post 22)
havlo-founder.png            (post 23)
havlo-median.png             (post 24)
havlo-crossborder.png        (post 25)
havlo-not-on-sale.png        (post 26)
havlo-paste-currys.png       (post 27)
havlo-what-we-dont.png       (post 28)
havlo-recap.png              (post 29)
havlo-second-visit.png       (post 30)
```

No day numbers anywhere.

**Captions** are in `CAPTIONS.md` — strip "DAY XX" labels and use the body text directly.

**Source data** for fresh products (if you want to swap in different SKUs):
`/Users/admin/Havlo/outputs/havlo-instagram/real-data.json` — re-run `_generate-ig-content-data.ts` against the live DB for fresh picks.

---

# WHY THIS PROMPT PACK WORKS

(Receipt for the work.)

The previous pack used a single visual language (Plainspoken Modernism) across 30 posts. That's monotone. The fix:

1. **Style rotation** — 7 distinct visual languages mapped to post intent:
   - Comparisons get Swiss precision.
   - Premium products get Liquid Glass depth.
   - Magazine features get drop caps and asymmetric grids.
   - Psychological hooks get Neo-Brutalist bite.
   - Receipts and founder voice get monochrome editorial gravitas.
   - Energetic moments get Vibrant Block punch.

2. **Data-backed style choices** — each style is sourced from the
   `ui-ux-pro-max` design intelligence database, with the source CSV's
   AI prompt keywords, color palettes, and typography pairings folded
   directly into the prompt. This is not opinion.

3. **Style-to-mood mapping** — psychological hooks (closed tabs,
   vindication) need a visual language that bites; Neo-Brutalism does
   that. Founder voice needs gravitas; Cormorant Garamond does that.
   Closing CTAs need to feel celebratory; Vibrant Block does that.

4. **Sequenced generation order** — render anchors first (the brand-blue
   inversions act as visual punctuation across the feed), then the
   stylistic blocks together (so each block reads coherently when
   scrolled).

5. **Text-overlay specs** are explicit (literal text supplied) so even
   when the engine mis-renders, the Figma composite path is
   trivially fast.

When all 30 are produced, the feed will MOVE — it won't feel like 30
copies of the same idea. Each post will earn its place in the grid.
