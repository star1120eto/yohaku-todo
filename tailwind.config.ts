import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // 色は globals.css の CSS 変数で定義し、ダークモードで切り替える
        paper: "rgb(var(--c-paper) / <alpha-value>)",
        ink: {
          DEFAULT: "rgb(var(--c-ink) / <alpha-value>)",
          soft: "rgb(var(--c-ink-soft) / <alpha-value>)",
          faint: "rgb(var(--c-ink-faint) / <alpha-value>)",
        },
        line: "rgb(var(--c-line) / <alpha-value>)",
        card: "rgb(var(--c-card) / <alpha-value>)",
        field: "rgb(var(--c-field) / <alpha-value>)",
        accent: {
          DEFAULT: "rgb(var(--c-accent) / <alpha-value>)",
          soft: "rgb(var(--c-accent-soft) / <alpha-value>)",
        },
        danger: "rgb(var(--c-danger) / <alpha-value>)",
        satblue: "rgb(var(--c-satblue) / <alpha-value>)",
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
