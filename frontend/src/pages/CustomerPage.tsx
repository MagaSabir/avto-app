import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";

import {
  useCustomer,
  useDeleteCar,
  useDeleteCustomer,
  type Car,
  type Customer,
} from "@/api/customers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { CarForm } from "@/features/customers/CarForm";
import { CustomerEditForm } from "@/features/customers/CustomerEditForm";
import { CustomerHistory } from "@/features/customers/CustomerHistory";
import { carLabel, formatPhone } from "@/features/customers/format";
import { errorText } from "@/features/stock/formBits";

const DANGER = "h-[34px] border-destructive text-destructive";

function ConfirmDelete({
  open,
  onClose,
  title,
  text,
  op,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  text: string;
  op: {
    isPending: boolean;
    error: Error | null;
    reset: () => void;
    mutate: (v: undefined) => void;
  };
}) {
  const close = () => {
    if (op.isPending) return;
    op.reset();
    onClose();
  };
  return (
    <Modal open={open} onClose={close} title={title} className="max-w-[460px]">
      <div className="flex flex-col gap-3 p-4">
        <p>{text}</p>
        {op.error && (
          <p role="alert" className="text-destructive">
            {errorText(op.error)}
          </p>
        )}
        <div className="flex gap-2">
          <Button
            className="h-[34px] border-destructive bg-destructive text-primary-foreground enabled:hover:bg-destructive/90"
            disabled={op.isPending}
            onClick={() => {
              op.mutate(undefined);
            }}
          >
            Удалить
          </Button>
          <Button className="h-[34px]" onClick={close}>
            Отмена
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CarRow({
  customerId,
  car,
  onEdit,
}: {
  customerId: number;
  car: Car;
  onEdit: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const del = useDeleteCar(customerId, car.id);
  const title = [car.make, car.model, car.year]
    .filter((p) => p !== null && p !== "")
    .join(" ");
  return (
    <li className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2">
      <span className="font-semibold">{title || "Без названия"}</span>
      {car.engine && (
        <span className="text-muted-foreground">{car.engine}</span>
      )}
      {car.vin && <span className="font-mono text-[13px]">{car.vin}</span>}
      {car.plate && <span className="font-mono text-[13px]">{car.plate}</span>}
      <span className="ml-auto flex gap-2">
        <Button
          className="h-[30px]"
          aria-label="Изменить машину"
          onClick={onEdit}
        >
          Изменить
        </Button>
        <Button
          className={DANGER}
          aria-label="Удалить машину"
          onClick={() => {
            setConfirm(true);
          }}
        >
          Удалить
        </Button>
      </span>
      <ConfirmDelete
        open={confirm}
        onClose={() => {
          setConfirm(false);
        }}
        title="Удаление машины"
        text={`Удалить машину ${carLabel(car) || title}? Её продажи останутся без машины. Действие необратимо.`}
        op={{
          isPending: del.isPending,
          error: del.error,
          reset: del.reset,
          mutate: (v) => {
            del.mutate(v, {
              onSuccess: () => {
                setConfirm(false);
              },
            });
          },
        }}
      />
    </li>
  );
}

function CustomerCard({
  customer,
  initialWarnings,
}: {
  customer: Customer;
  initialWarnings: string[];
}) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [warnings, setWarnings] = useState(initialWarnings);
  const [carDialog, setCarDialog] = useState<{
    open: boolean;
    car: Car | null;
  }>({ open: false, car: null });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const del = useDeleteCustomer(customer.id);

  return (
    <div className="flex flex-col gap-4">
      <Card
        actions={
          !editing && (
            <span className="flex gap-2">
              <Button
                className="h-[34px]"
                onClick={() => {
                  setEditing(true);
                }}
              >
                Изменить
              </Button>
              <Button
                className={DANGER}
                onClick={() => {
                  setConfirmDelete(true);
                }}
              >
                Удалить клиента
              </Button>
            </span>
          )
        }
        title={<span className="text-[20px] font-bold">{customer.name}</span>}
      >
        {warnings.length > 0 && (
          <div role="status" className="mb-3 text-status-low">
            {warnings.map((w) => (
              <p key={w}>{w}</p>
            ))}
          </div>
        )}
        {editing ? (
          <CustomerEditForm
            customer={customer}
            onSaved={(saved) => {
              setWarnings(saved.warnings);
              setEditing(false);
            }}
            onCancel={() => {
              setEditing(false);
            }}
          />
        ) : (
          <div className="flex flex-col gap-1">
            <p className="flex flex-wrap gap-x-4 font-mono text-[14px]">
              {customer.phones.map((p) => (
                <a key={p} href={`tel:${p}`} className="hover:underline">
                  {formatPhone(p)}
                </a>
              ))}
            </p>
            {customer.comment && (
              <p className="text-muted-foreground">{customer.comment}</p>
            )}
          </div>
        )}
      </Card>
      <Card
        title="Машины"
        actions={
          <Button
            className="h-[34px]"
            onClick={() => {
              setCarDialog({ open: true, car: null });
            }}
          >
            Добавить машину
          </Button>
        }
      >
        {customer.cars.length > 0 && (
          <ul aria-label="Машины" className="divide-y">
            {customer.cars.map((car) => (
              <CarRow
                key={car.id}
                customerId={customer.id}
                car={car}
                onEdit={() => {
                  setCarDialog({ open: true, car });
                }}
              />
            ))}
          </ul>
        )}
      </Card>
      <CustomerHistory customerId={customer.id} cars={customer.cars} />
      <CarForm
        open={carDialog.open}
        customerId={customer.id}
        car={carDialog.car}
        onClose={() => {
          setCarDialog((d) => ({ ...d, open: false }));
        }}
      />
      <ConfirmDelete
        open={confirmDelete}
        onClose={() => {
          setConfirmDelete(false);
        }}
        title="Удаление клиента"
        text={`Удалить клиента «${customer.name}» с телефонами и машинами? Его продажи останутся без клиента. Действие необратимо.`}
        op={{
          isPending: del.isPending,
          error: del.error,
          reset: del.reset,
          mutate: (v) => {
            del.mutate(v, {
              onSuccess: () => {
                void navigate("/customers");
              },
            });
          },
        }}
      />
    </div>
  );
}

function warningsFromState(state: unknown): string[] {
  if (typeof state !== "object" || state === null) return [];
  const w = (state as { warnings?: unknown }).warnings;
  return Array.isArray(w) ? w.filter((x) => typeof x === "string") : [];
}

export function CustomerPage() {
  const id = Number(useParams().id);
  const location = useLocation();
  const { data, isPending, isError, error } = useCustomer(
    Number.isInteger(id) ? id : null,
  );

  if (isPending) {
    return <p className="py-6 text-center text-muted-foreground">Загрузка…</p>;
  }
  if (isError) {
    return (
      <p role="alert" className="text-destructive">
        {error.message}
      </p>
    );
  }
  return (
    <CustomerCard
      customer={data}
      initialWarnings={warningsFromState(location.state)}
    />
  );
}
