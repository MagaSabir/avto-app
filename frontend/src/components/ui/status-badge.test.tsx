import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it.each([
    ["ok", "в наличии"],
    ["low", "мало"],
    ["out", "нет"],
  ] as const)("renders %s as %s", (status, text) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });
});
