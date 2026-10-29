import { describe, expect, it } from "vitest";

import { activePreset, isValidPeriod, PRESETS, presetPeriod } from "./period";

const today = new Date(2026, 9, 29);

describe("presetPeriod", () => {
  it("covers each preset", () => {
    expect(presetPeriod("today", today)).toEqual({
      start: "2026-10-29",
      end: "2026-10-29",
    });
    expect(presetPeriod("yesterday", today)).toEqual({
      start: "2026-10-28",
      end: "2026-10-28",
    });
    expect(presetPeriod("week", today)).toEqual({
      start: "2026-10-23",
      end: "2026-10-29",
    });
    expect(presetPeriod("month", today)).toEqual({
      start: "2026-09-30",
      end: "2026-10-29",
    });
  });

  it("crosses a month start", () => {
    expect(presetPeriod("yesterday", new Date(2026, 10, 1))).toEqual({
      start: "2026-10-31",
      end: "2026-10-31",
    });
  });

  it("labels presets in Russian", () => {
    expect(PRESETS.map((p) => p.label)).toEqual([
      "Сегодня",
      "Вчера",
      "Неделя",
      "Месяц",
    ]);
  });
});

describe("activePreset", () => {
  it("finds the preset of a period", () => {
    for (const { value } of PRESETS) {
      const { start, end } = presetPeriod(value, today);
      expect(activePreset(start, end, today)).toBe(value);
    }
  });

  it("returns null for a custom period", () => {
    expect(activePreset("2026-10-01", "2026-10-15", today)).toBeNull();
  });
});

describe("isValidPeriod", () => {
  it("checks format and order", () => {
    expect(isValidPeriod("2026-10-01", "2026-10-29")).toBe(true);
    expect(isValidPeriod("2026-10-29", "2026-10-29")).toBe(true);
    expect(isValidPeriod("2026-10-29", "2026-10-01")).toBe(false);
    expect(isValidPeriod("2026-10", "2026-10-29")).toBe(false);
    expect(isValidPeriod("", "")).toBe(false);
  });
});
