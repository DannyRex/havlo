/* ──────────────────────────────────────────────────────────────────
   Signing for /api/go outbound links.

   /api/go redirects the user to its `url` query param. Unsigned,
   havlo.io/api/go?url=https://evil.com is an open redirect — a
   phishing assist on a trusted domain.

   Every Havlo-issued /api/go link is signed: appendSignature() adds
   a &sig= HMAC of the url param, and the /api/go route verifies it.
   A link without a valid signature is NOT redirected to its external
   url — the route degrades to an internal Havlo page instead.

   The HMAC key is a server-only secret. A dedicated GO_SIGNING_SECRET
   is preferred; absent that we reuse SUPABASE_SERVICE_ROLE_KEY
   (already server-only, always set) as key material. Signing and
   verifying always use the same key, so the scheme stays consistent.

   Server runtime only (node:crypto) — never import into a client
   component; the secret must not reach the browser bundle.
   ────────────────────────────────────────────────────────────────── */

import { createHmac, timingSafeEqual } from "node:crypto";

/* The real server-only key material, or null when neither secret is
   configured. verifyGoTarget() keys its fail-closed decision off this. */
function realSecret(): string | null {
  return (
    process.env.GO_SIGNING_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    null
  );
}

function signingKey(): string {
  /* Constant fallback ONLY so signGoTarget() doesn't crash in a
     misconfigured env. It can never authorize an outbound redirect:
     verifyGoTarget() returns false whenever realSecret() is null, so a
     signature made with this constant is never honored. The constant is
     visible in the public repo — treating it as valid key material would
     be fail-OPEN (forgeable open redirect). This is fail-CLOSED. */
  return realSecret() || "havlo-go-unsecret-fail-closed";
}

/* HMAC-SHA256 of the redirect target, hex, truncated to 16 chars
   (64 bits) — forgery-infeasible for a redirect token with no
   offline oracle, while keeping the URL short. */
export function signGoTarget(target: string): string {
  return createHmac("sha256", signingKey()).update(target).digest("hex").slice(0, 16);
}

/* Constant-time check that `sig` is a valid signature for `target`. */
export function verifyGoTarget(target: string, sig: string | null | undefined): boolean {
  if (!sig) return false;
  /* Fail closed: with no real signing secret configured, never honor a
     signature. Otherwise the public-repo fallback constant would let
     anyone forge a sig and turn /api/go into an open redirect. Every
     outbound link then degrades to its internal Havlo page instead. */
  if (!realSecret()) return false;
  const expected = signGoTarget(target);
  if (sig.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

/* Takes a freshly-built `/api/go?...` URL (absolute or path-only),
   reads its `url` param, and appends `&sig=<hmac>`. Returns the
   input unchanged when it isn't an /api/go URL or carries no url
   param. Call this server-side, right after getClickThroughUrl(). */
export function appendSignature(goUrl: string): string {
  try {
    const u = new URL(goUrl, "https://havlo.io");
    if (!u.pathname.startsWith("/api/go")) return goUrl;
    const target = u.searchParams.get("url");
    if (!target) return goUrl;
    u.searchParams.set("sig", signGoTarget(target));
    return u.pathname + u.search;
  } catch {
    return goUrl;
  }
}
