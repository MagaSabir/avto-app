import { ShoppingCart } from "lucide-react";
import { NavLink } from "react-router";

import { useCart } from "@/api/cart";

export function CartLink() {
  const { data } = useCart();
  const count = data?.items.length ?? 0;
  return (
    <NavLink
      to="/cart"
      aria-label={`Корзина: ${String(count)}`}
      className="relative cursor-pointer rounded-lg px-2 py-1.5 text-muted-foreground hover:bg-selected"
    >
      <ShoppingCart className="size-[22px]" aria-hidden="true" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-primary px-1 text-center text-[11px] leading-4 text-primary-foreground">
          {count}
        </span>
      )}
    </NavLink>
  );
}
