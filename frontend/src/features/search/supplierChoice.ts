import type { SupplierInfo } from "@/api/search";

// Which suppliers the user wants to search, kept across visits. Storage may
// be blocked: then nothing is remembered and all suppliers are searched.
const KEY = "search.suppliers";

export function loadSupplierChoice(): string[] | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    if (Array.isArray(value) && value.every((c) => typeof c === "string")) {
      return value;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveSupplierChoice(codes: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(codes));
  } catch {
    // Not remembered; the choice still works for this visit.
  }
}

// Connected suppliers, in their order, that were chosen. Nothing saved or
// nothing matching (a supplier was switched off) means all of them.
export function selectedSuppliers(
  available: SupplierInfo[],
  saved: string[] | null,
): SupplierInfo[] {
  if (saved === null) return available;
  const chosen = available.filter((s) => saved.includes(s.code));
  return chosen.length > 0 ? chosen : available;
}
