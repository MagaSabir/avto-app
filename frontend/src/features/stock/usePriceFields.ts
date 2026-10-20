import { useState } from "react";

import { markupFromSale, parseMarkup, parseMoney, salePrice } from "./pricing";

export type PriceFields = { purchase: string; markup: string; sale: string };

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
