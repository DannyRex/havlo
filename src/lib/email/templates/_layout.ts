/* Shared email design system.
   ─────────────────────────────────────────────────────────────────
   Every Havlo email composes from this file so the inbox renders as
   one suite, not five. Two intensity levels:

     - shellMarketing(...)   = content-rich shell with Havlo wordmark,
                               larger title, optional CTA, branded
                               footer with social. Used by the
                               newsletter digest.

     - shellPersonal(...)    = lighter shell with the same wordmark
                               but smaller, body reads as paragraphs.
                               Used by transactional confirmations
                               (welcome, waitlist, product-notify,
                               match-found) to preserve Gmail
                               Primary-tab placement.

   Both shells share:
     - Identical typography stack, color tokens, container width
     - Mobile media-query overrides (width, padding, font sizes)
     - Dark-mode media-query overrides (bg, ink, border colors)
     - Bulletproof Outlook fallbacks (MSO conditional comments)
     - A footer pattern with unsubscribe + brand + address

   Why we don't use a JSX email framework (react-email, mjml):
     1. The build/runtime cost adds 1-3 MB to a Node script that
        sends ~10 emails/week. Inline strings keep the cron lean.
     2. JSX frameworks abstract away the inline-style constraints
        that matter most for cross-client compatibility — and we
        already audit those constraints manually before shipping.
     3. Tree of plain string fns composes the same way <Components>
        do without a build step.

   Design tokens are duplicated as inline-styleable hex strings here
   (not pulled from globals.css) because email clients strip <style>
   blocks aggressively. Inline-only is the safe path. */

/* ── Color tokens (light mode) ─────────────────────────────────── */

export const tokens = {
  /* Brand */
  brand:        "#0057FF",
  brandHover:   "#0044CC",

  /* Text */
  ink:          "#0F172A",   // slate-900 — primary
  ink2:         "#475569",   // slate-600 — secondary
  ink3:         "#94A3B8",   // slate-400 — tertiary, meta

  /* Backgrounds */
  bg:           "#FFFFFF",
  surface:      "#F7F8FA",   // subtle blocks (deal card backgrounds)

  /* Borders */
  border:       "#E2E8F0",   // slate-200

  /* Accents */
  success:      "#10B981",   // emerald-500 — discount badges
  successBg:    "#ECFDF5",   // emerald-50 — discount badge bg

  /* Typography */
  fontFamily:   `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`,
} as const;

/* ── Constants ─────────────────────────────────────────────────── */

const SITE_URL  = "https://havlo.io";
const MAX_WIDTH = 600;

/* ── Shared HTML escapers ──────────────────────────────────────── */
/* Five-char minimum set. URL attributes get the same treatment;
   outbound URLs are already URL-encoded upstream so any reserved
   char that survives here is intentional (e.g. & in query strings)
   and rendering it as &amp; is the correct HTML serialization. */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
export const escapeAttr = escapeHtml;

/* ── Layout components ─────────────────────────────────────────── */

interface ShellOptions {
  /** Subject-line preview text — first ~100 chars Gmail shows in
      inbox list under the subject. Hidden visually but indexed. */
  preheader: string;
  /** Main body HTML — composed from the helpers below. */
  body:      string;
}

/* The standard email-client-safe document shell. DOCTYPE + meta
   tags + dark-mode color-scheme hint + mobile media queries +
   Outlook conditional table fallback. */
