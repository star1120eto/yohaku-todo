import type { Theme } from "./types";

export const THEME_KEY = "yohaku:theme";

export function resolveDark(theme: Theme): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

/** テーマを即座に反映し、再読み込み時のちらつき防止用に localStorage へ控える。 */
export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolveDark(theme));
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // localStorage 不可環境では無視
  }
}
