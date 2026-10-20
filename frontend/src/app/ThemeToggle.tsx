import { useState } from "react";

import { cn } from "@/lib/utils";

import { applyTheme, readTheme, type ThemeChoice } from "./theme";

const OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: "light", label: "Светлая" },
  { value: "dark", label: "Тёмная" },
  { value: "system", label: "Система" },
];

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(readTheme);

  function select(value: ThemeChoice) {
    applyTheme(value);
    setChoice(value);
  }

  return (
    <div
      role="group"
      aria-label="Тема"
      className="inline-flex overflow-hidden rounded-lg border"
    >
      {OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={choice === value}
          onClick={() => {
            select(value);
          }}
          className={cn(
            "px-2.5 py-1 text-xs",
            choice === value
              ? "bg-selected text-foreground"
              : "text-muted-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
