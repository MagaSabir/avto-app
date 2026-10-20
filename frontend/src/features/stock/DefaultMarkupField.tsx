import { useState } from "react";

import { usePatchSettings, useSettings } from "@/api/settings";
import { Input } from "@/components/ui/input";

import { parsePercent } from "./pricing";
import { trimPercent } from "./format";

export function DefaultMarkupField() {
  const settings = useSettings();
  const patch = usePatchSettings();
  const [draft, setDraft] = useState<string | null>(null);

  const saved = settings.data ? trimPercent(settings.data.default_markup) : "";
  const value = draft ?? saved;

  function save() {
    if (draft === null) return;
    const parsed = parsePercent(draft);
    if (parsed !== null && trimPercent(parsed) !== saved) {
      patch.mutate({ default_markup: parsed });
    }
    setDraft(null);
  }

  return (
    <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
      Наценка по умолчанию, %
      <Input
        inputMode="decimal"
        className="h-8 w-16 text-right font-mono"
        value={value}
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          }
        }}
      />
    </label>
  );
}
