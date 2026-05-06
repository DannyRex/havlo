/* Resend email wrapper. Single entry point for every transactional
   email Havlo sends, so the API key + from address + retry behaviour
   only live in one place.

   Usage:
     import { sendEmail } from "@/lib/email/send";
     await sendEmail({
       to: "user@example.com",
       subject: "...",
       html: "<p>...</p>",
       text: "...",
       tags: [{ name: "category", value: "notify-confirmation" }],
     });

   Failure handling: never throws. Returns { ok, id?, error? } so the
   caller can decide whether email failure should block the user-facing
   response. For confirmations after a successful capture, the answer
   is always 'no' — the row is saved, the email is a nice-to-have.

   No-op safety: when RESEND_API_KEY is unset (local dev, preview
   deploys without secrets) the wrapper logs and returns ok:false
   without throwing, so the calling endpoint still succeeds. */

import { Resend } from "resend";

const FROM_DEFAULT     = "Havlo <hello@havlo.io>";
const REPLY_TO_DEFAULT = "hello@havlo.io";

interface SendOptions {
  to:        string;
  subject:   string;
  /** Required. Plain-text version improves deliverability + accessibility. */
  text:      string;
  /** Optional HTML version. Email clients prefer it when both are present. */
  html?:     string;
  /** Override the default From. Format: "Havlo <hello@havlo.io>" */
  from?:     string;
  /** Override the default Reply-To. */
  replyTo?:  string;
  /** Resend tags for dashboard filtering / analytics. */
  tags?:     { name: string; value: string }[];
}

interface SendResult {
  ok:     boolean;
  id?:    string;
  error?: string;
}

let _resendClient: Resend | null = null;

function getClient(): Resend | null {
  if (_resendClient) return _resendClient;
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  _resendClient = new Resend(key);
  return _resendClient;
}

export async function sendEmail(opts: SendOptions): Promise<SendResult> {
  const client = getClient();
  if (!client) {
    /* No key in env. Common in local dev or preview deploys without
       secrets. Log + return cleanly so callers don't error their users. */
    console.warn("[email] RESEND_API_KEY not set, skipping send to:", opts.to);
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const from    = opts.from    ?? process.env.EMAIL_FROM     ?? FROM_DEFAULT;
  const replyTo = opts.replyTo ?? process.env.EMAIL_REPLY_TO ?? REPLY_TO_DEFAULT;

  try {
    const { data, error } = await client.emails.send({
      from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      replyTo,
      tags: opts.tags,
    });

    if (error) {
      console.error("[email] send failed:", error.message ?? error);
      return { ok: false, error: error.message ?? "Unknown send error" };
    }
    return { ok: true, id: data?.id };
  } catch (err) {
    /* Network errors / SDK exceptions. Resend's SDK throws on hard
       failures (auth, network) rather than returning {error}. Catch so
       a transient blip doesn't crash the calling API route. */
    console.error("[email] send threw:", (err as Error).message);
    return { ok: false, error: (err as Error).message };
  }
}
