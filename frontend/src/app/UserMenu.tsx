import { LogOut, UserRound } from "lucide-react";
import { useState } from "react";

// Opens on hover (and on click for touch and keyboard); holds only «Выход»
// until there is a real profile.
export function UserMenu({
  login,
  onLogout,
}: {
  login: string;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="relative"
      onMouseEnter={() => {
        setOpen(true);
      }}
      onMouseLeave={() => {
        setOpen(false);
      }}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
        }}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-muted-foreground hover:bg-selected hover:text-foreground"
      >
        <UserRound size={16} aria-hidden="true" />
        <span>{login}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 min-w-40 rounded-lg border bg-card py-1 shadow-md"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left hover:bg-muted"
          >
            <LogOut size={15} aria-hidden="true" />
            Выход
          </button>
        </div>
      )}
    </div>
  );
}
