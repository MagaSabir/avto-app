import type { Order, OrderPart, OrdersOut } from "@/api/orders";

export function part(overrides: Partial<OrderPart> = {}): OrderPart {
  return {
    guid: "g1",
    brand: "PARTS-MALL",
    number: "HCZB-003",
    name: "Клапан впускной",
    price: "213.00",
    count: 4,
    delivery_days: 1,
    comment: "Позвонить",
    status_code: 2,
    ...overrides,
  };
}

export function order(overrides: Partial<Order> = {}): Order {
  return {
    id: 100000001,
    created_at: "2026-10-18T11:35:45Z",
    delivery_date: "2026-10-19",
    total: "1191.00",
    stock_address: "г. Тестовый, ул. Складская, 1",
    delivery_type: "Курьерская доставка",
    delivery_cost: null,
    delivery_address: "село Тестовое, ул. Примерная",
    payment_type: "Оплата наличными при получении товара",
    comment: "Тестовый комментарий",
    parts: [part()],
    ...overrides,
  };
}

export function ordersOut(orders: Order[], truncated = false): OrdersOut {
  return {
    code: "rossko",
    title: "Росско",
    status: "ok",
    message: null,
    data: { orders, truncated },
  };
}
