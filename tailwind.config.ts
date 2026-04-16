import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#0057FF",
          700: "#0041CC",
          800: "#002B99",
          900: "#001A66",
        },
        navy: {
          900: "#050B18",
          800: "#0A1428",
          700: "#0F1E3D",
          600: "#152652",
        },
        deal: {
          orange: "#FF6B35",
          red:    "#FF3333",
          green:  "#00D68F",
          cyan:   "#00C8FF",
          yellow: "#FFD600",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "hero-gradient":
          "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(0,87,255,0.35) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 90% 40%, rgba(0,200,255,0.15) 0%, transparent 50%), linear-gradient(180deg, #050B18 0%, #0A1428 100%)",
        "card-gradient":
          "linear-gradient(135deg, rgba(15,30,61,0.8) 0%, rgba(10,20,40,0.9) 100%)",
        "blue-glow":
          "radial-gradient(ellipse at center, rgba(0,87,255,0.2) 0%, transparent 70%)",
        "orange-badge":
          "linear-gradient(135deg, #FF6B35 0%, #FF3333 100%)",
        "cyan-badge":
          "linear-gradient(135deg, #00C8FF 0%, #0057FF 100%)",
        "green-badge":
          "linear-gradient(135deg, #00D68F 0%, #00A86B 100%)",
      },
      boxShadow: {
        "brand-glow": "0 0 40px rgba(0,87,255,0.25)",
        "card-hover":  "0 20px 60px rgba(0,87,255,0.15)",
        "deal-card":   "0 4px 24px rgba(0,0,0,0.4)",
      },
      animation: {
        "float":       "float 6s ease-in-out infinite",
        "pulse-slow":  "pulse 4s cubic-bezier(0.4,0,0.6,1) infinite",
        "slide-up":    "slideUp 0.5s ease-out",
        "fade-in":     "fadeIn 0.6s ease-out",
        "shimmer":     "shimmer 2s linear infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":       { transform: "translateY(-12px)" },
        },
        slideUp: {
          "0%":   { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
