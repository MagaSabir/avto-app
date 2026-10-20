export type ThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = "theme";
const QUERY = "(prefers-color-scheme: dark)";

let unsubscribe: (() => void) | null = null;

function systemQuery(): MediaQueryList | null {
  return typeof window.matchMedia === "function"
    ? window.matchMedia(QUERY)
    : null;
}

export function readTheme(): ThemeChoice {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "light" || value === "dark" || value === "system")
      return value;
  } catch {
    // storage unavailable: fall back to system
  }
  return "system";
}

function setDark(dark: boolean): void {
  document.documentElement.classList.toggle("dark", dark);
}

export function applyTheme(choice: ThemeChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // storage unavailable: theme applies for this session only
  }
  unsubscribe?.();
  unsubscribe = null;

  if (choice !== "system") {
    setDark(choice === "dark");
    return;
  }
  const query = systemQuery();
  setDark(query?.matches ?? false);
  if (query) {
    const onChange = (event: MediaQueryListEvent) => {
      setDark(event.matches);
    };
    query.addEventListener("change", onChange);
    unsubscribe = () => {
      query.removeEventListener("change", onChange);
    };
  }
}
