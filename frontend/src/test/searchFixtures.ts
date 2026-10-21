import type {
  Offer,
  PartGroup,
  StockSearchItem,
  SupplierSearchResult,
} from "@/api/search";

export function stockItem(
  id: number,
  over: Partial<StockSearchItem> = {},
): StockSearchItem {
  return {
    id,
    number_raw: "333114",
    number_norm: "333114",
    brand: "KYB",
    name: "Стойка амортизационная",
    qty: 3,
    min_qty: 1,
    cell: "A-2-4",
    purchase_price: "2449.85",
    markup: "30.00",
    sale_price: "3190.00",
    last_receipt_at: null,
    last_receipt_supplier: null,
    sold_30d: 0,
    status: "ok",
    ...over,
  };
}

export function offer(over: Partial<Offer> = {}): Offer {
  return {
    warehouse: "Новосибирск",
    qty: 20,
    multiplicity: 1,
    delivery_days: null,
    delivery_from: null,
    delivery_to: null,
    kind: "normal",
    kind_code: "0",
    purchase_price: "2449.85",
    price: "2940.00",
    ...over,
  };
}

export function partGroup(over: Partial<PartGroup> = {}): PartGroup {
  return {
    brand: "KYB",
    number: "333114",
    number_norm: "333114",
    name: "Стойка амортизационная",
    is_requested: true,
    key: "KYB|333114",
    analog_of: [],
    offers: [offer()],
    ...over,
  };
}

export function supplierResult(
  over: Partial<SupplierSearchResult> = {},
): SupplierSearchResult {
  return {
    code: "rossko",
    title: "Росско",
    status: "ok",
    message: null,
    markup: "20.00",
    groups: [partGroup()],
    stock_matches: [],
    ...over,
  };
}
