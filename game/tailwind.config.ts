import type { Config } from "tailwindcss";

// Colours are CSS variables defined in app/tokens.css; Tailwind only maps names to them.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sand: v("sand"), haze: v("haze"), asphalt: v("asphalt"), ink: v("ink"),
        signage: v("signage"), brt: v("brt"), warn: v("warn"), brick: v("brick"), alert: v("alert"), paper: v("paper"),
      },
      fontFamily: {
        display: ["var(--font-display)"], ui: ["var(--font-ui)"], urdu: ["var(--font-urdu)"],
      },
      borderRadius: { plate: "var(--r-plate)", card: "var(--r-card)", pill: "var(--r-pill)" },
      fontSize: { "2xs": "12px", xs: "14px", sm: "16px", md: "20px", lg: "28px", xl: "40px", "2xl": "56px", "3xl": "72px" },
    },
  },
  plugins: [],
};
export default config;
