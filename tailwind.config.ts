import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:    ["var(--font-inter)", "Inter", "system-ui", "-apple-system", "Segoe UI", "Helvetica", "Arial", "sans-serif"],
        display: ["var(--font-display)", "Bricolage Grotesque", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        // Brand
        brand: {
          DEFAULT: "#0057FF",
          hover:   "#0041CC",
          subtle:  "rgba(0, 87, 255, 0.08)",
        },
        // Semantic surfaces (use bg-bg, bg-surface, etc.)
        bg:           "rgb(var(--bg-rgb) / <alpha-value>)",
        surface:      "rgb(var(--surface-rgb) / <alpha-value>)",
        "surface-2":  "rgb(var(--surface-2-rgb) / <alpha-value>)",
        border:       "rgb(var(--border-rgb) / <alpha-value>)",
        "border-strong": "rgb(var(--border-strong-rgb) / <alpha-value>)",
        // Semantic text
        ink:          "rgb(var(--ink-rgb) / <alpha-value>)",
        "ink-2":      "rgb(var(--ink-2-rgb) / <alpha-value>)",
        "ink-3":      "rgb(var(--ink-3-rgb) / <alpha-value>)",
        // Status
        /* Vibrant deal-green, mode-aware via --success-rgb (globals.css):
           green-600 (22 163 74) on light, green-400 (74 222 128) on dark,
           matching the price + verified badges. Vibrance restored May 2026
           after a WCAG-driven green-800 value read as muted/damp. `subtle`
           is the 10% fill, now also mode-aware. */
        success: { DEFAULT: "rgb(var(--success-rgb) / <alpha-value>)", subtle: "rgb(var(--success-rgb) / 0.1)" },
        danger:  { DEFAULT: "#dc2626", subtle: "rgba(220, 38, 38, 0.10)" },
        warn:    { DEFAULT: "#ca8a04", subtle: "rgba(202, 138, 4, 0.10)" },
      },
      boxShadow: {
        card:        "0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)",
        "card-hover":"0 4px 14px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(15, 23, 42, 0.04)",
        "brand":     "0 6px 20px rgba(0, 87, 255, 0.20)",
        "input":     "0 0 0 4px rgba(0, 87, 255, 0.10)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      animation: {
        shimmer:  "shimmer 2s linear infinite",
        "fade-up":"fadeUp 0.5s ease-out both",
        "fade-in":"fadeIn 0.4s ease-out both",
      },
      keyframes: {
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        fadeUp: {
          "0%":   { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
