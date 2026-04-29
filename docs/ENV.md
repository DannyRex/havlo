# Environment variables

Single source of truth for every env var Havlo reads. Set in `.env.local`
for dev and in **Vercel → Project → Settings → Environment Variables**
for production. GitHub Actions secrets must mirror the same names.

## Required (always)

| Var | Where it's used | Notes |
|---|---|---|
| `SUPABASE_URL` | Server (`db-client.ts`) | Project URL from Supabase dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Service role; never expose to client |
| `SUPABASE_ANON_KEY` | Client + server | Public anon key |

## Optional — search providers (each gates one provider)

| Var | Provider | Status |
|---|---|---|
| `SERPAPI_KEY` | `serpapi-shopping` (Google Shopping live) | Active |
| `KONGA_AFFILIATE_KEY` | `konga-affiliate` (NG retail) | **Pending approval — set once Konga issues key** |
| `KONGA_AFFILIATE_API_BASE` | Override Konga base URL if their docs reveal a non-default endpoint | Optional |

## Optional — affiliate / monetization (Phase 11a)

Each var below activates one rule in `src/lib/affiliate.ts`. Unset =
the rule no-ops; outbound URL passes through unchanged. Wired into
every outbound click via `/api/go`.

### Amazon Associates — one tag per marketplace

| Var | Marketplace |
|---|---|
| `AMAZON_ASSOC_TAG_US` | amazon.com |
| `AMAZON_ASSOC_TAG_UK` | amazon.co.uk |
| `AMAZON_ASSOC_TAG_DE` | amazon.de |
| `AMAZON_ASSOC_TAG_FR` | amazon.fr |
| `AMAZON_ASSOC_TAG_IT` | amazon.it |
| `AMAZON_ASSOC_TAG_ES` | amazon.es |
| `AMAZON_ASSOC_TAG_CA` | amazon.ca |
| `AMAZON_ASSOC_TAG_AU` | amazon.com.au |
| `AMAZON_ASSOC_TAG_AE` | amazon.ae |
| `AMAZON_ASSOC_TAG_SA` | amazon.sa |
| `AMAZON_ASSOC_TAG_IN` | amazon.in |
| `AMAZON_ASSOC_TAG_MX` | amazon.com.mx |
| `AMAZON_ASSOC_TAG_BR` | amazon.com.br |
| `AMAZON_ASSOC_TAG_ZA` | amazon.co.za |
| `AMAZON_ASSOC_TAG_JP` | amazon.co.jp |
| `AMAZON_ASSOC_TAG_SG` | amazon.sg |

Tag format: `havlo-21` (varies per marketplace per Amazon's rules).

### Other networks

| Var | Network | Notes |
|---|---|---|
| `JUMIA_AFFILIATE_KEY` | Jumia Affiliate Programme | Apply at jumia.com.ng/affiliate-program |
| `ALIEXPRESS_AFFILIATE_KEY` | AliExpress Affiliate Portal | Tracking ID name (e.g. `havlo`). Used by the fallback `?aff_short_key=` URL pattern. |
| `ALIEXPRESS_APP_KEY` | AliExpress Open Platform Developer | App Key from open.aliexpress.com console. Enables proper API attribution via `aliexpress.affiliate.link.generate`. |
| `ALIEXPRESS_APP_SECRET` | AliExpress Open Platform Developer | App Secret. **NEVER commit. Rotate immediately if leaked.** |
| `EBAY_PARTNER_CAMPAIGN_ID` | eBay Partner Network | Found in your EPN dashboard |

## Optional — UX integrations

| Var | Used by |
|---|---|
| `NEXT_PUBLIC_CONTACT_FORM_URL` | `/contact` form POST target (Formspree etc.). When unset, form falls back to `mailto:hello@havlo.io`. |

## Optional — SEO verification

Plug the codes Google + Bing give you on their respective consoles
so the matching `<meta>` tag renders in `<head>`. Both are public-
facing so the `NEXT_PUBLIC_` prefix is fine.

| Var | Where to get it |
|---|---|
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Google Search Console → Settings → Ownership verification → HTML tag method → copy the `content="..."` value |
| `NEXT_PUBLIC_BING_SITE_VERIFICATION` | Bing Webmaster Tools → Site verification → meta tag method → copy the `content="..."` value |

## Vercel-injected (do not set manually)

| Var | What it is |
|---|---|
| `VERCEL_GIT_COMMIT_SHA` | Surfaced as `<meta name="commit">` so QA can verify which commit prod is serving |

## GitHub Actions secrets

Mirror the relevant subset above into **Repo → Settings → Secrets and
variables → Actions**. The `refresh-data` workflow reads:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SERPAPI_KEY` (skip step if absent)
- `KONGA_AFFILIATE_KEY` (skip step if absent)
