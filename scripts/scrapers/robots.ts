/* Minimal robots.txt parser + cache for scraper compliance.
   We don't pull in robots-parser because we only need a tiny subset
   of the spec: User-agent matching + Disallow rules. Allow rules + the
   wildcard / regex extensions aren't worth the dependency.

   Used by scrape.ts before each store scrape to skip retailers whose
   robots.txt explicitly disallows the paths we'd hit. Logs a clear
   warning either way so we have an audit trail. */

interface RobotsRules {
  /** Paths that should NOT be fetched, per user-agent group */
  disallow: string[];
  /** Crawl-delay in seconds for our user-agent (best-effort) */
  crawlDelay?: number;
}

const cache = new Map<string, RobotsRules | null>();
const FETCH_TIMEOUT_MS = 5000;

/** Our canonical user-agent identifier — what scrapers should send too. */
export const USER_AGENT = "HavloBot/1.0 (+https://havlo.io/contact)";

async function fetchRobotsTxt(origin: string): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/plain" },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/* Parse robots.txt extracting rules for the most-specific matching
   user-agent. Order of preference: HavloBot → * → first group. */
function parseRules(text: string, ua: string): RobotsRules {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim());
  const groups: Array<{ agents: string[]; disallow: string[]; allow: string[]; crawlDelay?: number }> = [];
  let current: typeof groups[number] | null = null;

  for (const line of lines) {
    if (!line) continue;
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.toLowerCase().trim();
    const value = rest.join(":").trim();
    if (!key || !value) continue;

    if (key === "user-agent") {
      // Multiple consecutive User-agents share the same rule block
      if (!current || current.disallow.length || current.allow.length || current.crawlDelay != null) {
        current = { agents: [], disallow: [], allow: [], crawlDelay: undefined };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if (key === "disallow" && current) {
      current.disallow.push(value);
    } else if (key === "allow" && current) {
      current.allow.push(value);
    } else if (key === "crawl-delay" && current) {
      const n = parseFloat(value);
      if (!isNaN(n)) current.crawlDelay = n;
    }
  }

  const uaLc = ua.toLowerCase();
  const havlo = groups.find((g) => g.agents.some((a) => uaLc.includes(a) && a !== "*"));
  const star  = groups.find((g) => g.agents.includes("*"));
  const chosen = havlo ?? star ?? groups[0];
  if (!chosen) return { disallow: [] };
  return { disallow: chosen.disallow.filter(Boolean), crawlDelay: chosen.crawlDelay };
}

async function getRules(origin: string): Promise<RobotsRules | null> {
  if (cache.has(origin)) return cache.get(origin)!;
  const text = await fetchRobotsTxt(origin);
  if (!text) {
    cache.set(origin, null);
    return null;
  }
  const rules = parseRules(text, USER_AGENT);
  cache.set(origin, rules);
  return rules;
}

/** True if the given URL is allowed to be fetched per the site's robots.txt.
    When robots.txt is missing or unreadable we default to ALLOWED (consistent
    with industry practice — absence of rules ≠ implicit denial). */
export async function isAllowedByRobots(targetUrl: string): Promise<{
  allowed: boolean;
  reason: string;
  crawlDelayMs?: number;
}> {
  let url: URL;
  try { url = new URL(targetUrl); }
  catch { return { allowed: false, reason: "invalid URL" }; }

  const origin = `${url.protocol}//${url.host}`;
  const rules = await getRules(origin);
  if (!rules) return { allowed: true, reason: "no robots.txt available" };

  // Disallow: prefix matching per RFC 9309
  const path = url.pathname + url.search;
  for (const rule of rules.disallow) {
    if (rule === "") continue;          // empty Disallow = allow all
    if (rule === "/") return { allowed: false, reason: "site-wide disallow" };
    if (path.startsWith(rule)) {
      return {
        allowed: false,
        reason: `Disallow: ${rule}`,
        crawlDelayMs: rules.crawlDelay ? rules.crawlDelay * 1000 : undefined,
      };
    }
  }

  return {
    allowed: true,
    reason: "allowed",
    crawlDelayMs: rules.crawlDelay ? rules.crawlDelay * 1000 : undefined,
  };
}
