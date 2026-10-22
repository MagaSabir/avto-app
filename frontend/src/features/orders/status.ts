export type OrderGroup = "active" | "ready" | "issued" | "refused" | "returns";

export const ORDER_GROUPS: { value: OrderGroup; label: string }[] = [
  { value: "active", label: "В работе" },
  { value: "ready", label: "Готов к выдаче" },
  { value: "issued", label: "Выдан" },
  { value: "refused", label: "Отказ" },
  { value: "returns", label: "Возвраты" },
];

export type PartTone = "low" | "ok" | "neutral" | "out";

type PartStatus = { label: string; group: OrderGroup | null; tone: PartTone };

const STATUSES: Record<number, PartStatus> = {
  0: { label: "Ожидает подтверждения", group: "active", tone: "low" },
  1: { label: "Собирается", group: "active", tone: "low" },
  5: { label: "Ожидает поступления", group: "active", tone: "low" },
  3: { label: "Готов к выдаче", group: "ready", tone: "ok" },
  6: { label: "На филиале", group: "ready", tone: "ok" },
  2: { label: "Передан покупателю", group: "issued", tone: "neutral" },
  7: { label: "Нет в наличии", group: "refused", tone: "out" },
  8: { label: "Отменён", group: "refused", tone: "out" },
  9: { label: "Просрочен", group: "refused", tone: "out" },
  31: { label: "Ждём возврата на склад", group: "returns", tone: "neutral" },
  32: { label: "Возврат на согласовании", group: "returns", tone: "neutral" },
  33: { label: "Проверка", group: "returns", tone: "neutral" },
  34: { label: "Возврат отклонён", group: "returns", tone: "neutral" },
  35: { label: "Частично отклонён", group: "returns", tone: "neutral" },
  36: { label: "Возвращён", group: "returns", tone: "neutral" },
};

export function partStatus(code: number): PartStatus {
  return (
    STATUSES[code] ?? {
      label: `Статус ${String(code)}`,
      group: null,
      tone: "neutral",
    }
  );
}
