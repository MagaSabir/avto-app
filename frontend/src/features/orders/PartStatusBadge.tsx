import { cn } from "@/lib/utils";

import { partStatus, type PartTone } from "./status";

const TONES: Record<PartTone, string> = {
  low: "bg-status-low-bg text-status-low",
  ok: "bg-status-ok-bg text-status-ok",
  out: "bg-status-out-bg text-status-out",
  neutral: "bg-muted text-muted-foreground",
};

export function PartStatusBadge({ code }: { code: number }) {
  const { label, tone } = partStatus(code);
  return (
    <span
      data-testid="part-status"
      className={cn(
        "inline-flex items-center whitespace-nowrap gap-1.5 rounded-full px-2.5 py-0.5 text-[12.5px] font-medium",
        TONES[tone],
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-[7px] rounded-full",
          tone === "out" ? "border-[1.5px] border-current" : "bg-current",
        )}
      />
      {label}
    </span>
  );
}
