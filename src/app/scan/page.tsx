/* /scan — barcode scanner entry point.

   Audience: in-store shoppers comparing prices. The flow:
     1. Land on /scan
     2. Grant camera permission (mobile)
     3. Aim at a product barcode
     4. We scan the GTIN, look it up in products.gtin
     5. Found → redirect to the product's cheapest PDP
     6. Miss → search by the GTIN as a fallback query

   Why server-render the shell + client-island the scanner:
     • SEO + share preview need static metadata.
     • The scanner is camera + permissions + worker-heavy — pure
       client surface, no server work.

   Browser support strategy (v1):
     • Native BarcodeDetector API — Chrome Android, Edge Android,
       Chrome on macOS. About 60% of mobile shoppers.
     • Manual GTIN entry — universal fallback. Power-user-grade,
       but works on iOS Safari + every desktop.
     • @zxing/library polyfill — DEFERRED to v2. Adds ~600KB to the
       client bundle for the ~40% of mobile not on Chrome. We'll add
       it once we see real /scan traffic justify the bundle cost.

   Why no native iOS path: Apple has refused to ship BarcodeDetector
   for years. The workarounds are all WASM polyfills with similar
   bundle penalties. v1 punts on iOS camera scan; iOS users get the
   manual entry path which is honest about the limitation. */

import type { Metadata } from "next";
import ScanClient from "@/components/scan/ScanClient";

const SITE_URL = "https://havlo.io";

export const metadata: Metadata = {
  title: "Scan a barcode · Compare prices anywhere",
  description:
    "Aim your phone at any product barcode and Havlo finds the same product across stores. Compare prices in seconds, in-store or online.",
  alternates: { canonical: "/scan" },
  openGraph: {
    title: "Scan a barcode · Havlo",
    description: "Aim your phone at a product barcode. Havlo finds the same product cheaper across stores.",
    url: `${SITE_URL}/scan`,
    type: "website",
  },
  /* No robots: noindex here. /scan is publicly useful AND can drive
     external links ("scan a barcode at Tesco, compare on Havlo"). */
};

export default function ScanPage() {
  return (
    <main className="bg-bg min-h-[80vh]">
      <section className="max-w-xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <header className="mb-6 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 mb-2">
            In-store mode
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-[-0.025em] mb-3">
            Scan a barcode
          </h1>
          <p className="text-ink-2 text-[14px] sm:text-[15px] leading-relaxed">
            Aim your phone at any product barcode. We&apos;ll find the same
            product across stores so you can compare in real time.
          </p>
        </header>

        <ScanClient />
      </section>
    </main>
  );
}
