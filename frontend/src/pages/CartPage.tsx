import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import {
  useCart,
  useCartRefresh,
  useClearCart,
  cartKey,
  type CartRefreshItem,
} from "@/api/cart";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { CartTable } from "@/features/cart/CartTable";
import { plural } from "@/features/search/format";
import { formatPrice } from "@/features/stock/format";
import { useQueryClient } from "@tanstack/react-query";

export function CartPage() {
  const cart = useCart();
  const refresh = useCartRefresh();
  const clear = useClearCart();
  const queryClient = useQueryClient();
  const [refreshed, setRefreshed] = useState<
    Map<number, CartRefreshItem> | undefined
  >();
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [now] = useState(() => new Date());
  const started = useRef(false);

  const { mutate } = refresh;
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    mutate(undefined, {
      onSuccess: (out) => {
        setRefreshed(new Map(out.items.map((i) => [i.id, i])));
        setSupplierError(out.status === "error" ? out.message : null);
        void queryClient.invalidateQueries({ queryKey: cartKey });
      },
    });
  }, [mutate, queryClient]);

  if (cart.isPending) {
    return <p className="py-6 text-center text-muted-foreground">Загрузка…</p>;
  }
  if (cart.isError) {
    return (
      <p role="alert" className="text-destructive">
        {cart.error.message}
      </p>
    );
  }

  const items = cart.data.items;
  if (items.length === 0) {
    return (
      <Card title="Корзина">
        <p>Корзина пуста</p>
        <Link to="/" className="text-primary hover:underline">
          Перейти к поиску
        </Link>
      </Card>
    );
  }

  const n = items.length;
  return (
    <Card
      title="Корзина"
      actions={
        refresh.isPending ? (
          <span className="text-[12px] text-muted-foreground">
            проверяем цены…
          </span>
        ) : undefined
      }
    >
      {(supplierError !== null || refresh.isError) && (
        <p
          role="alert"
          className="mb-3 rounded-lg bg-status-low-bg px-3 py-2 text-status-low"
        >
          {supplierError ?? "Не удалось проверить цены"}
        </p>
      )}
      <CartTable items={items} refreshed={refreshed} now={now} />
      <div className="mt-3 flex items-center justify-between gap-3">
        <Button
          onClick={() => {
            setConfirm(true);
          }}
        >
          Очистить корзину
        </Button>
        <span className="font-semibold tabular-nums">
          {`${String(n)} ${plural(n, "позиция", "позиции", "позиций")} · ${formatPrice(cart.data.total)} ₽`}
        </span>
      </div>
      <Modal
        open={confirm}
        onClose={() => {
          setConfirm(false);
        }}
        title="Очистить корзину?"
        className="max-w-sm"
      >
        {clear.isError && (
          <p role="alert" className="px-4 pt-4 text-destructive">
            {clear.error.message}
          </p>
        )}
        <div className="flex justify-end gap-2 p-4">
          <Button
            onClick={() => {
              setConfirm(false);
            }}
          >
            Отмена
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              clear.mutate(undefined, {
                onSuccess: () => {
                  setConfirm(false);
                },
              });
            }}
          >
            Очистить
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
