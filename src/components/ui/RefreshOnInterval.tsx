"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Mounts a quiet interval that calls `router.refresh()` every `ms`
 * milliseconds. router.refresh() in the App Router re-fetches server
 * component data for the current route without losing client state —
 * perfect for "live-feeling" sections (rotating trending picks, etc.)
 * without a full page reload.
 *
 * Renders nothing.
 */
export default function RefreshOnInterval({ ms }: { ms: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), ms);
    return () => clearInterval(id);
  }, [router, ms]);
  return null;
}
