import { BadgeCheck } from "lucide-react";
import type { MerchantTrust } from "@/lib/merchant-trust";

/* Subtle POSITIVE trust cue for curated, link-verified retailers
   (merchant-trust.ts). Renders nothing for lesser-known stores - they
   are not penalised, and the absence of a badge is a quiet, honest
   cue rather than a warning. The label is deliberately "Verified"
   (the SITE is verified), never an endorsement or purchase guarantee.

   Two shapes share one source of copy so /compare and the PDP can't
   drift:
     • compact (default) - icon only, for the dense /compare store
       rows. The store name sits right beside it, so the badge reads
       as "this store is verified" without spending a row's width.
     • pill - icon + "Verified" label in a rounded pill that matches
       the PDP eyebrow's store / brand / International pills.

   Pure presentational: takes the precomputed `trust` enum (resolved
   server-side) so the heavy MERCHANTS table never enters the client
   bundle. The MerchantTrust import is type-only and erased at build. */

const VERIFIED_TITLE = "We've verified this retailer's official website";

export default function MerchantVerifiedChip({
  trust,
  variant = "compact",
}: {
  trust: MerchantTrust | undefined;
  variant?: "compact" | "pill";
}) {
  if (trust !== "established") return null;

  if (variant === "pill") {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-2 text-[12px] text-ink-2"
        title={VERIFIED_TITLE}
      >
        <BadgeCheck size={12} className="text-success" aria-hidden="true" />
        <span>Verified</span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex shrink-0"
      title={VERIFIED_TITLE}
      aria-label="Verified retailer site"
    >
      <BadgeCheck size={13} strokeWidth={2} className="text-success/80" aria-hidden="true" />
    </span>
  );
}
