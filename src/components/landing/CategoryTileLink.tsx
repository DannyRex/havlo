"use client";

/* Client wrapper around next/link for category tiles on the
   homepage CategoryGrid. Fires `category_click` GA4 event before
   navigation so the analytics call has full click context (no race
   between page-leave + event-flush).

   Server-component CategoryGrid renders these as drop-in replacements
   for <Link> with the same href + className API surface. The tile
   visual treatment stays in CategoryGrid; this wrapper is purely
   for the click-tracking + navigation coupling. */

import Link from "next/link";
import { useCountry } from "@/components/providers/CountryProvider";
import { track } from "@/lib/analytics";
import type { ReactNode } from "react";

interface Props {
  href:      string;
  className: string;
  category:  string;       // category slug — surfaced in the GA4 event
  position:  number;       // 0-indexed, for funnel + tile-position analysis
  children:  ReactNode;
}

export default function CategoryTileLink({ href, className, category, position, children }: Props) {
  const { country } = useCountry();
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        track({
          name: "category_click",
          props: {
            category,
            surface:  "homepage",
            position,
            country:  country.code,
          },
        });
      }}
    >
      {children}
    </Link>
  );
}
