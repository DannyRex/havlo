"use client";

/* Barcode-scan client island for /scan.

   Three branches at runtime:
     1. BarcodeDetector API is available → render live camera +
        detection loop. On hit, fetch /api/lookup-gtin and route.
     2. BarcodeDetector unavailable (Safari iOS, older browsers) →
        render manual GTIN entry form. Same lookup, no camera.
     3. Camera permission denied → fall back to manual entry with
        a "we can't access your camera" banner.

   Detection loop runs at 5fps (200ms interval) — fast enough to
   feel instant, light enough to not pin the CPU. The detect call
   uses `formats: ["ean_13", "ean_8", "upc_a", "upc_e"]` since
   those cover ~99% of retail barcodes. QR codes are intentionally
   not in the list — we don't want to fire a lookup on a Cloudflare
   QR poster the user accidentally aimed at.

   After a successful detect, we:
     • Stop the camera (saves battery)
     • Show the captured GTIN + a spinner
     • Hit /api/lookup-gtin
     • Route to the resolved URL */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CameraOff, Search, X, AlertCircle } from "lucide-react";

/* BarcodeDetector is not in lib.dom.d.ts. Minimal local type to
   appease TS without adding a dep. */
interface DetectedBarcode {
  rawValue: string;
  format:   string;
}
interface BarcodeDetectorClass {
  new (opts?: { formats?: string[] }): {
    detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>;
  };
}

type Phase =
  | "idle"
  | "scanning"
  | "detected"
  | "looking-up"
  | "miss"
  | "error";

const RETAIL_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

