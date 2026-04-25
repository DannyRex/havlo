/* ──────────────────────────────────────────────────────────────────
   Hand-drawn line icons — single 1.6px stroke, currentColor.
   Designed to feel less generic than lucide and more like the
   illustrated icons dupe.com uses in its menu. Inline SVG so there's
   no extra dependency.
   ────────────────────────────────────────────────────────────────── */

type IconProps = { size?: number; className?: string };

const baseProps = (size = 18) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
});

export function PhoneIcon({ size, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <rect x="7" y="2.5" width="10" height="19" rx="2" />
      <path d="M10.5 5.5h3" />
      <path d="M11 18.5h2" />
    </svg>
  );
}

export function LaptopIcon({ size, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <rect x="4" y="4" width="16" height="11" rx="1.2" />
      <path d="M2 18h20l-1.2 2.2a1 1 0 01-.9.5H4.1a1 1 0 01-.9-.5L2 18z" />
      <path d="M10 18h4" />
    </svg>
  );
}

export function SneakerIcon({ size, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M2.5 17c0-1.6 1-3 2.5-3.7l4.5-2 1 1.7h2l1.5-1.5 5 .5c2 .2 3.5 1.4 3.5 3v2.5c0 .8-.6 1.5-1.5 1.5H4c-.8 0-1.5-.7-1.5-1.5z" />
      <path d="M9.5 11.3l1-1.5M14 11.5l-1-1.7" />
      <path d="M5 19v.8M9 19v.8M13 19v.8M17 19v.8" />
    </svg>
  );
}

export function EarbudsIcon({ size, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M7 4.5a2.5 2.5 0 012.5 2.5v3.5a2.5 2.5 0 11-5 0V7A2.5 2.5 0 017 4.5z" />
      <path d="M7 13.5v6" />
      <path d="M17 4.5A2.5 2.5 0 0114.5 7v3.5a2.5 2.5 0 105 0V7A2.5 2.5 0 0017 4.5z" />
      <path d="M17 13.5v6" />
    </svg>
  );
}

export function TvIcon({ size, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <rect x="2.5" y="4" width="19" height="12.5" rx="1.5" />
      <path d="M8 20h8" />
      <path d="M12 16.5V20" />
    </svg>
  );
}

export function HomeIcon({ size, className }: IconProps) {
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M3.5 11l8.5-7.5L20.5 11v8.5a1 1 0 01-1 1h-15a1 1 0 01-1-1z" />
      <path d="M9.5 20.5v-6h5v6" />
    </svg>
  );
}

export function FashionIcon({ size, className }: IconProps) {
  /* T-shirt */
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M8.5 3.5L4 6.5l1.6 2.6L8 7.7v12.6h8V7.7l2.4 1.4L20 6.5l-4.5-3" />
      <path d="M9.5 3.5a2.5 2.5 0 005 0" />
    </svg>
  );
}

export function BeautyIcon({ size, className }: IconProps) {
  /* Lipstick */
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M10 3.5l2-1 2 1v6.5h-4z" />
      <rect x="8.5" y="10" width="7" height="11" rx="1" />
      <path d="M8.5 14h7" />
    </svg>
  );
}

export function GamingIcon({ size, className }: IconProps) {
  /* Controller */
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M6 7.5h12c2.2 0 4 1.8 4 4v3a2.5 2.5 0 01-4.4 1.6l-2-2.4H8.4l-2 2.4A2.5 2.5 0 012 14.5v-3c0-2.2 1.8-4 4-4z" />
      <path d="M8.5 11v2.5M7.25 12.25h2.5" />
      <circle cx="15.5" cy="11.5" r="0.6" fill="currentColor" />
      <circle cx="17" cy="13" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function FurnitureIcon({ size, className }: IconProps) {
  /* Couch */
  return (
    <svg {...baseProps(size)} className={className}>
      <path d="M4 12V8.5a2 2 0 012-2h12a2 2 0 012 2V12" />
      <path d="M3 13.5a2 2 0 012-2h14a2 2 0 012 2V17a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17z" />
      <path d="M5 18.5v1.5M19 18.5v1.5" />
    </svg>
  );
}
