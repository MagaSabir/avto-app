export function normBrand(brand: string): string {
  return brand.trim().replace(/\s+/g, " ").toUpperCase();
}
