import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Modal } from "./modal";

// eslint-disable-next-line @typescript-eslint/unbound-method
const { showModal: realShowModal, close: realClose } =
  HTMLDialogElement.prototype;

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
});

afterEach(() => {
  HTMLDialogElement.prototype.showModal = realShowModal;
  HTMLDialogElement.prototype.close = realClose;
});

describe("Modal", () => {
  it("closes on a backdrop click but not on a click inside", () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open onClose={onClose} title="T">
        <p>content</p>
      </Modal>,
    );
    fireEvent.click(screen.getByText("content"));
    expect(onClose).not.toHaveBeenCalled();
    const dialog = container.querySelector("dialog");
    if (!dialog) throw new Error("no dialog");
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes from the red X", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="T">
        x
      </Modal>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("ignores a cancel event that bubbles from a child", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="T">
        <p>content</p>
      </Modal>,
    );
    fireEvent(
      screen.getByText("content"),
      new Event("cancel", { bubbles: true, cancelable: true }),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders the title in a muted band", () => {
    render(
      <Modal open onClose={() => undefined} title="Заголовок">
        x
      </Modal>,
    );
    expect(screen.getByText("Заголовок").parentElement).toHaveClass(
      "bg-muted",
      "border-b",
    );
  });
});
