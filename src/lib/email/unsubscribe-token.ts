/* ──────────────────────────────────────────────────────────────────
   HMAC-signed newsletter unsubscribe authorisation.

   The newsletter_subscribers table has no per-row unsubscribe token
   column, and the runtime Supabase key is read-only, so we can't add
   one without a migration. Instead we authorise an unsubscribe by
   signing the subscriber's (normalised) email with a server-only HMAC
   key: possession of a valid (email, sig) pair proves the link came
   from an email Havlo actually addressed to that inbox. Same trust
   model as the /api/go redirect signer (go-signing.ts).

   Two surfaces consume this:
     • the visible "Unsubscribe" link in the digest body  → the
       /unsubscribe-newsletter confirmation PAGE (human click)
     • the RFC 8058 List-Unsubscribe header                → the
       /api/newsletter/unsubscribe POST route (mailbox one-click)

   Server runtime only (node:crypto) — never import into a client
   component; the secret must not reach the browser bundle.
   ────────────────────────────────────────────────────────────────── */

import { createHmac, timingSafeEqual } from "node:crypto";

const SITE_URL = "https://havlo.io";

function signingKey(): string {
  return (
    process.env.GO_SIGNING_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "havlo-unsub-unsecret"
  );
}

/* Sign + verify always normalise the same way so a casing/whitespace
   difference between send-time and click-time can't invalidate a
   legitimate link. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/* HMAC-SHA256 of the normalised email, hex, truncated to 32 chars
   (128 bits). Longer than the 64-bit /api/go redirect token because
   this one is identity-bearing — it gates a state change on a named
   inbox, not just a redirect. */
export function signUnsubscribe(email: string): string {
  return createHmac("sha256", signingKey())
    .update(normalizeEmail(email))
    .digest("hex")
    .slice(0, 32);
}

/* Constant-time check that `sig` authorises unsubscribing `email`. */
export function verifyUnsubscribe(email: string, sig: string | null | undefined): boolean {
  if (!sig) return false;
  const expected = signUnsubscribe(email);
  if (sig.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

/* Human-facing confirmation link for the digest body. Lands on the
   branded /unsubscribe-newsletter page, which performs the removal and
   renders a friendly success state (mirrors /unsubscribe-alert). */
export function unsubscribeLink(email: string): string {
  const e = encodeURIComponent(normalizeEmail(email));
  const s = signUnsubscribe(email);
  return `${SITE_URL}/unsubscribe-newsletter?e=${e}&sig=${s}`;
}

/* RFC 8058 List-Unsubscribe + List-Unsubscribe-Post headers. The https
   target is POSTed by the mailbox provider for true one-click removal;
   the mailto is the universal fallback for clients that don't do the
   one-click POST. Gmail / Apple Mail / Yahoo surface a native
   "Unsubscribe" control from these without the user opening the email. */
export function unsubscribeHeaders(email: string): Record<string, string> {
  const e = encodeURIComponent(normalizeEmail(email));
  const s = signUnsubscribe(email);
  const oneClick = `${SITE_URL}/api/newsletter/unsubscribe?e=${e}&sig=${s}`;
  return {
    "List-Unsubscribe": `<mailto:hello@havlo.io?subject=unsubscribe>, <${oneClick}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
