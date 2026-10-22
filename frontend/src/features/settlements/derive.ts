import type { SettlementDocument } from "@/api/settlements";

// Money strings in kopecks as bigint, to stay exact.
function kopecks(v: string): bigint {
  const neg = v.startsWith("-");
  const [i = "0", f = ""] = v.replace("-", "").split(".");
  const k = BigInt(i) * 100n + BigInt(f.padEnd(2, "0").slice(0, 2));
  return neg ? -k : k;
}

function money(k: bigint): string {
  const neg = k < 0n;
  const abs = neg ? -k : k;
  const frac = (abs % 100n).toString().padStart(2, "0");
  return `${neg ? "-" : ""}${(abs / 100n).toString()}.${frac}`;
}

// Rossko reports payments with a zero amount; the paid sum is how much the
// balance grew against the next older document. Documents come newest first.
// A status filter drops documents in between, so nothing can be derived.
export function paidAmounts(
  docs: SettlementDocument[],
  filtered: boolean,
): (string | null)[] {
  return docs.map((d, i) => {
    const older = docs.at(i + 1);
    if (filtered || older === undefined || kopecks(d.amount) !== 0n) {
      return null;
    }
    const delta = kopecks(d.balance) - kopecks(older.balance);
    return delta > 0n ? money(delta) : null;
  });
}
