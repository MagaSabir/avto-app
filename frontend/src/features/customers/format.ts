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
