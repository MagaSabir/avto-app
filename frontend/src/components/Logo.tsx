import lightLogo from "@/assets/rossmik_logo_light.svg";
import darkLogo from "@/assets/rossmik_logo_dark.svg";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <>
      <img
        src={lightLogo}
        alt="ROSSMIK"
        className={cn("dark:hidden", className)}
      />
      <img
        src={darkLogo}
        alt="ROSSMIK"
        className={cn("hidden dark:block", className)}
      />
    </>
  );
}
