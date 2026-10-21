import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";

import { applyTheme, readTheme, type ThemeChoice } from "./theme";

const NEXT: Record<ThemeChoice, ThemeChoice> = {
  light: "dark",
  dark: "system",
  system: "light",
};

const LABELS: Record<ThemeChoice, string> = {
  light: "Тема: светлая",
  dark: "Тема: тёмная",
  system: "Тема: как в системе",
};

const ICONS = { light: Sun, dark: Moon, system: Monitor };

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(readTheme);
  const Icon = ICONS[choice];

  function cycle() {
    const next = NEXT[choice];
    applyTheme(next);
    setChoice(next);
  }

  return (
    <button
      type="button"
      aria-label={LABELS[choice]}
      title={LABELS[choice]}
      onClick={cycle}
      className="text-muted-foreground hover:bg-selected inline-flex cursor-pointer items-center rounded-lg p-2"
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  );
}
