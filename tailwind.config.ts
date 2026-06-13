import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f5f3f0",
        ink: {
          DEFAULT: "#33312e",
          soft: "#6b6862",
          faint: "#a3a097",
        },
        line: "#e7e4de",
        card: "#fdfcfb",
        accent: {
          DEFAULT: "#5f7a6a",
          soft: "#eef2ef",
        },
        danger: "#b5654f",
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          '"Hiragino Kaku Gothic ProN"',
          '"Hiragino Sans"',
          '"Yu Gothic"',
          "Meiryo",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        serif: [
          "var(--font-serif)",
          '"Hiragino Mincho ProN"',
          '"Yu Mincho"',
          "Georgia",
          "serif",
        ],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(50, 45, 40, 0.04), 0 4px 16px rgba(50, 45, 40, 0.05)",
        pop: "0 4px 12px rgba(50, 45, 40, 0.08), 0 12px 40px rgba(50, 45, 40, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