export default function ScanClient() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<{ detect: (s: HTMLVideoElement) => Promise<DetectedBarcode[]> } | null>(null);
  const loopRef = useRef<number | null>(null);

  const [phase, setPhase]       = useState<Phase>("idle");
  const [gtin, setGtin]         = useState<string>("");
  const [manualGtin, setManualGtin] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasDetector, setHasDetector] = useState<boolean | null>(null);

  /* Capability check — runs once on mount. setHasDetector(null) =
     uncertain (SSR), true = supported, false = manual-only. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorClass }).BarcodeDetector;
    setHasDetector(!!Detector);
  }, []);

  /* Cleanup — stop stream + cancel loop when component unmounts. */
  useEffect(() => {
    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startScanner() {
    setErrorMsg(null);
    setPhase("scanning");

    try {
      const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorClass }).BarcodeDetector;
      if (!Detector) throw new Error("BarcodeDetector unsupported");

      /* Rear camera preferred for product scanning. facingMode is
         best-effort; some browsers ignore it and pick the front
         camera anyway, which still works just less ergonomically. */
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;

      if (!videoRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        throw new Error("Video element not ready");
      }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      detectorRef.current = new Detector({ formats: RETAIL_FORMATS });

      /* Detection loop. setInterval not requestAnimationFrame because
         we don't need 60fps — barcode detection at 5fps feels instant
         and saves battery on mobile. */
      loopRef.current = window.setInterval(scanFrame, 200);
    } catch (err) {
      const msg = (err as Error).message;
      if (/Permission|denied|NotAllowedError/i.test(msg)) {
        setErrorMsg("Camera access was blocked. Enter the barcode below instead.");
      } else if (/unsupported|undefined/i.test(msg)) {
        setErrorMsg("Your browser doesn't support live scanning. Enter the barcode below.");
      } else {
        setErrorMsg("Couldn't start the camera. Enter the barcode below.");
      }
      setPhase("error");
    }
  }

  function stopScanner() {
    if (loopRef.current !== null) {
      window.clearInterval(loopRef.current);
      loopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  async function scanFrame() {
    if (!detectorRef.current || !videoRef.current) return;
    try {
      const codes = await detectorRef.current.detect(videoRef.current);
      if (codes.length > 0) {
        const raw = codes[0].rawValue;
        stopScanner();
        setGtin(raw);
        setPhase("detected");
        /* Brief pause so the user can see the captured GTIN
           before we navigate — feels like confirmation, not a
           magic teleport. */
        setTimeout(() => lookup(raw), 600);
      }
    } catch {
      /* Detect throws on some frames during initialisation. Silent
         catch keeps the loop going. */
    }
  }

  async function lookup(g: string) {
    setPhase("looking-up");
    try {
      const res = await fetch(`/api/lookup-gtin?gtin=${encodeURIComponent(g)}`);
      const json = await res.json() as { redirect?: string; ok: boolean };
      if (json.ok && json.redirect) {
        router.push(json.redirect);
        return;
      }
      setPhase("miss");
    } catch {
      setErrorMsg("Couldn't look up that code. Try again?");
      setPhase("error");
    }
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    const cleaned = manualGtin.replace(/\D/g, "");
    if (cleaned.length < 8 || cleaned.length > 14) {
      setErrorMsg("Barcodes are 8 to 14 digits. Check the number and try again.");
      return;
    }
    setGtin(cleaned);
    lookup(cleaned);
  }

  /* ── Render ────────────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* Live scanner area — shows when scanning, hidden otherwise */}
      {phase === "scanning" && (
        <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3] sm:aspect-video">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {/* Aim guide — centred rectangle hint */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-3/4 h-1/3 border-2 border-white/80 rounded-xl" style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)" }} />
          </div>
          <button
            type="button"
            onClick={() => { stopScanner(); setPhase("idle"); }}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur"
            aria-label="Stop scanning"
          >
            <X size={18} />
          </button>
          <p className="absolute bottom-3 left-0 right-0 text-center text-white text-xs px-4">
            Aim at the barcode. We&apos;ll detect it automatically.
          </p>
        </div>
      )}

      {/* Detected GTIN + lookup progress */}
      {(phase === "detected" || phase === "looking-up") && (
        <div className="rounded-2xl border border-success/20 bg-success/5 p-5 text-center">
          <div className="inline-flex w-10 h-10 rounded-full bg-success/15 items-center justify-center mb-3">
            <Search size={18} className="text-success" />
          </div>
          <p className="text-sm text-ink-2 mb-1">Scanned</p>
          <p className="text-lg font-mono font-semibold text-ink mb-3">{gtin}</p>
          <p className="text-xs text-ink-3">Looking up&hellip;</p>
        </div>
      )}

      {/* Miss state */}
      {phase === "miss" && (
        <div className="rounded-2xl border border-border bg-surface-2/40 p-5">
          <div className="flex items-start gap-3 mb-3">
            <AlertCircle size={18} className="text-ink-3 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-base font-semibold text-ink mb-1">We don&apos;t have that one yet</h3>
              <p className="text-sm text-ink-2 leading-relaxed">
                We didn&apos;t find <span className="font-mono text-ink">{gtin}</span> in our
                catalogue. Try searching by the product&apos;s name instead.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <button
              type="button"
              onClick={() => router.push(`/compare?q=${encodeURIComponent(gtin)}`)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-ink text-bg font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              Search by code
            </button>
            <button
              type="button"
              onClick={() => { setPhase("idle"); setGtin(""); setManualGtin(""); }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full border border-border-strong text-ink font-medium text-sm hover:bg-surface-2 transition-colors"
            >
              Try another
            </button>
          </div>
        </div>
      )}

      {/* Idle / error → start button + manual entry */}
      {(phase === "idle" || phase === "error") && (
        <>
          {hasDetector ? (
            <button
              type="button"
              onClick={startScanner}
              className="w-full px-5 py-4 rounded-2xl bg-ink text-bg font-semibold text-base hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <Camera size={20} />
              Start camera scan
            </button>
          ) : hasDetector === false ? (
            <div className="rounded-xl border border-border bg-surface-2/40 p-4 flex items-start gap-3">
              <CameraOff size={18} className="text-ink-3 mt-0.5 shrink-0" />
              <div className="text-sm text-ink-2 leading-relaxed">
                <p className="font-medium text-ink mb-0.5">Camera scanning isn&apos;t supported here</p>
                <p>iOS Safari and some older browsers can&apos;t scan from the web. Enter the barcode number manually below.</p>
              </div>
            </div>
          ) : null}

          {errorMsg && (
            <div className="rounded-xl border border-error/20 bg-error/5 p-3 flex items-start gap-2 text-sm text-error">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleManualSubmit} className="space-y-3">
            <label className="block">
              <span className="text-sm font-medium text-ink-2 block mb-1.5">
                Or enter the barcode number
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={manualGtin}
                onChange={(e) => setManualGtin(e.target.value)}
                placeholder="e.g. 0194253775647"
                className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-base text-ink font-mono placeholder:text-ink-3 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-ink/20"
              />
            </label>
            <button
              type="submit"
              className="w-full px-4 py-3 rounded-full border border-border-strong text-ink font-semibold text-sm hover:bg-surface-2 transition-colors flex items-center justify-center gap-2"
            >
              <Search size={16} />
              Look up
            </button>
          </form>
        </>
      )}
    </div>
  );
}
