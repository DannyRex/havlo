"use client";

/* Search-by-image control.

   Upload a product image → POST /api/image-search → on a confident
   perceptual-hash match, route to the cross-store comparison for that
   product (/compare?pid=…). The whole match is the local dHash
   algorithm; no image leaves for a paid vision API.

   Honesty baked into the copy: dHash matches near-identical images —
   a screenshot, a saved product photo, a press image — not a fresh
   camera snap of the item on your desk. The no-match message says so
   instead of pretending the miss was the user's fault.

   Two visual variants:
     • "hero"    — quiet inline text+icon for the homepage composer
                   footer (sits where the old "Image search · soon"
                   affordance was).
     • "compare" — a pill button for the /compare toolbar. */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Loader2 } from "lucide-react";

interface Props {
  /** ISO-2 country code used to build the /compare destination. */
  countryCode: string;
  variant?: "hero" | "compare";
  className?: string;
}

type Status =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "error"; message: string };

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const NO_MATCH_MESSAGE =
  "No match in our catalog. Image search works best with a product screenshot or saved photo, not a camera snap.";

export default function ImageSearchButton({ countryCode, variant = "hero", className = "" }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const uploading = status.kind === "uploading";

  const openPicker = () => {
    if (uploading) return;
    inputRef.current?.click();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    /* Reset the input value so picking the SAME file again still
       fires onChange (browsers suppress a repeat-selection event). */
    e.target.value = "";
    if (!file) return;

    if (file.type && !file.type.startsWith("image/")) {
      setStatus({ kind: "error", message: "That is not an image file." });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setStatus({ kind: "error", message: "Image is too large (5MB max)." });
      return;
    }

    setStatus({ kind: "uploading" });
    try {
      const body = new FormData();
      body.append("image", file);
      const res = await fetch("/api/image-search", { method: "POST", body });
      const data = (await res.json().catch(() => null)) as
        | { match?: { productId?: string; title?: string } | null; error?: string }
        | null;

      if (res.ok && data?.match?.productId) {
        const params = new URLSearchParams({
          q:    data.match.title ?? "",
          pid:  data.match.productId,
          mode: "similar",
        });
        router.push(`/${countryCode}/compare?${params.toString()}`);
        /* Reset so the control is ready again. On the homepage the
           component unmounts with the navigation; on /compare it stays
           mounted (same route, new query) so without this the spinner
           would hang. The destination's own loading state carries the
           feedback from here. */
        setStatus({ kind: "idle" });
        return;
      }

      setStatus({
        kind: "error",
        message: data?.error && res.status !== 200 ? data.error : NO_MATCH_MESSAGE,
      });
    } catch {
      setStatus({ kind: "error", message: "Image search is unavailable right now." });
    }
  };

  const hiddenInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      onChange={onFile}
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
    />
  );

  if (variant === "compare") {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={openPicker}
          disabled={uploading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-surface-2 text-sm font-medium text-ink-2 hover:border-border-strong hover:text-ink transition-colors disabled:opacity-70"
        >
          {uploading ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <ImageUp size={16} aria-hidden="true" />
          )}
          {uploading ? "Matching image…" : "Search by image"}
        </button>
        {status.kind === "error" && (
          <p className="mt-2 text-xs text-ink-3 leading-snug max-w-sm" role="status">
            {status.message}
          </p>
        )}
        {hiddenInput}
      </div>
    );
  }

  /* hero variant */
  return (
    <div className={`min-w-0 ${className}`}>
      <button
        type="button"
        onClick={openPicker}
        disabled={uploading}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-3 hover:text-brand transition-colors disabled:opacity-70"
      >
        {uploading ? (
          <Loader2 size={14} className="animate-spin shrink-0" aria-hidden="true" />
        ) : (
          <ImageUp size={14} className="shrink-0" aria-hidden="true" />
        )}
        {uploading ? "Matching image…" : "Search by image"}
      </button>
      {status.kind === "error" && (
        <p className="mt-1.5 text-[11px] text-ink-3 leading-snug" role="status">
          {status.message}
        </p>
      )}
      {hiddenInput}
    </div>
  );
}
