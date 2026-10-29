import { fireEvent, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Car } from "@/api/customers";
import { mockApi, renderWithProviders } from "@/test/mockApi";

import { CustomerHistory } from "./CustomerHistory";

afterEach(() => {
  vi.unstubAllGlobals();
});

const cars: Car[] = [
  {
    id: 11,
    make: "Test",
    model: "X1",
    engine: null,
    vin: null,
    plate: null,
    year: null,
  },
  {
    id: 12,
    make: "Demo",
    model: "Y2",
    engine: null,
    vin: null,
    plate: null,
    year: null,
  },
];

function Harness() {
  const [list, setList] = useState(cars);
  return (
    <>
      <button
        onClick={() => {
          setList(cars.filter((c) => c.id !== 11));
        }}
      >
        drop
      </button>
      <CustomerHistory customerId={5} cars={list} />
    </>
  );
}

describe("CustomerHistory", () => {
  it("resets the filter when the selected car disappears", async () => {
    const queries: (string | null)[] = [];
    mockApi({
      "GET /api/customers/5/history": (_i, url) => {
        queries.push(url.searchParams.get("car_id"));
        return [];
      },
    });
    renderWithProviders(<Harness />);
    await screen.findByText("Покупок пока нет");
    fireEvent.change(screen.getByLabelText("Машина"), {
      target: { value: "11" },
    });
    await waitFor(() => {
      expect(queries).toEqual([null, "11"]);
    });
    fireEvent.click(screen.getByRole("button", { name: "drop" }));
    await waitFor(() => {
      expect(queries.at(-1)).toBeNull();
    });
    expect(screen.getByLabelText("Машина")).toHaveValue("");
  });
});
