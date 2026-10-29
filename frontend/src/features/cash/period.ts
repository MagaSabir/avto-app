export type Preset = "today" | "yesterday" | "week" | "month";

export const PRESETS: { value: Preset; label: string }[] = [
  { value: "today", label: "Сегодня" },
  { value: "yesterday", label: "Вчера" },
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function isoDate(d: Date): string {
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysBefore(today: Date, days: number): string {
  return isoDate(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - days),
  );
}

// Week and month are the last 7 and 30 days including today.
export function presetPeriod(
  preset: Preset,
  today: Date,
): { start: string; end: string } {
  const end = isoDate(today);
  switch (preset) {
    case "today":
      return { start: end, end };
    case "yesterday": {
      const day = daysBefore(today, 1);
      return { start: day, end: day };
    }
    case "week":
      return { start: daysBefore(today, 6), end };
    case "month":
      return { start: daysBefore(today, 29), end };
  }
}

export function activePreset(
  start: string,
  end: string,
  today: Date,
): Preset | null {
  const found = PRESETS.find(({ value }) => {
    const p = presetPeriod(value, today);
    return p.start === start && p.end === end;
  });
  return found?.value ?? null;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidPeriod(start: string, end: string): boolean {
  return DATE.test(start) && DATE.test(end) && start <= end;
}
