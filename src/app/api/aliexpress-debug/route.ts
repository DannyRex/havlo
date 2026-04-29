/* Temporary debug endpoint — calls the AliExpress converter once and
   returns whatever the API actually said. Lets us diagnose sign /
   permission / timestamp errors via plain curl, no Vercel-logs needed.

   DELETE THIS FILE once the converter is working. It exposes raw
   AliExpress error messages which is fine for debug but noisy for
   prod. */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const API_BASE = "https://api-sg.aliexpress.com/sync";
const TRACKING_ID = "havlo";

function signParams(params: Record<string, string>, secret: string): string {
  const keys = Object.keys(params).sort();
  const concat = keys.map((k) => `${k}${params[k]}`).join("");
  return crypto
    .createHmac("sha256", secret)
    .update(concat)
    .digest("hex")
    .toUpperCase();
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")
    ?? "https://www.aliexpress.com/item/1005006890123456.html";

  const appKey    = process.env.ALIEXPRESS_APP_KEY?.trim();
  const appSecret = process.env.ALIEXPRESS_APP_SECRET?.trim();

  if (!appKey || !appSecret) {
    return NextResponse.json({
      ok: false,
      reason: "env_missing",
      app_key_set:    Boolean(appKey),
      app_secret_set: Boolean(appSecret),
    });
  }

  const params: Record<string, string> = {
    app_key:              appKey,
    method:               "aliexpress.affiliate.link.generate",
    timestamp:            new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, ""),
    sign_method:          "hmac-sha256",
    format:               "json",
    v:                    "2.0",
    tracking_id:          TRACKING_ID,
    promotion_link_type:  "0",
    source_values:        url,
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
  } catch (err) {
    return NextResponse.json({
      ok: false,
      reason: "fetch_failed",
      error: String(err),
    });
  }

  const text = await res.text();
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { parsed = text; }

  return NextResponse.json({
    ok: res.ok,
    http_status: res.status,
    /* Echo what we sent so we can sanity-check sign inputs */
    sent_params: {
      ...params,
      sign: params.sign.slice(0, 12) + "...",  // truncate so secret-derived sign isn't fully exposed
    },
    /* Full AliExpress response — this is what we need to diagnose */
    aliexpress_response: parsed,
  });
}
