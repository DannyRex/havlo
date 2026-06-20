/* The accessibility statement has moved INTO the Terms of Use (the
   "Accessibility", "Accessibility: known limitations", and "Reporting an
   accessibility barrier" sections), merged June 2026. This route now
   permanently redirects there so existing links, bookmarks, the footer, and
   the EAA-required statement URL all still resolve.

   Conformance is still SELF-DECLARED (WCAG 2.1 AA, no third-party audit yet).
   The "swap self-assessed to audited" note now lives in the Terms of Use page
   comment. */

import { permanentRedirect } from "next/navigation";

export default function AccessibilityPage() {
  permanentRedirect("/terms-of-use#accessibility");
}
