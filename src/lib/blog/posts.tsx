/* Blog post registry. One place to add new posts.

   Why a flat registry instead of MDX or filesystem-scanning: keeps
   the scaffold simple and dep-free. Each post is a TSX object with
   metadata + JSX body; add a new entry here and it shows up in the
   /blog index, gets a slug page, and is included in the sitemap
   automatically.

   When the post volume grows (around 20+ posts) and authoring
   becomes the bottleneck, migrate to @next/mdx or to a CMS
   (Contentlayer, Notion API, Sanity). For now this is the cheapest
   workable path that lets us start the SEO content engine
   immediately.

   Authoring rules:
     1. Add an entry below with slug, title, description,
        publishedAt (ISO date), and body (JSX)
     2. Use semantic HTML: h2 for sections, p for paragraphs,
        ul / li for lists, strong for emphasis
     3. Affiliate links inside posts go through /api/go like any
        other outbound link so they pick up the right tag
     4. Open Graph metadata is auto-generated from title +
        description in /blog/[slug]/page.tsx, no extra work
     5. NO em-dashes anywhere (visible content or descriptions).
        They read as AI-generated. Use periods, commas, colons,
        or restructure the sentence instead.
*/

import type { ReactNode } from "react";

export interface BlogPost {
  slug:        string;
  title:       string;
  description: string;
  /** ISO date. Drives sort order on /blog index + sitemap lastmod. */
  publishedAt: string;
  /** Reading time estimate, shown next to date. Manually set for
      now; could compute from word count later. */
  readMinutes: number;
  /** Optional categorization for future /blog?category=X views. */
  tags?:       string[];
  body:        ReactNode;
}

