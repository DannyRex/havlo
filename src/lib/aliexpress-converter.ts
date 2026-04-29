/* AliExpress URL Converter — calls the official Affiliate API
   to convert standard product URLs into properly-attributed
   tracking links (s.click.aliexpress.com/...).

   Endpoint: aliexpress.affiliate.link.generate
   Docs:     https://openservice.aliexpress.com/doc/doc.htm

   Auth:
     - HMAC-SHA256 signature over alphabetically-sorted params
     - Secret is concatenated as: SECRET + key1value1key2value2... + SECRET
     - Resulting hex is uppercased

   Caching: resolved URLs stored in resolved_clicks Supabase table for
   30 days (same table used by the SerpAPI relay resolver). One API
   call per unique source URL, amortized across all users + clicks.
*/

import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/providers/db-client";

/* Singapore endpoint — fastest for global use including NG. The .com
   variant routes to a US datacenter. Both work; SG is lower-latency
   for African + EU users. */
const API_BASE = "https://api-sg.aliexpress.com/sync";
const TRACKING_ID = "havlo";
const CACHE_TTL_MS = 30 * 86400 * 1000;

interface AffiliateLinkResponse {
  aliexpress_affiliate_link_generate_response?: {
    resp_result?: {
      result?: {
        promotion_links?: {
          promotion_link?: Array<{
            source_value?: string;
            promotion_link?: string;
          }>;
        };
        total_result_count?: number;
      };
      resp_code?: number;
      resp_msg?: string;
    };
  };
  error_response?: {
    code?: number;
    msg?: string;
    sub_code?: string;
    sub_msg?: string;
  };
}

/* AliExpress signing: sort params alphabetically, concat as
   key1value1key2value2…, wrap with the App Secret, HMAC-SHA256, hex,
   uppercase. */
function signParams(params: Record<string, string>, secret: string): string {
  const keys = Object.keys(params).sort();
  const concat = keys.map((k) => `${k}${params[k]}`).join("");
  return crypto
    .createHmac("sha256", secret)
    .update(concat)
    .digest("hex")
    .toUpperCase();
}

/* Cache helpers — share the resolved_clicks table with the SerpAPI
   relay resolver. Same source_url → resolved_url contract. */
async function readCache(sourceUrl: string): Promise<string | null> {
  const supa = getSupabaseAdmin();
  if (!supa) return null;
  const { data } = await supa
    .from("resolved_clicks")
    .select("resolved_url, resolved_at")
    .eq("source_url", sourceUrl)
    .maybeSingle();
  if (!data) return null;
  const age = Date.now() - new Date((data as { resolved_at: string }).resolved_at).getTime();
  if (age > CACHE_TTL_MS) return null;
  return (data as { resolved_url: string }).resolved_url;
}

async function writeCache(sourceUrl: string, resolvedUrl: string) {
  const supa = getSupabaseAdmin();
  if (!supa) return;
  await supa.from("resolved_clicks").upsert(
    { source_url: sourceUrl, resolved_url: resolvedUrl, resolved_at: new Date().toISOString() },
    { onConflict: "source_url" },
  );
}

/* Convert one AliExpress URL via the official API. Returns the
   tracking link (s.click.aliexpress.com/...) on success, or null on
   any failure — caller falls back to the simpler ?aff_short_key= URL. */
async function callConverter(sourceUrl: string): Promise<string | null> {
  const appKey    = process.env.ALIEXPRESS_APP_KEY?.trim();
  const appSecret = process.env.ALIEXPRESS_APP_SECRET?.trim();
  if (!appKey || !appSecret) return null;

  const params: Record<string, string> = {
    app_key:              appKey,
    method:               "aliexpress.affiliate.link.generate",
    /* AliExpress requires timestamp in their format: YYYY-MM-DD HH:mm:ss
       in GMT+8 (China time). Plain Date.now() gets rejected. */
    timestamp:            new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, ""),
    sign_method:          "hmac-sha256",
    format:               "json",
    v:                    "2.0",
    /* Method-specific */
    tracking_id:          TRACKING_ID,
    promotion_link_type:  "0",     // 0 = normal link, 2 = hot link, 3 = bestsellers
    source_values:        sourceUrl,
  };

  params.sign = signParams(params, appSecret);

  const body = new URLSearchParams(params).toString();

  let res: Response;
  try {
    res = await fetch(API_BASE, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  let data: AffiliateLinkResponse;
  try {
    data = (await res.json()) as AffiliateLinkResponse;
  } catch {
    return null;
  }

  if (data.error_response) {
    /* Verbose: log the full error so we can diagnose sign method,
       method name, permission, etc. Visible in Vercel function logs. */
    console.warn("[aliexpress-converter] error_response:", JSON.stringify(data.error_response));
    return null;
  }

  const respCode = data.aliexpress_affiliate_link_generate_response?.resp_result?.resp_code;
  if (respCode != null && respCode !== 200) {
    console.warn(
      "[aliexpress-converter] resp_result error:",
      JSON.stringify(data.aliexpress_affiliate_link_generate_response?.resp_result),
    );
    return null;
  }

  const link = data
    .aliexpress_affiliate_link_generate_response
    ?.resp_result?.result
    ?.promotion_links?.promotion_link?.[0]
    ?.promotion_link;

  if (!link) {
    console.warn(
      "[aliexpress-converter] no link in response:",
      JSON.stringify(data).slice(0, 500),
    );
  }
  return link ?? null;
}

/**
 * Public API: convert a standard AliExpress product URL into a
 * tracking deep link. Cache-first; returns null if conversion fails
 * AND no cached result exists. Caller should fall back to the simpler
 * ?aff_short_key= URL pattern.
 */
export async function convertAliexpressUrl(sourceUrl: string): Promise<string | null> {
  const cached = await readCache(sourceUrl);
  if (cached) return cached;

  const resolved = await callConverter(sourceUrl);
  if (resolved) {
    void writeCache(sourceUrl, resolved);
    return resolved;
  }
  return null;
}

/** True if AliExpress API credentials are configured. */
export function aliexpressApiActive(): boolean {
  return Boolean(
    process.env.ALIEXPRESS_APP_KEY?.trim() &&
    process.env.ALIEXPRESS_APP_SECRET?.trim(),
  );
}
