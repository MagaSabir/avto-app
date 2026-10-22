import type { SettlementsOut } from "@/api/settlements";

export function settlements(
  overrides: Partial<NonNullable<SettlementsOut["data"]>> = {},
): SettlementsOut {
  return {
    code: "rossko",
    title: "Росско",
    status: "ok",
    message: null,
    data: {
      balance: "67.54",
      limit: "0.00",
      kind: "Оплата по факту",
      payment_delay: 0,
      currency: "руб",
      customers: [{ id: "c1", name: "ИП Тестов", balance: "67.54" }],
      overdue_days: null,
      overdue_sum: null,
      payments: [],
      documents_total: 0,
      page_size: 20,
      page: 0,
      documents: [],
      ...overrides,
    },
  };
}
