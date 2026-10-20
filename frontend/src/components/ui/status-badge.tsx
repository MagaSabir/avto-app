import { cn } from "@/lib/utils";

export type StockStatus = "ok" | "low" | "out";

const STYLES: Record<StockStatus, { text: string; className: string }> = {
  ok: { text: "в наличии", className: "bg-status-ok-bg text-status-ok" },
  low: { text: "мало", className: "bg-status-low-bg text-status-low" },
  out: { text: "нет", className: "bg-status-out-bg text-status-out" },
};

export function StatusBadge({ status }: { status: StockStatus }) {
  const { text, className } = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap gap-1.5 rounded-full px-2.5 py-0.5 text-[12.5px] font-medium",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-[7px] rounded-full",
          status === "out" ? "border-[1.5px] border-current" : "bg-current",
        )}
      />
      {text}
    </span>
  );
}
