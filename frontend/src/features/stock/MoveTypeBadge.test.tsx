import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { StockMove } from "@/api/stock";

import { MoveTypeBadge } from "./MoveTypeBadge";

const CASES: [StockMove["type"], string][] = [
  ["receipt", "Приход"],
  ["sale", "Продажа"],
  ["return", "Возврат"],
  ["writeoff", "Списание"],
  ["adjustment", "Корректировка"],
  ["cancel", "Отмена"],
];

describe("MoveTypeBadge", () => {
  it.each(CASES)("labels %s as %s", (type, label) => {
    render(<MoveTypeBadge type={type} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
