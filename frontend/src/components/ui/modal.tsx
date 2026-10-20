import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

// Native <dialog> shell: fixed header with a red close X, content below.
// Handlers react only to events aimed at this dialog itself, so a nested
// dialog (React events bubble through the component tree) cannot close it.
export function Modal({
  open,
  onClose,
  title,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        onClose();
      }}
      onClose={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "m-auto max-h-[80vh] w-full flex-col overflow-hidden rounded-lg border bg-card p-0 text-card-foreground backdrop:bg-overlay open:flex",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          {title}
        </h2>
        <button
          type="button"
          aria-label="Закрыть"
          onClick={onClose}
          className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-destructive hover:bg-status-out-bg focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
