import { useState } from "react";

import { markupFromSale, parseMoney, parsePercent, salePrice } from "./pricing";

export type PriceFields = { purchase: string; markup: string; sale: string };

// Markup may be negative when the sale price is set below the purchase price.
export function parseMarkup(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.startsWith("-")) {
    const abs = parsePercent(trimmed.slice(1));
    return abs === null ? null : `-${abs}`;
  }
  return parsePercent(trimmed);
}

export function usePriceFields(initial: PriceFields) {
  const [fields, setFields] = useState<PriceFields>(initial);

  function setPurchase(purchase: string) {
    setFields((prev) => {
      const p = parseMoney(purchase);
      const m = parseMarkup(prev.markup);
      return {
        ...prev,
        purchase,
        sale: p !== null && m !== null ? salePrice(p, m) : prev.sale,
      };
    });
  }

  function setMarkup(markup: string) {
    setFields((prev) => {
      const p = parseMoney(prev.purchase);
      const m = parseMarkup(markup);
      return {
        ...prev,
        markup,
        sale: p !== null && m !== null ? salePrice(p, m) : prev.sale,
      };
    });
  }

  function setSale(sale: string) {
    setFields((prev) => {
      const p = parseMoney(prev.purchase);
      const s = parseMoney(sale);
      return {
        ...prev,
        sale,
        markup: p !== null && s !== null ? markupFromSale(p, s) : prev.markup,
      };
    });
  }

  return { ...fields, setPurchase, setMarkup, setSale, setAll: setFields };
}
