/* ──────────────────────────────────────────────────────────────────
   SSRF guard for server-side fetches of user-supplied URLs.

   /api/sniff fetches whatever URL a visitor pastes. Without this a
   caller can point it at internal infrastructure — localhost, the
   RFC1918 private ranges, or the cloud-metadata address
   169.254.169.254 — and a benign-looking URL that 302-redirects to
   an internal address slips through too.

   safeFetch() validates the scheme, resolves the hostname, and
   rejects the request if ANY resolved address is private / loopback
   / link-local / reserved. It forces redirect:"manual" and
   re-validates every redirect hop.

   Caveat: a small DNS-rebind window exists between validation and
   the actual connect. Acceptable for a best-effort product sniffer;
   do NOT reuse this for requests that carry secrets.

   Node runtime only (uses node:dns + node:net).
   ────────────────────────────────────────────────────────────────── */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/* True when an IP literal falls in a range a user-supplied URL must
   never reach: loopback, RFC1918 private, link-local (incl. the
   169.254.169.254 cloud-metadata address), CGNAT, ULA, multicast. */
function isBlockedIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const o = ip.split(".").map(Number);
    if (o[0] === 0)   return true;                              // 0.0.0.0/8
    if (o[0] === 10)  return true;                              // 10/8 private
    if (o[0] === 127) return true;                              // loopback
    if (o[0] === 169 && o[1] === 254) return true;              // link-local + metadata
    if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return true;  // 172.16/12 private
    if (o[0] === 192 && o[1] === 168) return true;              // 192.168/16 private
    if (o[0] === 100 && o[1] >= 64 && o[1] <= 127) return true; // 100.64/10 CGNAT
    if (o[0] >= 224)  return true;                              // multicast + reserved
    return false;
  }
  if (v === 6) {
    const lc = ip.toLowerCase();
    if (lc === "::1" || lc === "::") return true;               // loopback / unspecified
    if (lc.startsWith("::ffff:")) return isBlockedIp(lc.slice(7)); // IPv4-mapped
    if (/^fe[89ab]/.test(lc)) return true;                      // fe80::/10 link-local
    if (lc.startsWith("fc") || lc.startsWith("fd")) return true; // fc00::/7 ULA
    return false;
  }
  return true; // not a parseable IP → block
}

/* Returns an error string when `raw` is not a safe public http(s)
   URL, or null when it is safe to fetch. */
async function validateUrl(raw: string): Promise<string | null> {
  let u: URL;
  try { u = new URL(raw); } catch { return "invalid URL"; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return "unsupported scheme";
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost")) return "blocked host";
  if (isIP(host)) return isBlockedIp(host) ? "blocked address" : null;
  let addrs: Array<{ address: string }>;
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    return "DNS resolution failed";
  }
  if (addrs.length === 0) return "DNS resolution failed";
  for (const a of addrs) {
    if (isBlockedIp(a.address)) return "blocked address";
  }
  return null;
}

export interface SafeFetchResult {
  ok: boolean;
  response?: Response;
  error?: string;
}

/* SSRF-safe fetch. Validates the URL and every redirect hop against
   the private-address blocklist, with a hop cap. `init.redirect` is
   overridden — redirects are always followed manually so each hop
   can be re-checked. */
export async function safeFetch(
  rawUrl: string,
  init: RequestInit = {},
  maxHops = 4,
): Promise<SafeFetchResult> {
  let url = rawUrl;
  for (let hop = 0; hop <= maxHops; hop++) {
    const err = await validateUrl(url);
    if (err) return { ok: false, error: err };
    let res: Response;
    try {
      res = await fetch(url, { ...init, redirect: "manual" });
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return { ok: true, response: res };
      try {
        url = new URL(loc, url).toString();
      } catch {
        return { ok: false, error: "invalid redirect target" };
      }
      continue;
    }
    return { ok: true, response: res };
  }
  return { ok: false, error: "too many redirects" };
}
