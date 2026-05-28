# Havlo — 30 Image-Gen Prompts (Gemini / Midjourney)

A complete prompt pack for a senior art director–quality 30-post Instagram series. Each prompt is paste-and-go for Midjourney v6+ or Gemini Imagen 3 / nano-banana. Real product data baked in. No day-count text on canvas.

**Quick note on text rendering**
- **Gemini Imagen 3 / Imagen-on-AI Studio** renders typography reliably — use it for posts with longer copy (prices, store names, comparisons).
- **Midjourney v6+** renders SHORT slogans well but struggles with multi-line price data — use it for visual-led posts (heroes, illustrations) and composite real text in post-production (Figma, Canva).
- **Recommended workflow:** generate the LAYOUT in either engine, then drop in real prices via overlay if the engine miswrites them.

---

## ★ MASTER BRIEF (paste at the top of every prompt, or save as a custom style)

```
You are a senior award-winning graphic designer with 20+ years
experience at the intersection of editorial design and product marketing.
Your references are Pentagram, Mark Boulton, Frank Chimero, Stefan
Sagmeister's restrained period, Monocle magazine, Bloomberg Businessweek
covers, Apple's first-party marketing under Lee Clow, and Linear's
launch graphics. Your discipline is restraint. Your enemy is decoration.

You are art-directing a 30-post Instagram series for HAVLO, an honest
independent price-comparison platform live in 6 countries:
Nigeria · United Kingdom · United States · India · UAE · South Africa.

VOICE:
- Plain-spoken, direct, founder-led (Danny).
- Receipts over promises. Real numbers from a real catalog.
- No marketing puffery. No urgency tactics. No exclamation marks.
- No em-dashes. No "act now". No "limited time".
- Quiet confidence. The discipline of someone who doesn't have to shout.

BRAND COLORS (use these exact hex codes):
- Off-white background:   #F7F8FA
- Paper warm (receipt):   #FAF8F3
- Ink (primary text):     #0F172A
- Ink 2 (secondary):      #475569
- Ink 3 (whisper):        #94A3B8
- Brand blue (inversions):#0057FF
- Success green (winner): #10B981
- Success bg:             #ECFDF5
- Warn amber:             #CA8A04
- Border hairline:        #E2E8F0

TYPOGRAPHY (or closest equivalents the engine can render):
- Display:  Bricolage Grotesque Bold — tight kerning, geometric
- Headlines:Instrument Sans Bold — clean modern sans
- Body:     Work Sans Regular — humanist sans
- Mono / numbers / receipts: Geist Mono — technical, precise

COMPOSITION RULES:
- 1080×1080 square. Instagram + sponsored ad + WhatsApp preview ready.
- One bold idea per canvas. Read in 2 seconds, reward 30-second study.
- Generous negative space — whitespace as primary structural material.
- 'havlo' wordmark lowercase, small, top-left or bottom-left corner.
- Country code (e.g. "UK", "NG") small monospace top-right or as a chip.
- One green chip per canvas, only for the "winning price".
- One blue inversion is allowed per post but not required.
- No drop shadows. No gradients. No clip art. No emojis. No AI artifacts.
- Hairline borders (#E2E8F0) for structural separation only.
- Everything aligned to an invisible 4px grid.

OUTPUT: Editorial design quality. Master-level craftsmanship. The kind
of work that gets pinned on senior designers' moodboards. Generate the
square at 1080×1080.
```

---

## STYLE SUFFIXES (paste after individual prompt, depending on vibe)

For Midjourney:
```
--ar 1:1 --v 6 --style raw --stylize 100
```

For Gemini Imagen 3:
```
Render at 1080×1080 square. Aspect ratio 1:1. Photorealistic for any
product photography elements. Editorial layout for typography.
```

