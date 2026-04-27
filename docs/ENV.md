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

## Optional — UX integrations

| Var | Used by |
|---|---|
| `NEXT_PUBLIC_CONTACT_FORM_URL` | `/contact` form POST target (Formspree etc.). When unset, form falls back to `mailto:hello@havlo.io`. |

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
