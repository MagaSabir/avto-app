import { useState, type SyntheticEvent } from "react";

import { useAddCar, usePatchCar, type Car } from "@/api/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { errorText, Field } from "@/features/stock/formBits";

function orNull(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

function Form({
  customerId,
  car,
  onClose,
}: {
  customerId: number;
  car: Car | null;
  onClose: () => void;
}) {
  const [make, setMake] = useState(car?.make ?? "");
  const [model, setModel] = useState(car?.model ?? "");
  const [year, setYear] = useState(
    car?.year === null ? "" : String(car?.year ?? ""),
  );
  const [engine, setEngine] = useState(car?.engine ?? "");
  const [vin, setVin] = useState(car?.vin ?? "");
  const [plate, setPlate] = useState(car?.plate ?? "");
  const add = useAddCar(customerId);
  const patch = usePatchCar(customerId, car?.id ?? 0);
  const op = car ? patch : add;

  function submit(e: SyntheticEvent) {
    e.preventDefault();
    const trimmedYear = year.trim();
    op.mutate(
      {
        make: orNull(make),
        model: orNull(model),
        year: trimmedYear === "" ? null : Number(trimmedYear),
        engine: orNull(engine),
        vin: orNull(vin),
        plate: orNull(plate),
      },
      { onSuccess: onClose },
    );
  }

  const text = (
    label: string,
    value: string,
    set: (v: string) => void,
    mono = false,
  ) => (
    <Field label={label}>
      <Input
        value={value}
        onChange={(e) => {
          set(e.target.value);
        }}
        className={mono ? "font-mono" : undefined}
      />
    </Field>
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 p-4">
      {text("Марка", make, setMake)}
      {text("Модель", model, setModel)}
      <Field label="Год">
        <Input
          type="number"
          value={year}
          onChange={(e) => {
            setYear(e.target.value);
          }}
        />
      </Field>
      {text("Двигатель", engine, setEngine)}
      {text("VIN", vin, setVin, true)}
      {text("Госномер", plate, setPlate, true)}
      {op.error && (
        <p role="alert" className="text-destructive">
          {errorText(op.error)}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="primary"
          className="h-[34px]"
          disabled={op.isPending}
        >
          Сохранить
        </Button>
        <Button className="h-[34px]" onClick={onClose}>
          Отмена
        </Button>
      </div>
    </form>
  );
}

// car === null: add a new car; otherwise edit that car.
export function CarForm({
  open,
  customerId,
  car,
  onClose,
}: {
  open: boolean;
  customerId: number;
  car: Car | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={car ? "Машина" : "Добавить машину"}
      className="max-w-[420px]"
    >
      {open && <Form customerId={customerId} car={car} onClose={onClose} />}
    </Modal>
  );
}
