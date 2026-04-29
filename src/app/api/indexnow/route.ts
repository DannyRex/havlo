/* IndexNow ping endpoint.

   Pings IndexNow (which fans out to Bing + Yandex + Yep + others)
   that one or more URLs have changed. Free, instant — much faster
   than waiting for crawler discovery.

   Usage:
     1. Get a key at bing.com/indexnow → save as INDEXNOW_KEY env var
     2. Save the key file at /public/<KEY>.txt with the key as content
        (one-line text file). Submit that file path as the keyLocation
        when you first ping. Required for ownership verification.
     3. POST to /api/indexnow with { urls: [...] } to ping changed URLs
     4. Wire into deploy hook OR ingestion script for automated pings

   Security: requires the matching INDEXNOW_TRIGGER_SECRET header so
   randoms can't trigger unlimited pings on our behalf (rate-limited
   by IndexNow but still polite). */

import { NextRequest, NextResponse } from "next/server";

const SITE_HOST = "havlo.io";

export async function POST(req: NextRequest) {
  const key = process.env.INDEXNOW_KEY?.trim();
  if (!key) {
    return NextResponse.json({ error: "INDEXNOW_KEY not configured" }, { status: 503 });
  }

  /* Optional shared-secret guard — set INDEXNOW_TRIGGER_SECRET in
     env, callers must include it as the X-Trigger-Secret header. */
  const triggerSecret = process.env.INDEXNOW_TRIGGER_SECRET?.trim();
  if (triggerSecret) {
    const provided = req.headers.get("x-trigger-secret");
    if (provided !== triggerSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: { urls?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const urls = body.urls?.filter((u) => typeof u === "string" && u.startsWith(`https://${SITE_HOST}/`));
  if (!urls?.length) {
    return NextResponse.json({ error: "Provide { urls: [...] } with full https://havlo.io URLs" }, { status: 400 });
  }

  /* IndexNow accepts up to 10,000 URLs per request. Per docs:
     https://www.indexnow.org/documentation */
  const payload = {
    host:         SITE_HOST,
    key,
    keyLocation:  `https://${SITE_HOST}/${key}.txt`,
    urlList:      urls.slice(0, 10000),
  };

  const res = await fetch("https://api.indexnow.org/IndexNow", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  });

  return NextResponse.json({
    submitted: urls.length,
    indexnow_status: res.status,
    indexnow_ok:     res.ok,
  });
}
