import { Moon, Sun } from "lucide-react";
import { useState } from "react";

import { applyTheme, readTheme, type ThemeChoice } from "./theme";

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(readTheme);
  const label = choice === "dark" ? "Тема: тёмная" : "Тема: светлая";
  const Icon = choice === "dark" ? Moon : Sun;

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        const next: ThemeChoice = choice === "dark" ? "light" : "dark";
        applyTheme(next);
        setChoice(next);
      }}
      className="inline-flex size-10 cursor-pointer items-center justify-center rounded-[10px] border bg-transparent text-foreground hover:bg-selected"
    >
      <Icon size={20} aria-hidden="true" />
    </button>
  );
}
