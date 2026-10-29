import type { CarBrief } from "@/api/customers";

// 79161234567 -> +7 916 123-45-67; anything else is shown as stored.
export function formatPhone(digits: string): string {
  const m = /^7(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(digits);
  return m ? `+7 ${m[1]} ${m[2]}-${m[3]}-${m[4]}` : digits;
}

export function carLabel(car: CarBrief): string {
  return [car.make, car.model, car.plate]
    .map((p) => (p ?? "").trim())
    .filter((p) => p !== "")
    .join(" ");
}

// Normalized Russian plate А123ВС77 -> «А 123 ВС» + region «77»; others as is.
export function splitPlate(plate: string): {
  number: string;
  region: string | null;
} {
  const m = /^([А-Я])(\d{3})([А-Я]{2})(\d{2,3})$/.exec(plate);
  return m
    ? { number: `${m[1]} ${m[2]} ${m[3]}`, region: m[4] }
    : { number: plate, region: null };
}