function shellDocument({ preheader, body, kind }: ShellOptions & { kind: "marketing" | "personal" }): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>Havlo</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
  /* Reset for misbehaving clients (Yahoo, AOL, Outlook.com). Inline
     styles below still take precedence for everything that matters. */
  body, table, td, p, a { -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
  body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
  .container { max-width: ${MAX_WIDTH}px; }

  /* Mobile overrides (clients that respect <style>). */
  @media only screen and (max-width: 600px) {
    .container { width: 100% !important; }
    .px-mobile { padding-left: 24px !important; padding-right: 24px !important; }
    .h1-mobile  { font-size: 22px !important; line-height: 1.25 !important; }
    .h2-mobile  { font-size: 18px !important; }
    .stack      { display: block !important; width: 100% !important; }
  }

  /* Dark-mode overrides for clients that honour prefers-color-scheme
     (Apple Mail, iOS Mail, Outlook.com webmail, Spark). Gmail's
     dark mode does its own invert and ignores these, which is fine.
     Our inline light-mode colors stay legible against Gmail's grey
     auto-inverted backgrounds. */
  @media (prefers-color-scheme: dark) {
    .bg-body     { background-color: #0A0A0A !important; }
    .bg-surface  { background-color: #111111 !important; }
    .bg-card     { background-color: #1A1A1A !important; }
    .text-ink    { color: #F5F5F5 !important; }
    .text-ink-2  { color: #A3A3A3 !important; }
    .text-ink-3  { color: #6B6B6B !important; }
    .border      { border-color: #333333 !important; }
    .border-top  { border-top-color: #333333 !important; }
    .text-brand  { color: #4A8BFF !important; }
    /* Header band stays white in dark mode — the dark-slate
       wordmark needs a stable light background to read against. */
    .header-band { background-color: #FFFFFF !important; }
  }
</style>
</head>
<body class="bg-body" style="margin:0;padding:0;background-color:${tokens.bg};color:${tokens.ink};font-family:${tokens.fontFamily};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">

<!-- Preheader: hidden inbox-preview text -->
<div style="display:none;font-size:1px;color:transparent;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
${escapeHtml(preheader)}
</div>

<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="bg-body" style="background-color:${tokens.bg};">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="container" width="${MAX_WIDTH}" style="width:100%;max-width:${MAX_WIDTH}px;">

        <!-- Header: white band spanning the email canvas width with
             padding around the logo. The white background is fixed
             (not flipped under prefers-color-scheme dark) so the
             official wordmark — which uses a dark slate fill on
             transparent — stays legible across every client. Without
             this band the wordmark rendered as a small dark blob on
             Gmail mobile's auto-inverted background. -->
        <tr>
          <td align="center" class="header-band" style="padding:32px 32px 32px 32px;background-color:#FFFFFF;">
            ${wordmark(kind)}
          </td>
        </tr>
        <!-- Vertical space between header band and body content. -->
        <tr><td style="font-size:0;line-height:0;height:28px;">&nbsp;</td></tr>

        <!-- Body -->
        ${body}

        <!-- Footer -->
        <tr>
          <td class="px-mobile" style="padding:32px 32px 0 32px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-top:1px solid ${tokens.border};" class="border-top">
              <tr>
                <td style="padding:24px 0 8px 0;">
                  <p class="text-ink-3" style="margin:0 0 6px 0;font-family:${tokens.fontFamily};font-size:13px;line-height:1.55;color:${tokens.ink3};">
                    You're getting this because you signed up at <a href="${SITE_URL}" class="text-ink-3" style="color:${tokens.ink3};text-decoration:underline;">havlo.io</a>. Reply <strong style="color:${tokens.ink3};">remove</strong> and we'll take you off the list. Same day, no follow-up.
                  </p>
                  <p class="text-ink-3" style="margin:0;font-family:${tokens.fontFamily};font-size:12px;line-height:1.5;color:${tokens.ink3};">
                    Havlo · havlo.io · Independent price comparison
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

</body>
</html>`;
}

/* Wordmark (text-only, no h-mark). Now rides on a fixed white
   header band — see shellDocument's header <td>. That removes the
   need for a dark-mode logo variant: the dark-slate wordmark sits
   on white in every client mode. Source PNG:
     - logo-email.png   (266x80, dark-slate "havlo" on transparent)

   Wordmark aspect is ~10:3, rendered at:
     marketing shell:  140x42 display
     personal shell:   118x35 display (~16% smaller so a transactional
                                      note doesn't lead with a
                                      brand-loud header)
   2-3x downscale from the 266x80 source keeps the render crisp on
   high-DPI displays at either size. Display dimensions bumped from
   the earlier 100x30 / 84x25 because the white band now provides
   the negative space — the logo can read at a more confident size
   without competing with adjacent typography. */
function wordmark(kind: "marketing" | "personal"): string {
  const displayWidth  = kind === "marketing" ? 140 : 118;
  const displayHeight = kind === "marketing" ? 42  : 35;
  const altText       = "Havlo";
  return `<a href="${SITE_URL}" style="text-decoration:none;border:0;display:inline-block;">
    <img src="${SITE_URL}/logo-email.png" alt="${altText}" width="${displayWidth}" height="${displayHeight}" style="display:inline-block;border:0;outline:none;text-decoration:none;height:${displayHeight}px;width:${displayWidth}px;vertical-align:middle;" />
  </a>`;
}

/* ── Public composers ──────────────────────────────────────────── */

export function shellMarketing(opts: ShellOptions): string {
  return shellDocument({ ...opts, kind: "marketing" });
}

export function shellPersonal(opts: ShellOptions): string {
  return shellDocument({ ...opts, kind: "personal" });
}

/* ── Body components ───────────────────────────────────────────── */

/* H1 — used by the marketing shell. Set in inline styles for client
   compatibility; mobile media query (h1-mobile class) ramps it down
   to 22px on phones to avoid a one-word-per-line headline. */
export function heading1(text: string): string {
  return `<tr>
    <td class="px-mobile" style="padding:0 32px 8px 32px;">
      <h1 class="h1-mobile text-ink" style="margin:0;font-family:${tokens.fontFamily};font-size:28px;line-height:1.2;font-weight:700;letter-spacing:-0.02em;color:${tokens.ink};">
        ${escapeHtml(text)}
      </h1>
    </td>
  </tr>`;
}

/* Eyebrow — small uppercase text above an H1, e.g. date or section
   label. Optional. */
export function eyebrow(text: string): string {
  return `<tr>
    <td class="px-mobile" style="padding:0 32px 6px 32px;">
      <p class="text-ink-3" style="margin:0;font-family:${tokens.fontFamily};font-size:11px;line-height:1.4;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:${tokens.ink3};">
        ${escapeHtml(text)}
      </p>
    </td>
  </tr>`;
}

/* Body paragraph (default — for personal-shell prose). 16px / 1.6
   line-height balances readability and density. */
export function paragraph(html: string): string {
  return `<tr>
    <td class="px-mobile" style="padding:0 32px 16px 32px;">
      <p class="text-ink" style="margin:0;font-family:${tokens.fontFamily};font-size:16px;line-height:1.6;color:${tokens.ink};">
        ${html}
      </p>
    </td>
  </tr>`;
}

/* Signature line — author name + brand on a second line. */
export function signature(name: string): string {
  return `<tr>
    <td class="px-mobile" style="padding:8px 32px 0 32px;">
      <p style="margin:0;font-family:${tokens.fontFamily};font-size:16px;line-height:1.6;">
        <span class="text-ink" style="color:${tokens.ink};font-weight:600;">${escapeHtml(name)}</span>
        <br />
        <span class="text-ink-3" style="color:${tokens.ink3};">Havlo</span>
      </p>
    </td>
  </tr>`;
}

/* Spacer — visual breathing room. Use 16/24/32/48 (matches the web
   app's 4pt baseline). */
export function spacer(px: number): string {
  return `<tr><td style="font-size:0;line-height:0;height:${px}px;">&nbsp;</td></tr>`;
}

/* Bulletproof CTA button — table-based for Outlook compatibility.

   First-shipped pattern put `padding` on the inner <a> with
   `display:inline-block`. User reported (May 2026) the button
   collapsing to a tight purple pill in Gmail mobile — turns out
   Gmail's mobile renderer strips `display:inline-block` from
   anchors, which made the padding ineffective and the link rendered
   as a regular tappable text link with the user-agent highlight
   colour. The fix below moves the visual padding onto the <td>
   itself, where it's not stripped, so the anchor can stay a plain
   `text-decoration:none` link. Now:
     - <td> carries: background-color, border-radius, padding,
                     mso-padding-alt (Outlook backup)
     - <a> carries:  font-family, font-size, font-weight, color,
                     text-decoration:none
   Both colors are explicit so Gmail's link-color override (which
   defaults to its theme link blue) can't override the white text. */
export function button(opts: { url: string; label: string; align?: "left" | "center" }): string {
  const align = opts.align ?? "center";
  return `<tr>
    <td class="px-mobile" align="${align}" style="padding:8px 32px 24px 32px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;">
        <tr>
          <td align="center" bgcolor="${tokens.brand}" style="background-color:${tokens.brand};border-radius:8px;padding:14px 28px;mso-padding-alt:14px 28px;">
            <a href="${escapeAttr(opts.url)}" style="font-family:${tokens.fontFamily};font-size:15px;font-weight:600;line-height:1;color:#FFFFFF;text-decoration:none;">
              <span style="color:#FFFFFF;text-decoration:none;">${escapeHtml(opts.label)}</span>
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

/* Deal card — used by the newsletter digest. Stack of title, price
   row, store name, View-deal link. Subtle surface background +
   1px border so the card reads as a discrete unit at thumbnail
   scroll speed.

   Whole card wraps a single anchor so the entire surface is the
   click target — a common touch-screen pattern. Outlook ignores
   anchor-wraps-block, but the inner anchors keep the title and
   button tappable there. */
export interface DealCardData {
  title:           string;
  priceDisplay:    string;
  originalDisplay: string | null;
  discountPercent: number;
  storeName:       string;
  url:             string;
}

export function dealCard(d: DealCardData): string {
  const hasOriginal  = !!d.originalDisplay;
  const hasDiscount  = d.discountPercent > 0;

  /* Price row. Was originally `current_price ~~original_price~~ N% off`
     with the original price strikethrough; a user reported the strike
     was hard to parse on Gmail mobile dark mode ("I see two prices
     side by side and can't tell which is the deal"). New format leads
     with the explicit "was" label so the relationship is unambiguous
     in every email client regardless of how text-decoration renders.

     "₦425,000  was ₦525,000  · 19% off"
       │              │            │
       │              │            └─ pill, success green
       │              └─────────── ink-3 (subdued) with "was" prefix
       └──────────────────────────── primary, ink, bold */
  const priceRow = `
    <span style="font-family:${tokens.fontFamily};font-size:18px;font-weight:700;color:${tokens.ink};letter-spacing:-0.01em;" class="text-ink">${escapeHtml(d.priceDisplay)}</span>
    ${hasOriginal
      ? `<span style="font-family:${tokens.fontFamily};font-size:13px;color:${tokens.ink3};margin-left:10px;" class="text-ink-3">was ${escapeHtml(d.originalDisplay!)}</span>`
      : ""}
    ${hasDiscount
      ? `<span style="display:inline-block;font-family:${tokens.fontFamily};font-size:12px;font-weight:600;color:${tokens.success};background-color:${tokens.successBg};padding:3px 8px;border-radius:999px;margin-left:10px;vertical-align:middle;">${d.discountPercent}% off</span>`
      : ""}`;

  return `<tr>
    <td class="px-mobile" style="padding:0 32px 12px 32px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="bg-card border" style="background-color:${tokens.surface};border:1px solid ${tokens.border};border-radius:12px;">
        <tr>
          <td style="padding:18px 20px;">
            <p style="margin:0 0 8px 0;font-family:${tokens.fontFamily};font-size:15px;line-height:1.35;font-weight:600;color:${tokens.ink};" class="text-ink">
              <a href="${escapeAttr(d.url)}" style="color:${tokens.ink};text-decoration:none;" class="text-ink">${escapeHtml(d.title)}</a>
            </p>
            <p style="margin:0 0 6px 0;line-height:1.4;">${priceRow}</p>
            <p style="margin:0 0 12px 0;font-family:${tokens.fontFamily};font-size:13px;line-height:1.4;color:${tokens.ink2};" class="text-ink-2">
              at <span style="color:${tokens.ink};font-weight:500;" class="text-ink">${escapeHtml(d.storeName)}</span>
            </p>
            <a href="${escapeAttr(d.url)}" style="font-family:${tokens.fontFamily};font-size:13px;font-weight:600;color:${tokens.brand};text-decoration:none;" class="text-brand">
              View deal &rarr;
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

/* Match-result row — leaner than dealCard, used by notify-product-
   match. Price + title + store on one bordered row, no card chrome.
   Matches the personal-shell density (we don't want a marketing-y
   card grid inside a transactional notification). */
export interface MatchRowData {
  title:     string;
  priceDisplay: string;
  storeName: string;
  url:       string;
}

export function matchRow(o: MatchRowData, isLast: boolean): string {
  return `<tr>
    <td class="px-mobile" style="padding:0 32px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-bottom:${isLast ? "0" : `1px solid ${tokens.border}`};" class="border-top">
        <tr>
          <td style="padding:14px 0;">
            <p style="margin:0 0 4px 0;font-family:${tokens.fontFamily};font-size:15px;line-height:1.4;font-weight:600;">
              <a href="${escapeAttr(o.url)}" style="color:${tokens.ink};text-decoration:none;" class="text-ink">${escapeHtml(o.title)}</a>
            </p>
            <p style="margin:0;font-family:${tokens.fontFamily};font-size:14px;line-height:1.4;" class="text-ink-2">
              <span style="color:${tokens.ink};font-weight:600;" class="text-ink">${escapeHtml(o.priceDisplay)}</span>
              <span style="color:${tokens.ink3};margin:0 6px;" class="text-ink-3">&middot;</span>
              <span style="color:${tokens.ink2};" class="text-ink-2">${escapeHtml(o.storeName)}</span>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

/* Text-link — for inline "browse what's already in today" style
   nudges in personal shells. Subtle, not a marketing button. */
export function textLink(opts: { url: string; label: string }): string {
  return `<a href="${escapeAttr(opts.url)}" style="color:${tokens.brand};text-decoration:underline;text-underline-offset:2px;" class="text-brand">${escapeHtml(opts.label)}</a>`;
}

/* ── Plain-text helpers ────────────────────────────────────────── */

/* Wraps a body in the standard plain-text footer (signature +
   unsubscribe note) so every plain-text alternative reads the same
   sign-off. */
export function plainTextShell(opts: { body: string[]; signoff?: string }): string {
  const sig = opts.signoff ?? "Daniel";
  return [
    `Hi,`,
    ``,
    ...opts.body,
    ``,
    sig,
    `Havlo`,
    ``,
    `--`,
    `You're getting this because you signed up at havlo.io.`,
    `Reply "remove" to unsubscribe.`,
  ].join("\n");
}
