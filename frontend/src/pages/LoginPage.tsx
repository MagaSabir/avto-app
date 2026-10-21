import { useRef, useState, type SyntheticEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";

import { useLogin, useMe } from "@/api/auth";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getLastLogin, setLastLogin } from "@/features/auth/lastLogin";
import { safeNext } from "@/features/auth/next";

export function LoginPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const navigate = useNavigate();
  const me = useMe();
  const login = useLogin();
  // Remembered login: the password is the only thing left to type.
  const [lastLogin] = useState(getLastLogin);
  const [username, setUsername] = useState(lastLogin);
  const [password, setPassword] = useState("");
  const submitting = useRef(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  if (me.isSuccess) return <Navigate replace to={next} />;

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    // Ref, not isPending: two submits can land before the next render.
    if (submitting.current) return;
    submitting.current = true;
    login.mutate(
      { login: username, password },
      {
        onSettled: () => {
          submitting.current = false;
        },
        onSuccess: () => {
          setLastLogin(username.trim());
          void navigate(next, { replace: true });
        },
        onError: () => {
          setPassword("");
          passwordRef.current?.focus();
        },
      },
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Card>
          <form method="post" onSubmit={submit} className="flex flex-col gap-3">
            <Logo className="mx-auto mb-2 h-10" />
            <div className="flex flex-col gap-1">
              <label
                htmlFor="login"
                className="text-[13px] text-muted-foreground"
              >
                Логин
              </label>
              <Input
                id="login"
                name="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                }}
                autoComplete="username"
                autoFocus={lastLogin === ""}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="password"
                className="text-[13px] text-muted-foreground"
              >
                Пароль
              </label>
              <Input
                id="password"
                name="password"
                ref={passwordRef}
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                }}
                autoComplete="current-password"
                autoFocus={lastLogin !== ""}
              />
            </div>
            <Button type="submit" variant="primary" disabled={login.isPending}>
              Войти
            </Button>
            {login.isError && (
              <p role="alert" className="text-destructive">
                {login.error.message}
              </p>
            )}
          </form>
        </Card>
      </div>
    </main>
  );
}
