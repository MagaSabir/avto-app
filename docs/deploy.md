# Деплой

## Схема

- Frontend: Vercel (проект `avto-app`), домен `rossmik.ru`. Статика, ходит в backend напрямую по `VITE_API_URL=https://api.rossmik.ru`.
- Backend: VPS, Docker Compose, проект `avto_prod` (`docker-compose.prod.yml`). Цепочка: интернет → Caddy (80/443, HTTPS Let's Encrypt) → `api` (:8000, внутри сети Docker) → `db` (PostgreSQL 16, том `db_data`).
- Caddy проксирует только `/api/*`, всё остальное отвечает 404. Документация API (`/docs`) выключена (`API_DOCS=false`).
- Снаружи открыты только порты 22/tcp, 80/tcp, 443/tcp, 443/udp (ufw). Остальное недоступно.

## Пользователи и каталоги на сервере

| Пользователь | Назначение |
|---|---|
| `sabir` | администратор: `sudo` с паролем, вход по SSH-ключу |
| `deploy` | выкат и бэкапы: группа `docker`, без `sudo` и пароля |

Вход под `root` по SSH отключён.

- `/home/deploy/avto_app` — клон репозитория (только `main`), здесь же `.env` (права `600`). Код на сервере не правится.
- `/home/deploy/backups/daily` — ежедневные дампы (последние 14).
- `/home/deploy/backups/pre-deploy` — дампы перед каждым выкатом (последние 10).

Прочее: часовой пояс UTC, swap 2 ГБ, fail2ban (sshd: 5 попыток за 10 минут, бан на 1 час), unattended-upgrades с автоперезагрузкой в 04:00 UTC.

## Первый запуск

1. Сервер: пользователи, ufw, fail2ban, swap, Docker (официальный apt-репозиторий) и git настроены по локальному журналу администратора (не в репозитории).
2. Под `deploy` клонировать репозиторий в `/home/deploy/avto_app`. Для чтения используется read-only deploy key репозитория (GitHub: Settings, Deploy keys).
3. Создать `.env` из `.env.prod.example`, права `chmod 600`. Пароль БД: `openssl rand -hex 24` (только URL-безопасные символы). Он должен совпадать в `POSTGRES_PASSWORD` и в `DATABASE_URL`. Ключи Росско и адрес доставки вносятся вручную.
4. DNS: `A api → 31.77.10.194` .
5. Первый выкат: `HEALTH_TIMEOUT=180` нужен, потому что Caddy получает сертификат; `DEPLOY_BRANCH=feature/deploy` нужен только пока код не слит в `main` (по умолчанию выкатывается `main`, и скрипт отказывается работать на другой ветке):

   ```
   ssh sabir@31.77.10.194
   sudo -iu deploy env HEALTH_TIMEOUT=180 DEPLOY_BRANCH=feature/deploy /home/deploy/avto_app/deploy.sh
   ```
6. Создать пользователя сайта (см. ниже).
7. Проверить: `https://api.rossmik.ru/api/health` отвечает 200; `/api/stock/items` без входа даёт 401; `/docs` и `/` дают 404.
8. Vercel: проверить `VITE_API_URL=https://api.rossmik.ru`, при изменении — redeploy.

## Выкат

Автоматически: после зелёного `CI backend` на push в `main` запускается `.github/workflows/deploy-backend.yml`. Он заходит по SSH на сервер под `deploy` (ключ ограничен командой `deploy.sh`), затем проверяет `https://api.rossmik.ru/api/health`.

Вручную:

```
ssh sabir@31.77.10.194
sudo -iu deploy /home/deploy/avto_app/deploy.sh
```

Либо в GitHub: Actions, Deploy backend, «Run workflow» (`workflow_dispatch`).

Лог каждого выката (с временем UTC): `/home/deploy/deploy.log` (меняется переменной `LOG`). Скрипт игнорирует обрыв SSH-сессии и дописывает вывод в лог.

`deploy.sh`: блокировка от параллельного запуска, проверка ветки (`DEPLOY_BRANCH`, по умолчанию `main`), `git pull --ff-only`, сохранение работающего образа как `avto_api:previous`, сборка, дамп БД, миграции, `up -d`, проверка health. Если `up -d` падает или health не отвечает, скрипт сам возвращает `avto_api:previous` и сообщает, что произошло. После успешного выката удаляются неиспользуемые (dangling) образы.

Ограничения:
- CD выкатывает текущий `main` на момент `git pull`, а не строго SHA, прошедший CI.
- CI и выкат запускают изменения в `backend/**`, `deploy.sh`, `scripts/**`, `docker-compose.prod.yml`, `Caddyfile`, `.github/workflows/ci-backend.yml` и `deploy-backend.yml`. Остальное (`docs/`, `.env.prod.example`, frontend) их не запускает.
- Правка `.env` на сервере сама ничего не применяет: нужен ручной `deploy.sh` или `docker compose ... up -d`.
- Для секретов выката можно создать GitHub Environment `production`, ограниченный веткой `main`, и привязать к нему job `deploy`; тогда секреты недоступны с других веток.
- Порядок выпуска: сначала backend, потом frontend. Изменения API обратно совместимы.

## Откат

Обычный: сделать `git revert` нужного коммита в `main` и выкатить заново (CD или вручную). Миграции БД назад автоматически не откатываются; перед выкатом есть дамп в `pre-deploy`.

Аварийный (под `deploy`, если сайт лежит и нужно быстро вернуть прошлый образ):

```
docker tag avto_api:previous avto_api:latest
docker compose -p avto_prod -f /home/deploy/avto_app/docker-compose.prod.yml up -d api
```

## Резервные копии

- `avto-backup.timer` (systemd) каждый день в 03:30 UTC запускает `scripts/backup.sh` от `deploy`: `pg_dump | gzip` в `/home/deploy/backups/daily/avto-<дата>.sql.gz`, хранится 14 копий.
- Перед каждым выкатом `deploy.sh` делает дамп в `/home/deploy/backups/pre-deploy` (10 копий).
- Пока копии лежат только на сервере. Копии за пределами VPS — позже.

Восстановление. Дальше `dc` означает `docker compose -p avto_prod -f /home/deploy/avto_app/docker-compose.prod.yml`, файл дампа `F=/home/deploy/backups/daily/avto-YYYY-MM-DD.sql.gz`, под пользователем `deploy`.

Проверка копии (боевая база не затрагивается):

```
dc exec -T db sh -c 'createdb -U "$POSTGRES_USER" avto_restore_check'
gunzip -c "$F" | dc exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" avto_restore_check'
dc exec -T db sh -c 'psql -U "$POSTGRES_USER" avto_restore_check -c "select count(*) from stock_items"'
dc exec -T db sh -c 'dropdb -U "$POSTGRES_USER" avto_restore_check'
```

ВНИМАНИЕ: восстановление в боевую базу стирает все текущие данные. Сначала сделайте свежий дамп и убедитесь, что копия проходит проверку выше.

```
dc stop api
dc exec -T db sh -c 'dropdb -U "$POSTGRES_USER" "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
gunzip -c "$F" | dc exec -T db sh -c 'psql -v ON_ERROR_STOP=1 --single-transaction -U "$POSTGRES_USER" "$POSTGRES_DB"'
dc up -d api
```

## Пользователи сайта

Регистрации нет, пользователей создаёт администратор. Команда интерактивная, запускать в настоящем терминале (`ssh -t`):

```
ssh -t sabir@31.77.10.194 \
  sudo -iu deploy docker compose -p avto_prod -f /home/deploy/avto_app/docker-compose.prod.yml \
  exec api python -m app.users set-password <login>
```

Та же команда меняет пароль существующего пользователя.

## Логи

```
docker compose -p avto_prod -f /home/deploy/avto_app/docker-compose.prod.yml logs -f api
sudo journalctl -u avto-backup.service
systemctl list-timers avto-backup.timer
```

Лог выкатов: `/home/deploy/deploy.log`.

Аналогично для `caddy` и `db`.

## Секреты

Значений здесь нет, только имена.

- GitHub (Settings, Secrets and variables, Actions): `DEPLOY_SSH_KEY` (приватный ключ для CD), `DEPLOY_KNOWN_HOSTS` (результат `ssh-keyscan` сервера).
- Сервер, `/home/deploy/avto_app/.env`: переменные из `.env.prod.example` — `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL`, `CORS_ORIGINS`, `SUPPLIERS`, `ROSSKO_KEY1`, `ROSSKO_KEY2`, `ROSSKO_DELIVERY_ID`, `ROSSKO_ADDRESS_ID`, `API_DOCS`.
- Vercel: `VITE_API_URL` (не секрет).
