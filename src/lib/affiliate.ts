/* ──────────────────────────────────────────────────────────────────
   Outbound-link affiliate wrapping.

   Single chokepoint: wrapWithAffiliate(url, country) is called from
   /api/go right before the 302 redirect. Returns the URL with the
   right affiliate tag appended for whichever merchant + region the
   URL points at, or the URL unchanged when no rule matches.

   Each rule:
     - matches an outbound URL by hostname pattern
     - looks up the affiliate ID from process.env (per region when
       relevant — Amazon needs a separate tag per marketplace)
     - returns the URL with the network's expected query parameter

   Activation pattern: the rule is "live" only when its env var is
   set. Unset env = the rule no-ops, URL passes through unchanged.
   That means we can register Amazon, Konga, Jumia, AliExpress, etc.
   here right now and each one lights up the moment its env var is
   populated — no code change needed when an affiliate approval lands.
   ────────────────────────────────────────────────────────────────── */

interface WrapContext {
  /** Country code from the user's preference (lowercase ISO 3166-1) */
  country: string;
}

interface AffiliateRule {
  /** Human label for logs / debugging */
  name: string;
  /** True if the rule applies to this outbound URL */
  match: (host: string) => boolean;
  /** Returns the wrapped URL or null when no tag is configured */
  wrap:  (url: URL, ctx: WrapContext) => URL | null;
}

/* ── Helpers ──────────────────────────────────────────────────────── */

function envOrNull(name: string): string | null {
  const v = process.env[name]?.trim();
  return v || null;
}

function setParam(u: URL, key: string, value: string): URL {
  /* Don't clobber an existing tag if one's already on the URL — some
     deep links carry their own attribution we shouldn't override. */
  if (u.searchParams.has(key)) return u;
  u.searchParams.set(key, value);
  return u;
}

/* ── Rules registry ──────────────────────────────────────────────── */

/* Amazon — per-region Associates tags. Marketplace (.com / .co.uk /
   .de / .ae / .in) determines the tag, NOT the user's country
   preference. Reason: the affiliate program is keyed to the
   destination marketplace; a Nigerian user clicking through to
   amazon.com still uses our US tag (the program operates by
   marketplace, not buyer location). */
const AMAZON_HOST_TO_ENV: Array<[RegExp, string]> = [
  [/(^|\.)amazon\.com$/i,       "AMAZON_ASSOC_TAG_US"],
  [/(^|\.)amazon\.co\.uk$/i,    "AMAZON_ASSOC_TAG_UK"],
  [/(^|\.)amazon\.de$/i,        "AMAZON_ASSOC_TAG_DE"],
  [/(^|\.)amazon\.fr$/i,        "AMAZON_ASSOC_TAG_FR"],
  [/(^|\.)amazon\.it$/i,        "AMAZON_ASSOC_TAG_IT"],
  [/(^|\.)amazon\.es$/i,        "AMAZON_ASSOC_TAG_ES"],
  [/(^|\.)amazon\.ca$/i,        "AMAZON_ASSOC_TAG_CA"],
  [/(^|\.)amazon\.com\.au$/i,   "AMAZON_ASSOC_TAG_AU"],
  [/(^|\.)amazon\.ae$/i,        "AMAZON_ASSOC_TAG_AE"],
  [/(^|\.)amazon\.sa$/i,        "AMAZON_ASSOC_TAG_SA"],
  [/(^|\.)amazon\.in$/i,        "AMAZON_ASSOC_TAG_IN"],
  [/(^|\.)amazon\.com\.mx$/i,   "AMAZON_ASSOC_TAG_MX"],
  [/(^|\.)amazon\.com\.br$/i,   "AMAZON_ASSOC_TAG_BR"],
  [/(^|\.)amazon\.co\.za$/i,    "AMAZON_ASSOC_TAG_ZA"],
  [/(^|\.)amazon\.co\.jp$/i,    "AMAZON_ASSOC_TAG_JP"],
  [/(^|\.)amazon\.sg$/i,        "AMAZON_ASSOC_TAG_SG"],
];

/* eBay EPN rotation ids are PER MARKETPLACE (publicly visible in every
   EPN link; not secrets). Only marketplaces we're enrolled for are
   listed — others pass through untagged. */