Vibe modifiers (append to any prompt):
- **Witty/deadpan:** `, deadpan editorial humor in the spirit of Patagonia, MSCHF, or Aesop`
- **Data-heavy:** `, informational design after Edward Tufte and the Financial Times graphics desk`
- **Receipts/anti-marketing:** `, letterpress receipt paper aesthetic, technical typography`
- **Founder voice:** `, hand-set type, single-column editorial, like a Nieman Reports cover`
- **Quiet flex:** `, restrained Bauhaus / Dieter Rams discipline, museum gift-shop print`

---

# THE 30 PROMPTS

## 1. LG 4K OLED Smart TV — UK comparison (vindication)

**Hook:** Same product. £968 difference. Two tabs you'd open anyway.

**Text on canvas:**
> LG 4K OLED Smart TV
> **Appliances Direct  £2,419**
> Very  £3,387
> Save £968

**Prompt:**
> [MASTER BRIEF] Editorial Instagram square for Havlo. Center: a clean,
> floating product photograph of an LG 4K OLED Smart TV against a paper-
> warm off-white background (#FAF8F3). Below the TV, two side-by-side
> price cards in landscape orientation: the LEFT card has a subtle
> green chip ("CHEAPEST") tab attached to its top-left corner, a tiny
> green vertical strip down its left edge, and reads "Appliances Direct
> · £2,419" in Instrument Sans Bold. The RIGHT card reads "Very ·
> £3,387" in a slightly dimmer ink color, no chip. Below both cards,
> centered: "Same product. £968 cheaper at Appliances Direct." in
> Instrument Sans Bold. Top-left corner: small 'havlo' lowercase
> wordmark. Top-right: small monospaced "UK" label in ink-3 color.
> Generous whitespace. Hairline borders. No gradients, no shadows.
> [STYLE SUFFIX --ar 1:1 --v 6 --style raw]

---

## 2. MacBook Pro 16" M4 — UAE (the "two stores, same SKU" tension)

**Text on canvas:**
> MacBook Pro 16" · M4 · 48GB
> **Macpro La  AED 9,099**
> Hitech  AED 11,678
> Save AED 2,579

**Prompt:**
> [MASTER BRIEF] Studio shot of a Space Black 16" MacBook Pro photographed
> from a slightly elevated 3/4 angle, soft directional studio light, on
> a paper-warm off-white background (#FAF8F3). The laptop is the hero.
> Below it, two minimalist price cards: LEFT with a small green
> "CHEAPEST" tab on top, reads "Macpro La · AED 9,099". RIGHT reads
> "Hitech · AED 11,678" in a softer grey. Headline below: "Same machine.
> Two stores. AED 2,579 between them." Top-right corner: "AE" in tiny
> monospace. Bottom-left: 'havlo' wordmark. Negative space dominates.
> No reflections, no marketing gradients. Editorial product photography.
> [--ar 1:1 --v 6 --style raw]

---

## 3. Samsung HW-Q990F Soundbar — US (the surround-sound tease)

**Text on canvas:**
> Samsung HW-Q990F  ·  11.1.4 channel
> **Greentoe  $877**
> Best Buy  $1,498
> Save $621

**Prompt:**
> [MASTER BRIEF] A long, low Samsung HW-Q990F soundbar photographed
> straight-on against an off-white background (#F7F8FA), shallow studio
> shadow, real product photography. Below the soundbar, two price
> chips on a single horizontal line: left chip green-outlined reading
> "Greentoe · $877", right chip neutral reading "Best Buy · $1,498".
> Below the prices in large Instrument Sans Bold: "Volume up. Price
> down." Above the soundbar, a small monospace label: "11.1.4 channels ·
> US ·". Bottom-right corner: 'havlo' wordmark. Compositional rhythm:
> long horizontal, like a Bang & Olufsen catalogue page.
> [--ar 1:1 --v 6 --style raw]

---

## 4. HP Omen 16L Gaming PC — UK (the receipts call-out)

**Text on canvas:**
> HP Omen 16L  ·  same spec, same week
> **Amazon UK  £1,259**
> Currys  £2,096
> Save £837  ·  40% less

**Prompt:**
> [MASTER BRIEF] An HP Omen 16L gaming desktop photographed on an off-
> white #F7F8FA studio cyc, RGB internals visible but understated (no
> rainbow gradients in the photo treatment). The tower sits slightly
> right of center. To the LEFT of the tower: a vertical column of
> typographic information. Top: "RECEIPT N°04" in tiny monospace.
> Middle: "£1,259 · Amazon UK" in green ink, big. Beneath in smaller
> grey: "£2,096 · Currys". Below: a single line: "40% less, same week."
> Bottom-left corner: 'havlo' wordmark. Top-right: "UK" tiny monospace.
> Composition: 60% type / 40% product. Like a Bloomberg Pursuits
> spread. No gaming-marketing tropes.
> [--ar 1:1 --v 6 --style raw]

---

## 5. ASUS ROG G700 Desktop — US (the patient-shopper reward)

**Text on canvas:**
> ASUS ROG G700
> **Best Buy  $1,219**
> Abt  $1,734
> Save $516  ·  Same week, same SKU

**Prompt:**
> [MASTER BRIEF] An ASUS ROG G700 gaming desktop in a clean
> three-quarter view, soft top-down studio light, off-white background
> (#FAF8F3). Beneath: a horizontal receipt strip — like a thin
> supermarket receipt — listing "BEST BUY $1,219" with a small green
> tick, then "ABT $1,734" with a small neutral dot. Headline below in
> Instrument Sans Bold: "Two stores. Same week. $516 between them."
> Tiny monospace footer-right: 'havlo · US'. Aesthetic: editorial
> photography meets receipt typography. No gaming neon, no fake
> urgency banners.
> [--ar 1:1 --v 6 --style raw]

---

## 6. Apple iPhone 14 Pro — NG (the wake-up call)

**Text on canvas:**
> iPhone 14 Pro  ·  128GB
> **Jumia  ₦850,000**
> Kara  ₦1,243,000
> ₦393,000  ·  same phone, two prices

**Prompt:**
> [MASTER BRIEF] A clean studio product shot of a Deep Purple iPhone 14
> Pro on a paper-warm background (#FAF8F3), straight-on, real product
> photography. Below the phone, a horizontal split layout: LEFT half
> green-tinted (#ECFDF5 background) with text "JUMIA · ₦850,000". RIGHT
> half off-white with text "KARA · ₦1,243,000". Beneath both, full
> width: "Same phone, two prices, your choice." in Instrument Sans
> Bold. Top-right corner: small "NG" monospace label. Bottom-left:
> 'havlo' wordmark. Composition feels like a printed catalogue page
> from a Lagos design studio. No naira-symbol gymnastics — let the ₦
> sit naturally.
> [--ar 1:1 --v 6 --style raw]

---

## 7. HP Victus Gaming Laptop — AE (the spec receipt)

**Text on canvas:**
> HP Victus  ·  i7-13620H  ·  RTX 3050
> **Noon  AED 3,038**
> Jumbo  AED 3,923
> Save AED 885

**Prompt:**
> [MASTER BRIEF] An HP Victus 15.6" gaming laptop, lid open ~110°,
> three-quarter top view, paper-warm background (#FAF8F3). Across the
> bottom third of the canvas: a horizontal stripe of monospaced
> typography listing specs as a small dotted line "i7-13620H · RTX
> 3050 · 16 GB · 512 GB SSD". Beneath specs, two price chips: green-
> outlined "Noon · AED 3,038" left; neutral "Jumbo · AED 3,923" right.
> Centered footer line in Instrument Sans Bold: "Same machine. AED
> 885 difference." Bottom corners: 'havlo' wordmark left, 'AE'
> monospace right. Editorial pacing. No gaming-brand swooshes.
> [--ar 1:1 --v 6 --style raw]

---

## 8. Hisense 50" UHD TV — NG (the "your aunty's TV" callback)

**Text on canvas:**
> Hisense 50" UHD  ·  4K
> **Konga  ₦433,400**
> Jumia  ₦696,200
> ₦262,800  ·  38% less

**Prompt:**
> [MASTER BRIEF] A Hisense 50-inch 4K UHD TV photographed straight-on
> against a clean off-white (#F7F8FA) cyc, soft front lighting, real
> product photography (no faked screen content). Below: a clean stacked
> layout — top line "Konga · ₦433,400" in green ink with a tiny green
> dot prefix; second line "Jumia · ₦696,200" in dimmer grey. Below
> both: a single editorial sentence in Instrument Sans Bold: "Two
> stores in Lagos. ₦262,800 between them." Top-right "NG" monospace.
> Bottom-left 'havlo' wordmark. The kind of restraint a Monocle photo
> editor would approve.
> [--ar 1:1 --v 6 --style raw]

---

## 9. Samsung Galaxy S24 (256GB) — India

**Text on canvas:**
> Samsung Galaxy S24  ·  256GB
> **Flipkart  ₹64,999**
> Amazon India  ₹79,900
> Save ₹14,901

**Prompt:**
> [MASTER BRIEF] A studio shot of a Cobalt Violet Samsung Galaxy S24
> photographed flat on a paper-warm surface, slight top-down angle,
> off-white background (#FAF8F3). Below the phone, two horizontal
> chip-style price cards: green-outlined "Flipkart · ₹64,999" left;
> neutral "Amazon India · ₹79,900" right. Underneath: a single line
> "Same phone. Two flagship stores. ₹14,901 in your pocket." Top-right
> monospace "IN". Bottom-left 'havlo' wordmark. Composition: precise,
> calm, like an Apple Stockholm in-store poster.
> [--ar 1:1 --v 6 --style raw]

---

## 10. PlayStation 5 Slim (Disc) — South Africa

**Text on canvas:**
> PS5 Slim  ·  Disc edition
> **Takealot  R 13,499**
> Makro  R 15,999
> Save R 2,500

**Prompt:**
> [MASTER BRIEF] A PlayStation 5 Slim console (white) on its side,
> photographed straight-on against an off-white (#F7F8FA) background,
> understated drop shadow, real product photography. Below the
> console, two minimal price tags: green-bordered "Takealot · R
> 13,499" left; neutral "Makro · R 15,999" right. Beneath: editorial
> sentence "Same console. Two retailers. R 2,500 between them." Top-
> right "ZA" monospace. Bottom-left 'havlo' wordmark. No PS-branded
> rainbow keys overlay — just the device, plainly photographed.
> [--ar 1:1 --v 6 --style raw]

---

## 11. The "tabs you closed" psychological hook

**Text on canvas:**
> You closed 4 tabs.
> We kept 1 open.
> The cheapest one.

**Prompt:**
> [MASTER BRIEF] A minimal editorial Instagram square. Top half: a
> faded-out illustration of four browser tab silhouettes, mostly
> ghosted at low opacity (~20%) in ink-3 grey. ONE tab in the middle
> is fully opaque, outlined in success green (#10B981), with a tiny
> green dot in its top-left. Below the tabs, big Instrument Sans Bold
> headline across three lines: "You closed 4 tabs. We kept 1 open.
> The cheapest one." Generous whitespace below. Bottom-left 'havlo'
> wordmark. Paper-warm background (#FAF8F3). Aesthetic: editorial
> editorial cartoon, like a New Yorker spot illustration but flatter.
> [--ar 1:1 --v 6 --style raw]

---

## 12. The vindication moment

**Text on canvas:**
> You were right.
> The other store was overcharging.

**Prompt:**
> [MASTER BRIEF] A nearly empty Instagram square — almost all
> whitespace. Off-white #F7F8FA background. Centered, in massive
> Bricolage Grotesque Bold, two lines: "You were right." (top line,
> ink #0F172A) / "The other store was overcharging." (second line,
> ink-2 #475569). One tiny green dot at the very start of the first
> line, perfectly aligned. Bottom-left 'havlo' wordmark. Nothing else.
> Composition: 90% silence, 10% statement. The discipline of a Mark
> Boulton typographic spread.
> [--ar 1:1 --v 6 --style raw]

---

## 13. The "what other tabs knew" reveal

**Text on canvas:**
> What the other tab knew.
> What you paid anyway.

**Prompt:**
> [MASTER BRIEF] Editorial split-screen square. Left half: a softly
> blurred rectangle suggesting an obscured webpage with a small green
> price tag visible reading "£89". Right half: a sharp, clear receipt
> stub printed on warm paper reading "£127 paid". Across the bottom,
> in Instrument Sans Bold across two lines: "What the other tab
> knew. What you paid anyway." Tiny "this never has to happen again"
> in monospace below. 'havlo' wordmark bottom-left. Aesthetic:
> Bloomberg Businessweek info-spread meets MSCHF deadpan.
> [--ar 1:1 --v 6 --style raw]

---

## 14. The patient-shopper flex

**Text on canvas:**
> Don't act now.
> Take your time.
> We'll watch the price.

**Prompt:**
> [MASTER BRIEF] A calm, almost meditative editorial square. Paper-
> warm background (#FAF8F3). Center: a single minimalist line-drawing
> illustration of a small green dot tracing along a faint horizontal
> grid, like a price line on a chart, ending in a soft target circle.
> Below: in restrained Instrument Sans Bold across three lines: "Don't
> act now. Take your time. We'll watch the price." Tiny mono caption
> beneath: "Price alerts on havlo.io". 'havlo' wordmark bottom-left.
> Aesthetic: anti-urgency. The deadpan opposite of every retail email.
> [--ar 1:1 --v 6 --style raw]

---

## 15. Feature spotlight — Price history chart

**Text on canvas:**
> Don't just check the price.
> Watch it.

**Prompt:**
> [MASTER BRIEF] Big editorial canvas. Top half: in massive Instrument
> Sans Bold across two lines: "Don't just check the price." (line 1) /
> "Watch it." (line 2, smaller). Bottom half: a curvy line chart
> rendered in success green (#10B981) descending from upper-left to
> lower-right, with a subtle area fill (#ECFDF5) below the curve. The
> last point is a solid green dot. Three small monospaced date labels
> along the bottom axis ("Mar 23", "Apr 12", "May 28"). 'havlo'
> wordmark bottom-left. Tiny right-corner caption: "NEW · price
> history". Aesthetic: Financial Times chart meets Apple keynote
> slide.
> [--ar 1:1 --v 6 --style raw]

---

## 16. Feature spotlight — Price alerts (BLUE INVERSION)

**Text on canvas:**
> Set your number.
> We'll email you when any store hits it.

**Prompt:**
> [MASTER BRIEF] Instagram square fully tiled in brand blue (#0057FF).
> Center-bottom third: a single minimal line-drawn bell icon in white,
> with two concentric white outline circles radiating from it — like
> a quiet siren. Top-left: 'havlo' wordmark in white. Top half:
> massive Instrument Sans Bold white type across two lines: "Set your
> number." / "We'll email you the moment a store hits it." Bottom-
> right corner: tiny monospace "NEW · price alerts". One bold idea,
> blue silence around it. Aesthetic: IBM 1965 print campaign, Ogilvy
> patience.
> [--ar 1:1 --v 6 --style raw]

---

## 17. Feature spotlight — Barcode scanner

**Text on canvas:**
> In a shop?
> Scan it.

**Prompt:**
> [MASTER BRIEF] Off-white background (#F7F8FA). Center of canvas:
> a stylised vertical barcode rendered in ink (#0F172A), with FOUR
> corner-bracket marks around it (like an iPhone camera-AR scan-frame),
> and a thin success-green horizontal scan line crossing its middle.
> Above the barcode in Instrument Sans Bold: "In a shop? Scan it."
> across two lines. Below: tiny monospace "havlo.io/scan". 'havlo'
> wordmark bottom-left. Editorial calm. No phone mockup, no hands —
> just the scan moment.
> [--ar 1:1 --v 6 --style raw]

---

## 18. Feature spotlight — "Lowest in 30 days" badge

**Text on canvas:**
> A badge that earns it.
> Lowest in 30 days.

**Prompt:**
> [MASTER BRIEF] Calm editorial square, off-white #F7F8FA background.
> Center: an oversized pill-shaped chip with #ECFDF5 fill and a
> success-green (#10B981) hairline border, containing the text
> "LOWEST IN 30 DAYS" in success-green Instrument Sans Bold, with a
> tiny green dot prefix. The chip is the hero. Above the chip, smaller
> ink (#0F172A) line: "A badge that earns it." Below the chip, in ink-3
> grey: "Only when the current price genuinely matches the 30-day
> floor across stores." 'havlo' wordmark bottom-left. Aesthetic:
> precision instrument label.
> [--ar 1:1 --v 6 --style raw]

---

## 19. Feature spotlight — Compare across stores (BLUE INVERSION)

**Text on canvas:**
> Paste a link.
> See it cheaper.

**Prompt:**
> [MASTER BRIEF] Full brand-blue (#0057FF) canvas. Center-left: a
> vertical stack of THREE faint white-outlined rectangles labeled in
> white monospace "amazon.co.uk/...", "currys.co.uk/...", "argos.co.uk/
> ...". A single white arrow leads from the stack to a SOLID brighter
> blue rectangle on the right labeled "havlo.io" in white. Top right:
> massive Instrument Sans Bold across two lines in white: "Paste a
> link. See it cheaper." Top-left: 'havlo' wordmark in white. Bottom-
> left tiny monospace: "the original feature". Aesthetic: anti-clutter,
> Bauhaus-meets-Linear.
> [--ar 1:1 --v 6 --style raw]

---

## 20. Receipt-style stat — savings logged this week

**Text on canvas:**
> 12,847
> savings logged this week.

**Prompt:**
> [MASTER BRIEF] Receipt-paper aesthetic. Background: paper-warm
> #FAF8F3 with a SUBTLE paper grain texture (very subtle — feels like
> matte print). Center: massive Bricolage Grotesque Bold number
> "12,847" in success green (#10B981), takes up about a third of the
> canvas. Below in smaller ink (#0F172A): "savings logged this week."
> Below that in ink-3 grey monospace: "across 6 countries · across
> thousands of products". Top-right monospace label: "RECEIPT". Bottom-
> left 'havlo' wordmark. Aesthetic: thermal supermarket receipt
> elevated to museum gift-shop print.
> [--ar 1:1 --v 6 --style raw]

---

## 21. Anti-pattern stat — "0 popups"

**Text on canvas:**
> 0 popups.
> No countdown timers.
> No fake scarcity.

**Prompt:**
> [MASTER BRIEF] Almost-empty editorial square. Off-white #F7F8FA
> background. Center: enormous Bricolage Grotesque Bold "0" in ink
> #0F172A, taking up roughly half the canvas. Beneath in slightly
> smaller Instrument Sans Bold: "popups". Beneath that in ink-3 grey
> across two lines: "No countdown timers. No fake scarcity. No thank
> you." Bottom-left 'havlo' wordmark. Top-right tiny mono: "RECEIPT".
> The discipline of a Hans-Jürgen Burkard photograph: one subject,
> all the room in the world.
> [--ar 1:1 --v 6 --style raw]

---

## 22. The iPhone 14 Pro spread number

**Text on canvas:**
> ₦393,000
> the gap we found between Jumia and Kara
> on the same iPhone 14 Pro this week.

**Prompt:**
> [MASTER BRIEF] Paper-warm background #FAF8F3. Center: massive
> Bricolage Grotesque Bold "₦393,000" in brand blue #0057FF, takes up
> the upper third. Below in Instrument Sans Bold ink-2 across two
> lines: "the gap we found between Jumia and Kara / on the same
> iPhone 14 Pro this week." Below in ink-3 monospace: "Not a
> percentage. A receipt." Bottom-left 'havlo' wordmark. Top-right
> tiny mono "NG". Aesthetic: Bloomberg quarterly cover — the single
> dominant number does all the work.
> [--ar 1:1 --v 6 --style raw]

---

## 23. Founder voice — Danny

**Text on canvas:**
> "Online shopping is messy.
> The same product can vary by
> 30 to 50% between stores.
> We replace five tabs with one."
> — Danny, founder

**Prompt:**
> [MASTER BRIEF] Editorial founder-quote layout. Paper-warm #FAF8F3
> background. Far-upper-left corner: a massive faint ink-3 grey
> opening curly quote mark ", almost a watermark. Center: the four-
> line quote in Instrument Sans Bold ink, with each line breaking
> at a natural cadence. Below the quote, smaller monospace ink-3:
> "— Danny, founder". Top-left 'havlo' wordmark (small). Top-right
> tiny mono "FROM THE FOUNDER". Generous left margin so the quote
> reads like a magazine pull-quote. Aesthetic: Nieman Reports profile
> page.
> [--ar 1:1 --v 6 --style raw]

---

## 24. Honesty receipts — median spread

**Text on canvas:**
> 3.7%
> the median spread across our catalog.
> The interesting items live in the tail.

**Prompt:**
> [MASTER BRIEF] Paper-warm #FAF8F3 background, very subtle paper grain.
> Upper third: enormous Bricolage Grotesque Bold "3.7%" in ink, with a
> tiny green dot prefix. Middle: a small horizontal distribution chart
> — a calm bell curve in ink-3 line stroke, with a single bold green
> dot marking the long-tail position roughly 70% to the right. Bottom
> third: Instrument Sans Bold ink-2 across two lines: "the median
> spread between cheapest and dearest across our catalog. / The
> interesting items live in the tail." Bottom-left 'havlo' wordmark.
> Top-right mono "RECEIPT". Aesthetic: Edward Tufte spread.
> [--ar 1:1 --v 6 --style raw]

---

## 25. How cross-border works

**Text on canvas:**
> Cross-border pricing.
> Cheapest TOTAL wins. Not the cheapest sticker.

**Prompt:**
> [MASTER BRIEF] Editorial diagram square. Off-white #F7F8FA. Upper
> portion: title in Instrument Sans Bold "Cross-border pricing." Below
> the title, a clean horizontal info-flow diagram with hairline grey
> connectors: LEFT chip "Sticker price" / arrow / MIDDLE chip "+ ~30%
> landed (shipping & customs)" / arrow / RIGHT chip "TOTAL · winning
> store" (highlighted in success green). Below the diagram in ink-2:
> "Cheapest TOTAL wins. Not the cheapest sticker." Bottom-left 'havlo'
> wordmark. Aesthetic: Pentagram wayfinding diagram.
> [--ar 1:1 --v 6 --style raw]

---

## 26. Why some products show "0% off"

**Text on canvas:**
> Some things aren't on sale.
> We list them anyway.

**Prompt:**
> [MASTER BRIEF] Almost meditative editorial square. Paper-warm
> #FAF8F3 background. Center: in massive Instrument Sans Bold across
> two lines: "Some things aren't on sale." (line 1 ink) / "We list
> them anyway." (line 2 ink-2). Below, in small ink-3 across two
> lines: "Pharmacies, grocers, and many honest stores don't surface
> a 'compare-at' price. Sometimes the retail price IS the deal."
> Bottom-left 'havlo' wordmark. Quiet typographic confidence.
> [--ar 1:1 --v 6 --style raw]

---

## 27. Try this — paste a Currys URL

**Text on canvas:**
> Try this.
> Paste any Currys URL into havlo.io.

**Prompt:**
> [MASTER BRIEF] Brand blue #0057FF canvas. Center: a single floating
> white-outlined input field shape, deeply minimal, containing a faint
> placeholder "currys.co.uk/products/..." in white-30% monospace. A
> tiny green dot blinks in the input field's left edge. Above the
> field: large Instrument Sans Bold "Try this." in white. Below the
> field: "Paste any Currys URL into havlo.io." in white. Bottom-left:
> 'havlo' wordmark in white. Top-right: tiny mono "TRY". Aesthetic:
> Linear product-launch graphic.
> [--ar 1:1 --v 6 --style raw]

---

## 28. How we work — what we don't do

**Text on canvas:**
> We don't take payment.
> We don't ship goods.
> We don't hold inventory.

**Prompt:**
> [MASTER BRIEF] Paper-warm #FAF8F3 background. Center stack of three
> lines in Instrument Sans Bold ink, each prefixed by a faint hairline
> dash: "— We don't take payment." / "— We don't ship goods." / "— We
> don't hold inventory." Below, in ink-3 grey: "Every transaction is
> between you and the store. We're a discovery layer. That's it."
> Bottom-left 'havlo' wordmark. Top-right mono "HOW IT WORKS".
> Composition: vertical stack, the negative space on either side does
> the editorial work.
> [--ar 1:1 --v 6 --style raw]

---

## 29. The 30-day recap punch

**Text on canvas:**
> Real prices.
> Real stores.
> No staged numbers.

**Prompt:**
> [MASTER BRIEF] Receipt-paper aesthetic on paper-warm #FAF8F3. A
> single thin printed receipt running vertically down the center of
> the canvas, slightly offset, containing the lines (in printed-mono
> typography simulating a thermal print): "Real prices." / "Real
> stores." / "No staged numbers." / a thin horizontal print divider /
> "Sourced from the live catalog." / "Thank you for reading the
> receipts." Beneath the receipt, small ink-3 mono: "havlo.io". Top-
> left 'havlo' wordmark. Aesthetic: a museum-mounted supermarket
> receipt elevated to art piece.
> [--ar 1:1 --v 6 --style raw]

---

## 30. Closing — the second visit

**Text on canvas:**
> Try one product.
> See if we earn your second visit.

**Prompt:**
> [MASTER BRIEF] Brand blue (#0057FF) canvas, fully inverted. Top
> half: in massive Instrument Sans Bold white type across two lines:
> "Try one product. / See if we earn your second visit." Bottom half:
> centered, a single thin white horizontal underline (~30% of canvas
> width), with the word "havlo.io" in white Instrument Sans Bold
> floating above it. Top-left: 'havlo' wordmark in white. The single
> editorial moment: the underline isn't decorative, it IS the click
> target. Aesthetic: Stefan Sagmeister letterpress poster.
> [--ar 1:1 --v 6 --style raw]

---

# WORKFLOW NOTES

**Recommended generation order:**
1. Start with posts 16, 19, 30 (blue inversions) — anchor the visual rhythm.
2. Then posts 11, 12, 21, 26 (typographic-only, low complexity).
3. Then 1-10 (product comparisons, highest reuse from real images).
4. Then 13-15, 17-18, 22-25, 27-29 (mixed).

**If Midjourney mis-renders prices/text:**
- Generate the LAYOUT (composition + product photo + general typography)
- Open the output in Figma or Canva (1080×1080 frame)
- Overlay the literal price text in Instrument Sans Bold using the brand colors
- This is faster than re-rolling and gives you exact prices.

**If Gemini Imagen 3 renders text faithfully:**
- Use Gemini for ALL 30 (it's stronger at text than MJ).
- Iterate the prompt by saying "regenerate but make the price '£2,419' larger".

**File naming convention (for export):**
- `havlo-01-lg-oled-uk.png`
- `havlo-02-macbook-ae.png`
- ... etc, no day numbers in either the file name OR the canvas itself.

**Captions for each post** are already in `CAPTIONS.md` (same folder) — strip the "DAY XX" labels and use the body text directly.

---

# REAL DATA INDEX (for prompt customization)

If you swap in fresh products from the catalog, here's the source structure:

```
{
  product: "Product Title (short)",
  country: "UK | US | NG | AE | IN | ZA",
  cheap:   { store: "Store Name", price: "£X,XXX" },
  dear:    { store: "Store Name", price: "£X,XXX" },
  saving:  "£XXX",
  saving_pct: 29
}
```

Pull fresh ones from `/Users/admin/Havlo/outputs/havlo-instagram/real-data.json`
or re-run `_generate-ig-content-data.ts` against the live DB.
