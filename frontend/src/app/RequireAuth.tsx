import { Navigate, Outlet, useLocation } from "react-router";

import { useMe } from "@/api/auth";
import { UnauthorizedError } from "@/api/client";

export function RequireAuth() {
  const me = useMe();
  const location = useLocation();

  if (me.isPending) return null;
  if (me.isError) {
    if (me.error instanceof UnauthorizedError) {
      const target = location.pathname + location.search;
      const query = target === "/" ? "" : `?next=${encodeURIComponent(target)}`;
      return <Navigate replace to={`/login${query}`} />;
    }
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p role="alert" className="text-destructive">
          {me.error.message}
        </p>
      </div>
    );
  }
  return <Outlet />;
}
