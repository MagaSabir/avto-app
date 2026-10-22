import { useState, type SyntheticEvent } from "react";
import { useNavigate } from "react-router";

import { useLogout, useMe, useUpdateMe, type Me } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

function NamesForm({ me }: { me: Me }) {
  const [firstName, setFirstName] = useState(me.first_name);
  const [lastName, setLastName] = useState(me.last_name);
  const update = useUpdateMe();

  function submit(e: SyntheticEvent) {
    e.preventDefault();
    update.mutate({ first_name: firstName, last_name: lastName });
  }

  return (
    <form onSubmit={submit} className="flex max-w-sm flex-col gap-3">
      <dl>
        <dt className="text-[12px] text-muted-foreground">Логин</dt>
        <dd className="font-mono">{me.login}</dd>
      </dl>
      <label className="flex flex-col gap-1 text-[12px] text-muted-foreground">
        Имя
        <Input
          value={firstName}
          maxLength={100}
          onChange={(e) => {
            setFirstName(e.target.value);
            update.reset();
          }}
        />
      </label>
      <label className="flex flex-col gap-1 text-[12px] text-muted-foreground">
        Фамилия
        <Input
          value={lastName}
          maxLength={100}
          onChange={(e) => {
            setLastName(e.target.value);
            update.reset();
          }}
        />
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={update.isPending}>
          Сохранить
        </Button>
        {update.isSuccess && (
          <span role="status" className="text-status-ok">
            ✓ Сохранено
          </span>
        )}
      </div>
      {update.isError && (
        <p role="alert" className="text-destructive">
          {update.error.message}
        </p>
      )}
    </form>
  );
}

function LogoutButton() {
  const navigate = useNavigate();
  const logout = useLogout();
  const [confirming, setConfirming] = useState(false);

  function close() {
    setConfirming(false);
    logout.reset();
  }

  return (
    <>
      <Button
        type="button"
        className="self-start"
        onClick={() => {
          setConfirming(true);
        }}
      >
        Выйти из учётной записи
      </Button>
      <Modal
        open={confirming}
        onClose={close}
        title="Выход"
        className="max-w-[360px]"
      >
        <p className="px-4 py-3">Выйти из учётной записи?</p>
        {logout.isError && (
          <p role="alert" className="px-4 pb-2 text-destructive">
            {logout.error.message}
          </p>
        )}
        <div className="flex justify-end gap-2 px-4 pb-3">
          <Button
            variant="primary"
            disabled={logout.isPending}
            onClick={() => {
              logout.mutate(undefined, {
                onSuccess: () => {
                  void navigate("/login", { replace: true });
                },
              });
            }}
          >
            Да
          </Button>
          <Button disabled={logout.isPending} onClick={close}>
            Нет
          </Button>
        </div>
      </Modal>
    </>
  );
}

export function ProfilePage() {
  const { data: me } = useMe();
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <Card title="Личная информация">
        {me && <NamesForm key={me.login} me={me} />}
      </Card>
      <LogoutButton />
    </div>
  );
}
