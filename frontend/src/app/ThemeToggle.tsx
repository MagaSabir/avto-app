import { Moon, Sun } from "lucide-react";
import { useState } from "react";

import { applyTheme, readTheme, type ThemeChoice } from "./theme";

const LABELS: Record<ThemeChoice, string> = {
  light: "Тема: светлая",
  dark: "Тема: тёмная",
};

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(readTheme);
  const Icon = choice === "dark" ? Moon : Sun;

  function toggle() {
    const next = choice === "dark" ? "light" : "dark";
    applyTheme(next);
    setChoice(next);
  }

  return (
    <button
      type="button"
      aria-label={LABELS[choice]}
      title={LABELS[choice]}
      onClick={toggle}
      className="text-muted-foreground hover:bg-selected inline-flex cursor-pointer items-center rounded-lg p-2"
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  );
}
