export type ThemeChoice = "light" | "dark";

const STORAGE_KEY = "theme";

// The stored choice, or the system preference when there is none (also for
// the legacy "system" value). The system setting is read once, not followed.
export function readTheme(): ThemeChoice {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "light" || value === "dark") return value;
  } catch {
    // storage unavailable: fall back to system
  }
  const dark =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  return dark ? "dark" : "light";
}

export function applyTheme(choice: ThemeChoice): void {
  document.documentElement.classList.toggle("dark", choice === "dark");
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // storage unavailable: theme applies for this session only
  }
}
