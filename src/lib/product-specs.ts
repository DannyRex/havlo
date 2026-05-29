/* Server-side display-spec extractor.

   Pulled out of ProductAbout.tsx after the May 29 2026 build failure:
   ProductAbout is a client component (it owns the Read-more toggle
   state), but it was importing buildSignature from @/lib/search/normalize,
   which loads an optional ai-search dataset via Node's fs at module
   init. fs isn't available in the browser bundle, so the client
   import broke `next build` with "Module not found: Can't resolve 'fs'".

   Fix: do the parsing on the server (PDP page is a Server Component
   already calling Promise.all and the rest of the heavy work), pass
   the resulting spec array as a plain serialisable prop to the
   client component. The client side just maps + renders, no parsing
   needed.

   This module is the seam. Server-safe, no client bundling, calls
   into normalize freely. */

import { buildSignature } from "@/lib/search/normalize";

export interface DisplaySpec {
  label: string;
  value: string;
}

/* Returns the displayable specs parsed from a product title. Empty
   array when nothing extractable — caller hides the chip row in
   that case. Range guards prevent false positives the regex would
   otherwise let through (e.g. an "8GB RAM" parsed as 0.008 TB
   storage, a shoe size accidentally hitting the inches regex). */
export function extractDisplaySpecs(title: string): DisplaySpec[] {
  const sig = buildSignature(title);
  const out: DisplaySpec[] = [];

  if (sig.storageGb !== null && sig.storageGb >= 8) {
    out.push({
      label: "Storage",
      value: sig.storageGb >= 1024 ? `${sig.storageGb / 1024} TB` : `${sig.storageGb} GB`,
    });
  }
  if (sig.ramGb !== null && sig.ramGb >= 2) {
    out.push({ label: "RAM", value: `${sig.ramGb} GB` });
  }
  if (sig.inches !== null && sig.inches >= 3 && sig.inches <= 100) {
    out.push({ label: "Display", value: `${sig.inches}"` });
  }
  if (sig.color) {
    out.push({
      label: "Colour",
      value: sig.color.charAt(0).toUpperCase() + sig.color.slice(1),
    });
  }
  return out;
}

/* Returns the best-available brand for display purposes. Prefers
   the explicit DB column (products.brand), falls back to the
   signature-parsed brand when the DB column is null — which happens
   for old rows ingested before the May 2026 persist-brand fix.
   Lowercased; downstream brandDisplay() handles the casing. */
export function resolveBrand(
  offerBrand: string | null,
  title: string,
): string | null {
  if (offerBrand && offerBrand.trim().length > 0) return offerBrand;
  const sig = buildSignature(title);
  return sig.brand;
}
