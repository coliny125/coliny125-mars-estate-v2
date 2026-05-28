import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          700: "rgb(28 23 20)",
          800: "rgb(21 17 15)",
        },
        parchment: {
          50: "rgb(251 248 241)",
          100: "rgb(244 238 226)",
          200: "rgb(237 228 211)",
          300: "rgb(217 205 182)",
          400: "rgb(183 169 136)",
          500: "rgb(138 125 99)",
        },
        brass: {
          400: "rgb(199 164 114)",
          500: "rgb(176 141 87)",
        },
        oxblood: {
          400: "rgb(142 41 41)",
          500: "rgb(122 34 34)",
        },
      },
      fontFamily: {
        serif: ["var(--font-cormorant)", "EB Garamond", "Garamond", "Georgia", "serif"],
      },
      boxShadow: {
        panel: "inset 0 1px 0 0 rgba(237,228,211,0.04)",
      },
      letterSpacing: {
        eyebrow: "0.18em",
        wordmark: "0.32em",
      },
    },
  },
  plugins: [],
};
export default config;
