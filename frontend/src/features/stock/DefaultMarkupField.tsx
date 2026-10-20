import { useState } from "react";

import { usePatchSettings, useSettings } from "@/api/settings";
import { Input } from "@/components/ui/input";

import { errorText } from "./formBits";
import { trimPercent } from "./format";
import { parsePercent } from "./pricing";

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
      // On error the typed value stays so it can be corrected.
      patch.mutate(
        { default_markup: parsed },
        {
          onSuccess: () => {
            setDraft(null);
          },
        },
      );
      return;
    }
    patch.reset();
    setDraft(null);
  }

  return (
    <div className="flex flex-col items-end gap-1">
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
      {patch.error && (
        <p className="text-[12.5px] text-status-out">
          {errorText(patch.error)}
        </p>
      )}
    </div>
  );
}
