import { useEffect, useState, type ReactNode } from "react";
import { Phone, X } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router";

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
import { CarTitle, Plate } from "@/features/customers/CarBadges";
import { carLabel, formatPhone } from "@/features/customers/format";
import { formatDate } from "@/features/stock/format";
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[12.5px] text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Empty() {
  return <span className="text-muted-foreground">—</span>;
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
    <li
      aria-label={title || "Без названия"}
      className="relative rounded-lg border hover:border-border-active"
    >
      {/* The whole tile opens the edit form; the cross deletes. */}
      <button
        type="button"
        aria-label="Изменить машину"
        onClick={onEdit}
        className="flex w-full cursor-pointer flex-col gap-2.5 rounded-lg p-3 pr-10 text-left focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="flex flex-wrap items-center gap-2">
          <CarTitle make={car.make} model={car.model} year={car.year} />
          {car.plate && <Plate plate={car.plate} />}
        </span>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[13px]">
          <dt className="text-muted-foreground">Двигатель</dt>
          <dd>{car.engine ?? <Empty />}</dd>
          <dt className="text-muted-foreground">VIN</dt>
          <dd className="font-mono [overflow-wrap:anywhere]">
            {car.vin ?? <Empty />}
          </dd>
        </dl>
      </button>
      <button
        type="button"
        aria-label="Удалить машину"
        title="Удалить машину"
        onClick={() => {
          setConfirm(true);
        }}
        className="absolute top-2 right-2 flex size-7 cursor-pointer items-center justify-center rounded-md text-destructive hover:bg-destructive/10 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
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
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <Card>
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-0.5">
              <h1 className="text-[20px] font-bold [overflow-wrap:anywhere]">
                {customer.name}
              </h1>
              <span className="text-[12.5px] text-muted-foreground">
                {`клиент с ${formatDate(customer.created_at)}`}
              </span>
            </div>
            {warnings.length > 0 && (
              <div role="status" className="text-status-low">
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
              <>
                <dl className="flex flex-col gap-3">
                  <Field label="Телефоны">
                    {customer.phones.length > 0 ? (
                      <ul className="flex flex-col gap-1">
                        {customer.phones.map((p) => (
                          <li key={p}>
                            <a
                              href={`tel:${telNumber(p)}`}
                              className="inline-flex items-center gap-1.5 tabular-nums hover:underline"
                            >
                              <Phone
                                className="size-3.5 text-muted-foreground"
                                aria-hidden="true"
                              />
                              {formatPhone(p)}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <Empty />
                    )}
                  </Field>
                  <Field label="Комментарий">
                    {customer.comment ? (
                      <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                        {customer.comment}
                      </span>
                    ) : (
                      <Empty />
                    )}
                  </Field>
                </dl>
                <div className="flex flex-wrap gap-2">
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
                </div>
              </>
            )}
          </div>
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
          {customer.cars.length > 0 ? (
            <ul
              aria-label="Машины"
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3"
            >
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
          ) : (
            <p className="text-muted-foreground">Машин пока нет</p>
          )}
        </Card>
      </div>
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

function telNumber(phone: string): string {
  return /^7\d{10}$/.test(phone) ? `+${phone}` : phone;
}

export function CustomerPage() {
  const id = Number(useParams().id);
  const location = useLocation();
  const navigate = useNavigate();
  // Creation warnings are shown once: drop them from the history entry so a
  // reload or Back does not bring them back.
  const [initialWarnings] = useState(() => warningsFromState(location.state));
  useEffect(() => {
    if (location.state !== null) {
      void navigate(location.pathname + location.search, {
        replace: true,
        state: null,
      });
    }
  }, [location.state, location.pathname, location.search, navigate]);
  const validId = Number.isInteger(id) && id > 0;
  const { data, isPending, isError, error } = useCustomer(validId ? id : null);

  let content: ReactNode;
  if (!validId) {
    content = (
      <p role="alert" className="text-destructive">
        Клиент не найден
      </p>
    );
  } else if (isPending) {
    content = (
      <p className="py-6 text-center text-muted-foreground">Загрузка…</p>
    );
  } else if (isError) {
    content = (
      <p role="alert" className="text-destructive">
        {error.message}
      </p>
    );
  } else {
    content = (
      <CustomerCard
        key={data.id}
        customer={data}
        initialWarnings={initialWarnings}
      />
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <Link to="/customers" className="self-start text-link hover:underline">
        ← Все клиенты
      </Link>
      {content}
    </div>
  );
}
