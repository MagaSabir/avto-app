import { fireEvent, screen, within } from "@testing-library/react";
import { useLocation } from "react-router";
import { describe, expect, it } from "vitest";

import { renderWithProviders } from "@/test/mockApi";
import {
  offer,
  partGroup,
  stockItem,
  supplierResult,
} from "@/test/searchFixtures";

import { MyStockBlock } from "./MyStockBlock";

function Location() {
  const loc = useLocation();
  return <output aria-label="location">{loc.pathname + loc.search}</output>;
}

const mine = stockItem(7, {
  sold_30d: 2,
  last_receipt_at: new Date(2026, 9, 12, 12, 0).toISOString(),
  last_receipt_supplier: "Росско",
});
const analog = stockItem(8, {
  number_raw: "290 074",
  number_norm: "290074",
  brand: "SACHS",
  qty: 1,
  status: "low",
  sale_price: "4130.00",
});

function table() {
  return screen.getByRole("table");
}

describe("MyStockBlock", () => {
  it("renders a row with status, sales, last receipt and supplier price", () => {
    renderWithProviders(
      <MyStockBlock
        rows={[{ item: mine, isAnalog: false }]}
        results={[supplierResult()]}
        loadingMatches={false}
      />,
    );
    const t = within(table());
    expect(t.getByText("Продано 30 дн")).toBeInTheDocument();
    expect(t.getByText("Последний приход")).toBeInTheDocument();
    const row = within(t.getByText("333114").closest("tr") as HTMLElement);
    expect(row.getByText("в наличии")).toBeInTheDocument();
    expect(row.getByText("12.10.2026 · Росско")).toBeInTheDocument();
    expect(row.getByText("2 940 ₽")).toBeInTheDocument();
    expect(row.getByText("на 250 ₽ дешевле")).toBeInTheDocument();
  });

  it("does not say cheaper when the supplier price is higher", () => {
    renderWithProviders(
      <MyStockBlock
        rows={[{ item: mine, isAnalog: false }]}
        results={[
          supplierResult({
            groups: [partGroup({ offers: [offer({ price: "3500.00" })] })],
          }),
        ]}
        loadingMatches={false}
      />,
    );
    expect(within(table()).getByText("3 500 ₽")).toBeInTheDocument();
    expect(screen.queryByText(/дешевле/)).not.toBeInTheDocument();
  });

  it("marks analogs", () => {
    renderWithProviders(
      <MyStockBlock
        rows={[
          { item: mine, isAnalog: false },
          { item: analog, isAnalog: true },
        ]}
        results={[]}
        loadingMatches={false}
      />,
    );
    const row = within(
      within(table()).getByText("290 074").closest("tr") as HTMLElement,
    );
    expect(row.getByText("аналог")).toBeInTheDocument();
    expect(row.getByText("мало")).toBeInTheDocument();
  });

  it("opens the item on the stock screen on click", () => {
    renderWithProviders(
      <>
        <MyStockBlock
          rows={[{ item: mine, isAnalog: false }]}
          results={[]}
          loadingMatches={false}
        />
        <Location />
      </>,
      { route: "/?q=333114" },
    );
    fireEvent.click(within(table()).getByText("333114"));
    expect(screen.getByLabelText("location")).toHaveTextContent(
      "/stock?item=7",
    );
  });

  it("says when nothing is in stock", () => {
    renderWithProviders(
      <MyStockBlock rows={[]} results={[]} loadingMatches={false} />,
    );
    expect(screen.getByText("На складе нет")).toBeInTheDocument();
  });
});
