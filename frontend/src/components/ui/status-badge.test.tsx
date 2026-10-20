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

  it("renders a hollow dot for out", () => {
    const { container } = render(<StatusBadge status="out" />);
    const dot = container.querySelector("[aria-hidden]");
    expect(dot).toHaveClass("border-[1.5px]");
    expect(dot).not.toHaveClass("bg-current");
  });
});
