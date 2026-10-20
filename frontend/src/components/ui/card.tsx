import type { ReactNode } from "react";

type CardProps = {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

export function Card({ title, actions, children }: CardProps) {
  return (
    <section className="rounded-lg border bg-card p-3.5 text-card-foreground">
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
