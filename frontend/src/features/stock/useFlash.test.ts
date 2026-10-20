import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useFlash } from "./useFlash";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useFlash", () => {
  it("shows a message and clears it after 4000 ms", () => {
    const { result } = renderHook(() => useFlash());
    expect(result.current[0]).toBeNull();
    act(() => {
      result.current[1]("ok");
    });
    expect(result.current[0]).toBe("ok");
    act(() => {
      vi.advanceTimersByTime(3999);
    });
    expect(result.current[0]).toBe("ok");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current[0]).toBeNull();
  });

  it("restarts the timer on a new message", () => {
    const { result } = renderHook(() => useFlash());
    act(() => {
      result.current[1]("one");
    });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    act(() => {
      result.current[1]("two");
    });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current[0]).toBe("two");
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current[0]).toBeNull();
  });

  it("clears the timer on unmount", () => {
    const { result, unmount } = renderHook(() => useFlash());
    act(() => {
      result.current[1]("ok");
    });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
