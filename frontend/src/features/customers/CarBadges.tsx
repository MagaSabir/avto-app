import { cn } from "@/lib/utils";

import { splitPlate } from "./format";

// The make gets its own colour so it stands out next to the model.
export function MakeBadge({
  make,
  className,
}: {
  make: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-[4px] bg-info-bg px-1.5 text-[12.5px] font-semibold whitespace-nowrap text-info",
        className,
      )}
    >
      {make}
    </span>
  );
}

// Looks like a number plate: number, then the region after a divider.
export function Plate({ plate }: { plate: string }) {
  const { number, region } = splitPlate(plate);
  return (
    <span
      data-plate
      className="inline-flex shrink-0 items-stretch rounded-[5px] border-[1.5px] border-foreground bg-card text-[12.5px] leading-none font-semibold whitespace-nowrap"
    >
      <span className="px-1.5 py-[3px]">{number}</span>
      {region && (
        <span className="border-l-[1.5px] border-foreground px-1 py-[3px]">
          {region}
        </span>
      )}
    </span>
  );
}

// «[Make] Model Year» with the make as a badge; text stays readable as one line.
export function CarTitle({
  make,
  model,
  year,
}: {
  make: string | null;
  model: string | null;
  year?: number | null;
}) {
  const rest = [model, year].filter((p) => p !== null && p !== "").join(" ");
  if (!make && !rest)
    return <span className="text-muted-foreground">Без названия</span>;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
      {make && <MakeBadge make={make} />}
      {make && rest && " "}
      {rest && <span className="font-semibold">{rest}</span>}
    </span>
  );
}