const EBAY_MARKETPLACES: Array<[RegExp, { mkrid: string; siteid: string }]> = [
  [/(^|\.)ebay\.com$/i,    { mkrid: "711-53200-19255-0", siteid: "0" }],
  [/(^|\.)ebay\.co\.uk$/i, { mkrid: "710-53481-19255-0", siteid: "3" }],
];

/* Awin merchant lookup: hostname (lowercase, no leading "www.") -> Awin
   merchant ID. Populated from AWIN_MERCHANT_IDS env var, a comma-
   separated list of "host=mid" pairs ("zonky.uk=12345,morishsnacks.co.uk
   =23456"). Parsed once at module load so the hot wrap() path stays a
   plain Map.get. Empty / unset env = empty map = Awin rule no-ops. */
const AWIN_PUBLISHER_ID = process.env.AWIN_PUBLISHER_ID?.trim() || "";
const AWIN_MERCHANTS: Map<string, string> = (() => {
  const out = new Map<string, string>();
  const raw = process.env.AWIN_MERCHANT_IDS?.trim() ?? "";
  if (!raw) return out;
  for (const pair of raw.split(",")) {
    const [host, mid] = pair.split("=").map((s) => s?.trim());
    if (host && mid && /^\d+$/.test(mid)) out.set(host.toLowerCase(), mid);
  }
  return out;
})();
function stripWww(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

const RULES: AffiliateRule[] = [
  /* ── Amazon Associates (per marketplace) ── */
  {
    name: "amazon",
    match: (host) => AMAZON_HOST_TO_ENV.some(([re]) => re.test(host)),
    wrap: (u) => {
      const entry = AMAZON_HOST_TO_ENV.find(([re]) => re.test(u.host));
      if (!entry) return null;
      const tag = envOrNull(entry[1]);
      if (!tag) return null;
      return setParam(u, "tag", tag);
    },
  },

  /* ── Konga (NG) — gated on KONGA_AFFILIATE_KEY ──
     TODO(konga-approval): confirm parameter name from the affiliate
     docs once approval lands; placeholder is `subId`. */
  {
    name: "konga",
    match: (host) => /(^|\.)konga\.com$/i.test(host),
    wrap: (u) => {
      const id = envOrNull("KONGA_AFFILIATE_KEY");
      if (!id) return null;
      return setParam(u, "subId", id);
    },
  },

  /* ── Jumia (NG) — TradeTracker-style affiliate links ──
     Jumia's affiliate program issues a publisher ID; outbound URLs
     get wrapped with `?utm_source=havlo&utm_medium=affiliate&aff=ID`. */
  {
    name: "jumia",
    match: (host) => /(^|\.)jumia\.(com\.ng|com|co\.ke)$/i.test(host),
    wrap: (u) => {
      const id = envOrNull("JUMIA_AFFILIATE_KEY");
      if (!id) return null;
      setParam(u, "utm_source", "havlo");
      setParam(u, "utm_medium", "affiliate");
      return setParam(u, "aff", id);
    },
  },

  /* ── AliExpress Affiliate Portal ──
     Note: AliExpress's clean API URL → affiliate URL conversion needs
     a server-side call to their portal API. This rule appends the
     fallback `aff_short_key` param which works for direct deep-links
     from the portal. Full API conversion can be wired later when
     volume justifies the integration overhead. */
  {
    name: "aliexpress",
    match: (host) => /(^|\.)aliexpress\.(com|us)$/i.test(host),
    wrap: (u) => {
      const id = envOrNull("ALIEXPRESS_AFFILIATE_KEY");
      if (!id) return null;
      return setParam(u, "aff_short_key", id);
    },
  },

  /* ── eBay Partner Network (approved June 2026, campaign 5339156340) ──
     Marketplace-keyed: each eBay domain has its OWN rotation id (mkrid)
     and siteid — using the US pair on a .co.uk link misattributes the
     click. Full param set per EPN's link spec: mkcid=1 (affiliate
     channel), mkrid + siteid (marketplace), campid (our campaign),
     toolid=10001 (link generator), mkevt=1 (click event). URLs that
     already carry a query string (eBay item/search URLs always do) are
     joined with `&` automatically by URL.searchParams. Marketplaces we
     have no rotation id for (.de, .com.au, …) pass through UNTAGGED
     rather than guessing — a wrong mkrid is worse than no tag. */
  {
    name: "ebay",
    match: (host) => EBAY_MARKETPLACES.some(([re]) => re.test(host)),
    wrap: (u) => {
      const entry = EBAY_MARKETPLACES.find(([re]) => re.test(u.host));
      if (!entry) return null;
      const campid = envOrNull("EBAY_PARTNER_CAMPAIGN_ID") ?? "5339156340";
      setParam(u, "mkcid", "1");
      setParam(u, "mkrid", entry[1].mkrid);
      setParam(u, "siteid", entry[1].siteid);
      setParam(u, "campid", campid);
      setParam(u, "toolid", "10001");
      return setParam(u, "mkevt", "1");
    },
  },

  /* ── Awin (UK aggregator, hundreds of merchants) ──
     Awin's pattern: redirect through their tracking domain rather
     than appending a tag. URL becomes:
       https://www.awin1.com/cread.php?awinmid=MERCHANT&awinaffid=YOURID&p=ENCODED_DEST
     Activated only when AWIN_PUBLISHER_ID is set + we have a merchant
     ID for the destination host. AWIN_MERCHANT_IDS is a comma-separated
     list of "host=mid" pairs (e.g. "zonky.uk=12345,morishsnacks.co.uk=23456");
     parsed once at startup. Each merchant ID comes from the Awin
     dashboard ("Programmes" -> the approved merchant -> Advertiser ID).
     June 2026: wiring up the first 5 approved merchants. */
  {
    name: "awin",
    match: (host) => Boolean(AWIN_PUBLISHER_ID && AWIN_MERCHANTS.has(stripWww(host))),
    wrap: (url) => {
      const mid = AWIN_MERCHANTS.get(stripWww(url.host));
      if (!mid || !AWIN_PUBLISHER_ID) return null;
      const dest = encodeURIComponent(url.toString());
      return new URL(`https://www.awin1.com/cread.php?awinmid=${mid}&awinaffid=${AWIN_PUBLISHER_ID}&p=${dest}`);
    },
  },

  /* ── Impact (US/UAE aggregator) ──
     Same shape as Awin — redirect through impact.com with merchant +
     publisher IDs. Disabled until ID table populated. */
  {
    name: "impact",
    match: () => false,
    wrap: () => null,
  },
];

/* ── Public API ──────────────────────────────────────────────────── */

/**
 * Wrap an outbound URL with the appropriate affiliate parameters
 * based on its destination host. No-ops cleanly when no rule
 * matches OR when the matching rule's env var isn't set.
 *
 * Called from /api/go right before the 302.
 */
export function wrapWithAffiliate(targetUrl: string, ctx: WrapContext): string {
  let url: URL;
  try {
    url = new URL(targetUrl);
  } catch {
    return targetUrl; // malformed input — don't break the click
  }

  const host = url.host.toLowerCase();
  for (const rule of RULES) {
    if (!rule.match(host)) continue;
    const wrapped = rule.wrap(url, ctx);
    if (wrapped) return wrapped.toString();
    // Rule matched but no env var set → URL passes through unchanged
    return targetUrl;
  }
  return targetUrl;
}

/* Used by docs / debug endpoints to see which rules are live. */
export function activeAffiliateRules(): string[] {
  const active: string[] = [];
  /* Probe each rule with a synthetic URL of its host pattern.
     Any rule whose wrap() returns non-null is "live". */
  if (envOrNull("AMAZON_ASSOC_TAG_US")) active.push("amazon-us");
  if (envOrNull("AMAZON_ASSOC_TAG_UK")) active.push("amazon-uk");
  if (envOrNull("AMAZON_ASSOC_TAG_DE")) active.push("amazon-de");
  if (envOrNull("AMAZON_ASSOC_TAG_AE")) active.push("amazon-ae");
  if (envOrNull("AMAZON_ASSOC_TAG_IN")) active.push("amazon-in");
  if (envOrNull("AMAZON_ASSOC_TAG_ZA")) active.push("amazon-za");
  if (envOrNull("KONGA_AFFILIATE_KEY")) active.push("konga");
  if (envOrNull("JUMIA_AFFILIATE_KEY")) active.push("jumia");
  if (envOrNull("ALIEXPRESS_AFFILIATE_KEY")) active.push("aliexpress");
  active.push("ebay"); // campid 5339156340 baked in; env overrides
  return active;
}
