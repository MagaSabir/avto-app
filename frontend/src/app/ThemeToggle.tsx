import { Moon, Sun } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { applyTheme, readTheme, type ThemeChoice } from "./theme";

const OPTIONS: { value: ThemeChoice; label: string; Icon: typeof Moon }[] = [
  { value: "dark", label: "Тёмная тема", Icon: Moon },
  { value: "light", label: "Светлая тема", Icon: Sun },
];

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(readTheme);

  function select(next: ThemeChoice) {
    applyTheme(next);
    setChoice(next);
  }

  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          title={label}
          aria-pressed={choice === value}
          onClick={() => {
            select(value);
          }}
          className={cn(
            "inline-flex cursor-pointer items-center rounded-md p-1.5",
            choice === value
              ? "bg-card text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon size={15} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
