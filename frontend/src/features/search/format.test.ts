import { describe, expect, it } from "vitest";

import type { Offer } from "../../api/search";
import { formatDelivery, kindLabel, warehouseLabel } from "./format";

function offer(over: Partial<Offer> = {}): Offer {
  return {
    warehouse: "W",
    qty: 1,
    multiplicity: 1,
    delivery_days: null,
    delivery_from: null,
    delivery_to: null,
    kind: "normal",
    kind_code: "0",
    purchase_price: "100.00",
    price: "110.00",
    ...over,
  };
}

// Local-time dates keep the tests timezone-independent.
const at = (d: number, h: number, m: number) =>
  new Date(2026, 9, d, h, m).toISOString();
const now = new Date(2026, 9, 22, 10, 0);

describe("formatDelivery", () => {
  it("says today", () => {
    expect(
      formatDelivery(
        offer({ delivery_from: at(22, 16, 30), delivery_to: at(22, 19, 30) }),
        now,
      ),
    ).toBe("сегодня 16:30–19:30");
  });

  it("says tomorrow", () => {
    expect(
      formatDelivery(
        offer({ delivery_from: at(23, 9, 30), delivery_to: at(23, 12, 30) }),
        now,
      ),
    ).toBe("завтра 09:30–12:30");
  });

  it("uses a date for later days", () => {
    expect(
      formatDelivery(
        offer({ delivery_from: at(25, 9, 30), delivery_to: at(25, 12, 30) }),
        now,
      ),
    ).toBe("25.10 09:30–12:30");
  });

  it("falls back to days", () => {
    expect(formatDelivery(offer({ delivery_days: 6 }), now)).toBe("6 дн.");
  });

  it("falls back to not specified", () => {
    expect(formatDelivery(offer(), now)).toBe("не указан");
  });
});

describe("kindLabel", () => {
  it("labels every kind", () => {
    expect(kindLabel(offer({ kind: "normal" }))).toBe("обычное");
    expect(kindLabel(offer({ kind: "sale" }))).toBe("распродажа");
    expect(kindLabel(offer({ kind: "defect" }))).toBe("некондиция");
    expect(kindLabel(offer({ kind: "air" }))).toBe("авиатовар");
    expect(kindLabel(offer({ kind: "other", kind_code: "7" }))).toBe("тип 7");
  });
});

describe("warehouseLabel", () => {
  it("names Rossko partner stock and keeps addresses", () => {
    expect(warehouseLabel(offer({ warehouse: "Партнерский склад" }))).toBe(
      "склад партнёра",
    );
    const address = "г. Грозный, Старопромысловское шоссе, 21А, лит.Б4";
    expect(warehouseLabel(offer({ warehouse: address }))).toBe(address);
  });
});