export const posts: BlogPost[] = [
  {
    slug:        "best-iphone-15-pro-max-deals-nigeria-2026",
    title:       "Best iPhone 15 Pro Max Deals in Nigeria 2026",
    description: "Where to actually find the cheapest iPhone 15 Pro Max in Nigeria right now. Current prices across Jumia, Konga, Slot, and 3C Hub, plus which cross-border options beat them.",
    publishedAt: "2026-05-05",
    readMinutes: 4,
    tags:        ["phones", "nigeria", "buying-guide"],
    body: (
      <>
        <p>
          The iPhone 15 Pro Max is still the most-searched phone on Havlo a
          full eighteen months after launch. With local pricing across
          Nigerian retailers ranging from{" "}
          <strong>₦1.45M to ₦2.1M</strong> for the same configuration,
          knowing where to look saves real money.
        </p>
        <p>
          We pulled the current listings from every major Nigerian retailer
          covering iPhones plus the cross-border options Nigerians actually
          use. Here&apos;s where the actual best prices live this week.
        </p>

        <h2>Local Nigerian retailers</h2>
        <p>
          Local retailers ship faster and handle warranty service in country.
          For most buyers, this is the cheaper total cost once import duties
          and shipping risk are factored in.
        </p>
        <ul>
          <li>
            <strong>Slot</strong> consistently has the sharpest pricing on
            current-gen iPhones in Nigeria. Their authorized-reseller status
            with Apple gives them better margin to play with than smaller
            shops, and they pass savings down on flagship models.
          </li>
          <li>
            <strong>3C Hub</strong> typically matches Slot within ₦20-50k and
            occasionally beats them on flash sales. Worth checking both before
            committing.
          </li>
          <li>
            <strong>Jumia and Konga</strong> have the widest selection
            including refurbished + foreign-used variants at lower price
            points. Read the listing carefully for grade descriptions.
          </li>
          <li>
            <strong>Kara</strong> often runs aggressive promotions on
            specific configurations (256GB Natural Titanium especially).
          </li>
        </ul>

        <h2>Cross-border options worth considering</h2>
        <p>
          For buyers comfortable with 2-4 week shipping windows and willing
          to handle import duties, cross-border can save ₦150-300k on a
          single phone. Two options dominate.
        </p>
        <ul>
          <li>
            <strong>Amazon US</strong> with a forwarding service gets you
            to the lowest delivered price for sealed retail units. Add 15%
            for typical Lagos customs duty plus around $30 forwarding fee.
          </li>
          <li>
            <strong>AliExpress global plaza sellers</strong> offer
            competitive pricing on grey-market sealed units, but warranty
            service is on the seller, not Apple Nigeria.
          </li>
        </ul>

        <h2>The honest tradeoff</h2>
        <p>
          Local at Slot or 3C Hub: roughly ₦150-200k more, but you get
          Apple-Nigeria warranty plus immediate hands-on inspection.
          Cross-border: cheapest delivered price, but you wait weeks and
          warranty is on you.
        </p>
        <p>
          For a flagship phone you&apos;ll keep for 3+ years, the ₦150k
          warranty premium is usually worth it. For a second device or a
          gift, cross-border is fine.
        </p>

        <h2>How we update this</h2>
        <p>
          Havlo refreshes prices across all the retailers above every
          24 hours. The article reflects current pricing logic and where the
          deals consistently sit; for live current numbers, search any
          iPhone 15 model on the home page and you&apos;ll see real-time
          comparisons.
        </p>
      </>
    ),
  },

  {
    slug:        "macbook-air-m3-nigeria-buying-guide-2026",
    title:       "MacBook Air M3 in Nigeria 2026: Real Prices and Where to Buy",
    description: "What the MacBook Air M3 actually costs in Nigeria today. Slot, 3C Hub, Konga, Jumia compared with Amazon US cross-border, plus the configuration tradeoff that saves you ₦200k.",
    publishedAt: "2026-05-06",
    readMinutes: 5,
    tags:        ["computing", "nigeria", "buying-guide"],
    body: (
      <>
        <p>
          The MacBook Air M3 13&quot; is the most-recommended laptop on Havlo
          for non-gaming buyers. Eighteen hours of real-world battery, fanless
          silent operation, and genuinely premium build at a price point that
          undercuts the Pro line by about ₦300k for buyers who don&apos;t need
          ProMotion.
        </p>
        <p>
          Pricing in Nigeria swings widely depending on the configuration and
          where you buy. Here&apos;s the actual landscape this week.
        </p>

        <h2>Local Nigerian retailers</h2>
        <p>
          Apple-authorized resellers always have the most consistent stock,
          but smaller shops occasionally win on price for specific
          configurations.
        </p>
        <ul>
          <li>
            <strong>Slot</strong> is the most reliable for current-gen
            MacBooks in Lagos. Stock is consistent, prices update with
            Apple&apos;s global moves, and warranty service runs through Apple
            Nigeria.
          </li>
          <li>
            <strong>3C Hub</strong> typically matches Slot on the base
            8GB/256GB SKU and occasionally undercuts by ₦30-50k on
            promotions.
          </li>
          <li>
            <strong>Konga and Jumia</strong> aggregate listings from third
            party sellers. The price range here is wider, sometimes dramatically
            cheaper, but verify the seller rating and warranty terms before
            committing.
          </li>
          <li>
            <strong>Pointek</strong> has been competitive on the 16GB/512GB
            configuration specifically, which is the sweet spot for most
            buyers.
          </li>
        </ul>

        <h2>The configuration tradeoff that saves you ₦200k</h2>
        <p>
          Apple charges aggressively for upgrades. The base 8GB/256GB model
          is around ₦950k locally; bumping to 16GB/512GB pushes you to
          ₦1.4M+.
        </p>
        <p>
          The 8GB model is fine for browser, email, and light productivity.
          For video editing, music production, or any sustained creative work,
          the 16GB upgrade is non-negotiable. The 256GB storage fills up fast;
          512GB is the realistic floor for a multi-year machine.
        </p>
        <p>
          Save the upgrade money by buying the 16GB/512GB through cross-border
          if you can wait. Difference is often ₦200-280k for the same SKU.
        </p>

        <h2>Cross-border math</h2>
        <p>
          The MacBook Air M3 16GB/512GB lands around $1,300 on Amazon US.
          With shipping and Lagos customs duty (15-20% typical for laptops),
          the total delivered cost runs ₦1.15-1.25M. That&apos;s ₦150-250k
          below the same SKU at Slot.
        </p>
        <p>
          The catch: warranty service. Apple International Warranty technically
          covers the device anywhere Apple operates, but in practice service
          requests for US-purchased units from Nigeria can hit friction. If
          warranty matters to you, pay the local premium.
        </p>

        <h2>What about the M2 Air at lower prices?</h2>
        <p>
          The M2 Air is still selling at every Nigerian retailer, usually
          ₦150-250k below the M3 equivalent. For light use, the M2 is more
          than enough laptop and the savings are real.
        </p>
        <p>
          The M3 advantages are around 15-20% faster for sustained workloads
          and slightly better display calibration. Worth the premium for
          creative professionals; not worth it for general productivity.
        </p>

        <h2>How we update this</h2>
        <p>
          Havlo&apos;s pricing data refreshes daily across all the retailers
          above. For live current pricing on any specific MacBook
          configuration, search the model on the home page or browse the
          Computing category.
        </p>
      </>
    ),
  },

  {
    slug:        "playstation-5-slim-nigeria-2026",
    title:       "PlayStation 5 Slim in Nigeria 2026: Where to Find the Best Price",
    description: "PS5 Slim pricing across Nigeria&apos;s main retailers, plus the verification checklist to follow before paying so you don&apos;t end up with a counterfeit or grey-market unit.",
    publishedAt: "2026-05-06",
    readMinutes: 5,
    tags:        ["gaming", "nigeria", "buying-guide"],
    body: (
      <>
        <p>
          The PlayStation 5 Slim has been the easier console to find since
          its late-2023 launch. Local Nigerian pricing settled into a stable
          range around <strong>₦650-820k</strong> for the disc edition.
          Anything below that range deserves close inspection; anything
          above is a markup most buyers shouldn&apos;t accept.
        </p>
        <p>
          Here&apos;s where the legitimate stock actually lives, and the
          verification checklist that protects you from the counterfeits and
          grey-market resellers that flood Lagos console listings.
        </p>

        <h2>The legitimate retailers</h2>
        <ul>
          <li>
            <strong>Slot</strong> stocks Sony Nigeria-distributed PS5 units
            with regional warranty. Slightly higher price (around ₦720-790k
            for disc) but the cleanest path if anything goes wrong.
          </li>
          <li>
            <strong>3C Hub</strong> typically prices ₦40-70k below Slot on
            the same SKU. Still legitimate stock, just slimmer margin.
          </li>
          <li>
            <strong>Konga and Jumia</strong> aggregate sellers. Some are
            reliable established gaming shops; others are sketchy. Filter
            ruthlessly by seller rating and look for verified-seller badges.
          </li>
          <li>
            <strong>ShopInverse and Pointek</strong> occasionally have
            competitive pricing on PS5 bundles (console plus extra
            controller plus 2 games) that beat individual purchases.
          </li>
        </ul>

        <h2>Cross-border options</h2>
        <p>
          For PS5 specifically, cross-border savings are smaller than on
          Apple products because Sony prices regionally. The base US price
          ($499) lands around ₦680-750k delivered to Lagos with shipping
          and duty, which is competitive with local stock but the warranty
          tradeoff usually isn&apos;t worth it for a console.
        </p>
        <p>
          Where cross-border makes sense: bundles. Amazon US runs holiday
          PS5 bundles (console plus 2 first-party games plus extra
          controller) for around $549. The bundle math beats buying each
          piece separately in Nigeria by ₦80-120k.
        </p>

        <h2>The verification checklist before you pay</h2>
        <p>
          PS5 counterfeits are rare but PS5-with-fake-warranty-claims and
          grey-market refurbs sold as new are common. Before committing:
        </p>
        <ul>
          <li>
            <strong>Confirm seal and packaging.</strong> Genuine PS5 boxes
            ship factory-sealed with intact tape. Any peeled or re-applied
            tape is a red flag.
          </li>
          <li>
            <strong>Verify the serial number on the console matches the
            box.</strong> Mismatched serials mean the unit was opened,
            possibly swapped, or refurbished.
          </li>
          <li>
            <strong>Test before leaving the shop.</strong> Plug into HDMI,
            boot to home screen, sign into a test PSN account, run a
            10-minute gameplay test. Disc readers especially fail
            silently on returned-then-resold units.
          </li>
          <li>
            <strong>Insist on the original receipt for warranty
            registration.</strong> Sony&apos;s warranty starts from
            first-purchase date, not your purchase date. A unit sold to you
            new but originally bought 14 months ago has 10 months left on
            warranty, not 24.
          </li>
        </ul>

        <h2>Disc edition vs digital edition</h2>
        <p>
          The disc edition is around ₦80-120k more than digital in Nigeria.
          For most buyers the disc edition is worth it: physical games are
          significantly cheaper used, you can resell or trade, and
          PlayStation Plus discounts on digital games erode quickly when
          they&apos;re full price.
        </p>
        <p>
          Digital edition makes sense if you only play first-party games
          and want to subscribe to PS Plus Extra for the catalog. Otherwise
          the disc edition pays for itself in the first 3-4 games.
        </p>

        <h2>How we update this</h2>
        <p>
          Havlo&apos;s data refreshes daily across all the retailers
          above. For current PS5 pricing across every Nigerian retailer
          plus cross-border options, search on the home page or browse the
          Gaming category.
        </p>
      </>
    ),
  },

  {
    slug:        "airpods-pro-2-nigeria-price-comparison-2026",
    title:       "AirPods Pro 2 in Nigeria 2026: Real Price Comparison Across Stores",
    description: "What AirPods Pro 2 actually costs in Lagos right now across Slot, 3C Hub, Konga, and Amazon cross-border. Plus how to spot the counterfeits that flood Lagos markets.",
    publishedAt: "2026-05-06",
    readMinutes: 4,
    tags:        ["audio", "nigeria", "buying-guide"],
    body: (
      <>
        <p>
          AirPods Pro 2 are the most counterfeited Apple product in Nigeria
          by a wide margin. Walk through any Computer Village stall and
          you&apos;ll find &quot;AirPods Pro 2&quot; for ₦25k that look
          identical to the ₦190k authentic units at Slot. This guide is
          mostly about not buying the fakes.
        </p>
        <p>
          Genuine AirPods Pro 2 with USB-C land in Nigeria at around
          <strong> ₦185-220k</strong> across legitimate retailers. Below
          that range, the unit is almost certainly counterfeit or
          grey-market with broken Find My / firmware update support.
        </p>

        <h2>Where to buy genuine units</h2>
        <ul>
          <li>
            <strong>Slot</strong> sells Apple Nigeria-distributed AirPods
            with full warranty. Around ₦210-220k. Cleanest path.
          </li>
          <li>
            <strong>3C Hub</strong> typically prices ₦15-25k below Slot
            (around ₦190-200k) on the same SKU. Still genuine stock.
          </li>
          <li>
            <strong>Konga (verified seller listings only)</strong>: filter
            for shops with high ratings and at least 100+ sales. Avoid
            anything from new sellers regardless of how good the price
            looks.
          </li>
          <li>
            <strong>iStore Nigeria</strong> for the most cautious buyers.
            Apple-premium-reseller status, real warranty, but priced at the
            top of the range.
          </li>
        </ul>

        <h2>How to spot counterfeit AirPods Pro 2</h2>
        <p>
          Counterfeits have improved dramatically. Visual inspection alone
          isn&apos;t enough anymore. The reliable tests:
        </p>
        <ul>
          <li>
            <strong>Pair with iPhone and check the Settings page.</strong>{" "}
            Genuine units show as &quot;AirPods Pro&quot; with battery
            percentages for left, right, and case. Fakes either fail to
            connect cleanly, show as a generic Bluetooth device, or display
            wrong model names.
          </li>
          <li>
            <strong>Verify the serial number at checkcoverage.apple.com</strong>
            (or settings.apple.com/serial). Genuine serials return a valid
            warranty result; counterfeit serials return &quot;not found&quot;
            or match a different product.
          </li>
          <li>
            <strong>Test active noise cancellation in a noisy
            environment.</strong> Counterfeits either have no real ANC or a
            very weak version. Genuine ANC dramatically reduces ambient
            noise the moment it engages.
          </li>
          <li>
            <strong>Check firmware version.</strong> Genuine AirPods receive
            and apply Apple firmware updates over time. Counterfeits show
            either no firmware version or implausibly old ones.
          </li>
        </ul>

        <h2>Cross-border math</h2>
        <p>
          Amazon US has AirPods Pro 2 at $199 sealed retail. Delivered to
          Lagos with shipping and customs (audio products usually 10-15%
          duty), the total runs around ₦155-175k. That&apos;s ₦20-50k below
          even 3C Hub&apos;s pricing.
        </p>
        <p>
          For AirPods specifically, cross-border is a strong play because
          warranty service for AirPods is rarely needed in the first 12
          months. The savings are real and the risk is low.
        </p>

        <h2>Should you wait for AirPods Pro 3?</h2>
        <p>
          Apple typically refreshes AirPods Pro on a roughly 3-year cycle.
          The Pro 2 launched in 2022; the Pro 3 with H3 chip is rumored for
          late 2026. If you&apos;re willing to wait 6+ months, prices on the
          Pro 2 will likely drop another ₦20-30k as the Pro 3 launches.
        </p>
        <p>
          If you want them now, the Pro 2 is still excellent and will
          continue receiving Apple firmware updates for at least 4 more
          years. No reason to delay if you have an immediate need.
        </p>

        <h2>How we update this</h2>
        <p>
          Havlo refreshes AirPods pricing across all retailers above daily.
          For current real-time prices, search AirPods Pro 2 on the home
          page or browse the Audio category.
        </p>
      </>
    ),
  },

  {
    slug:        "samsung-galaxy-s24-ultra-nigeria-buying-guide-2026",
    title:       "Samsung Galaxy S24 Ultra Nigeria: Where to Buy + What to Pay 2026",
    description: "The Galaxy S24 Ultra has held its price unusually well in Nigeria. Here is where to find it cheapest across local and cross-border, plus whether the S25 Ultra arrival is worth waiting for.",
    publishedAt: "2026-05-06",
    readMinutes: 5,
    tags:        ["phones", "nigeria", "buying-guide"],
    body: (
      <>
        <p>
          The Galaxy S24 Ultra is the most-recommended Android flagship on
          Havlo for buyers who want a real iPhone alternative. The 200MP
          camera is the best telephoto in any phone, the S Pen is uniquely
          useful for note-takers, and the build quality matches anything
          Apple ships.
        </p>
        <p>
          Pricing in Nigeria has been unusually sticky compared to other
          Samsung flagships. Most S-series phones drop 25-30% in their
          second year; the S24 Ultra has only fallen about 12% since
          launch. Here&apos;s where to find it cheapest right now.
        </p>

        <h2>Local Nigerian retailers</h2>
        <ul>
          <li>
            <strong>Slot</strong> stocks Samsung Nigeria-distributed units
            with full regional warranty. Around ₦1.45-1.55M for the
            256GB Titanium Black. Highest-confidence purchase in the
            country.
          </li>
          <li>
            <strong>3C Hub</strong> typically lists ₦50-100k below Slot on
            the same SKU. Still genuine stock with Samsung warranty.
          </li>
          <li>
            <strong>Konga and Jumia</strong> have the widest variant
            selection including foreign-used and refurbished at lower price
            points. Read seller details carefully; some listings are
            grey-market US/EU units that lack Samsung Nigeria warranty
            support.
          </li>
          <li>
            <strong>Pointek</strong> has been aggressive on the 512GB
            configuration recently, occasionally undercutting Slot by
            ₦80-150k.
          </li>
        </ul>

        <h2>Snapdragon vs Exynos: a Nigeria-specific note</h2>
        <p>
          Samsung sells Galaxy S phones in two chipset variants globally.
          North America gets Qualcomm Snapdragon; most of Europe and parts
          of Asia get Samsung Exynos. The S24 Ultra is unusual: every
          region got the Snapdragon 8 Gen 3, no Exynos variant exists.
        </p>
        <p>
          This means buying cross-border doesn&apos;t cost you anything on
          the chipset front. The unit shipped in any region runs the same
          chip with the same performance.
        </p>

        <h2>Cross-border math</h2>
        <p>
          Amazon US lists the Galaxy S24 Ultra 256GB at around $1,099
          unlocked. With shipping and Lagos customs (typically 15% for
          phones), total delivered cost runs around ₦1.20-1.30M. That&apos;s
          ₦150-300k below the same SKU at Slot.
        </p>
        <p>
          For a phone you&apos;ll keep 3-4 years, that savings is meaningful.
          The tradeoff is warranty service: Samsung&apos;s international
          warranty officially covers the device anywhere Samsung operates,
          but in practice Samsung Nigeria service centers have been known to
          require proof of local purchase before honoring claims. If
          warranty matters, pay the local premium.
        </p>

        <h2>Should you wait for the S25 Ultra?</h2>
        <p>
          The S25 Ultra launched in early 2025 with incremental upgrades:
          slightly better night photography, improved AI features, marginal
          battery gains. The S24 Ultra remains 90% of the phone for
          ₦300-450k less.
        </p>
        <p>
          Worth waiting for the S25 Ultra: heavy AI feature users, anyone
          who plans to keep the phone 4+ years. Skip the wait: pretty much
          everyone else. The S24 Ultra is still the better value.
        </p>

        <h2>How we update this</h2>
        <p>
          Havlo&apos;s pricing data refreshes daily across all retailers
          above. For current real-time pricing on any Galaxy S24 Ultra
          configuration, search the model on the home page or browse the
          Phones category.
        </p>
      </>
    ),
  },
];

/** Lookup helper for the dynamic [slug] route. */
export function getPostBySlug(slug: string): BlogPost | undefined {
  return posts.find((p) => p.slug === slug);
}

/** Slug list for generateStaticParams. */
export function getAllSlugs(): string[] {
  return posts.map((p) => p.slug);
}

/** Sort by date desc. Used by /blog index. */
export function getPostsByDate(): BlogPost[] {
  return [...posts].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}
