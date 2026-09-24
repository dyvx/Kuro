import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // KURO design system — deep cinematic darks with violet/crimson accents
        ink: {
          950: "#06060a",
          900: "#0a0a10",
          850: "#0e0e16",
          800: "#13131d",
          700: "#1a1a27",
          600: "#24243300",
        },
        surface: {
          DEFAULT: "#101018",
          raised: "#161622",
          overlay: "#1c1c2a",
        },
        line: {
          DEFAULT: "rgba(255,255,255,0.08)",
          strong: "rgba(255,255,255,0.14)",
        },
        primary: {
          50: "#f3eefe",
          100: "#e6dcfd",
          200: "#cfbcfa",
          300: "#b295f6",
          400: "#9a74f0",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6b28d9",
          800: "#5a21b4",
          900: "#4b1d94",
        },
        crimson: {
          400: "#fb5f7d",
          500: "#f11d52",
          600: "#d81545",
        },
        txt: {
          DEFAULT: "#f4f4f8",
          muted: "#9c9cb4",
          faint: "#62627a",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      boxShadow: {
        glow: "0 0 24px rgba(139,92,246,0.35), 0 0 64px rgba(139,92,246,0.12)",
        "glow-sm": "0 0 12px rgba(139,92,246,0.3)",
        "glow-crimson": "0 0 24px rgba(241,29,82,0.3)",
        card: "0 8px 32px rgba(0,0,0,0.45)",
        "card-lg": "0 16px 56px rgba(0,0,0,0.55)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #8b5cf6 0%, #a855f7 45%, #f11d52 120%)",
        "brand-gradient-soft": "linear-gradient(135deg, rgba(139,92,246,0.16) 0%, rgba(241,29,82,0.10) 100%)",
        "hero-fade": "linear-gradient(90deg, #06060a 0%, rgba(6,6,10,0.92) 26%, rgba(6,6,10,0.55) 55%, rgba(6,6,10,0.15) 78%, rgba(6,6,10,0.45) 100%)",
        "bottom-fade": "linear-gradient(180deg, transparent 0%, rgba(6,6,10,0.55) 62%, #06060a 100%)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-up": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "ken-burns": {
          "0%": { transform: "scale(1.02)" },
          "100%": { transform: "scale(1.1)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        spin: { to: { transform: "rotate(360deg)" } },
      },
      animation: {
        shimmer: "shimmer 1.8s linear infinite",
        "fade-up": "fade-up 0.5s cubic-bezier(0.21,1.02,0.73,1) both",
        "fade-in": "fade-in 0.4s ease both",
        "scale-in": "scale-in 0.25s cubic-bezier(0.21,1.02,0.73,1) both",
        "slide-up": "slide-up 0.32s cubic-bezier(0.21,1.02,0.73,1) both",
        "ken-burns": "ken-burns 9s ease-out both",
        "pulse-soft": "pulse-soft 1.6s ease-in-out infinite",
      },
      transitionTimingFunction: {
        premium: "cubic-bezier(0.21,1.02,0.73,1)",
      },
    },
  },
  plugins: [],
};

export default config;
