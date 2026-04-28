# Deploy Playbook — policytracker.eu backend

Воспроизводимая инструкция развёртывания GDPR backend на чистом
Ubuntu 24.04 VPS. Используется для `api.policytracker.eu` на Contabo
167.86.116.58 (см. `TODO.md` для текущего состояния инстанса).

**Никаких секретов в этом файле.** Все ключи и пароли берутся из
`.env.production` на сервере (файл создаётся вручную, не коммитится).

---

## Требования

- Ubuntu 24.04 LTS, x86_64, ≥ 2 CPU, ≥ 4 GB RAM, ≥ 20 GB SSD
- Root-доступ по SSH
- Домен с A-записью, указывающей на IP VPS
- Секреты наготове: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `SENTRY_DSN` (по желанию),
  Postgres пароль

---

## 1. Bootstrap VPS (один раз)

```bash
ssh root@<VPS_IP>

# Swap (рекомендуется для 8 GB RAM и меньше)
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo "/swapfile none swap sw 0 0" >> /etc/fstab

# Firewall
apt-get update -qq
apt-get install -y -qq ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment "SSH"
ufw allow 80/tcp comment "HTTP / Lets Encrypt"
ufw allow 443/tcp comment "HTTPS"
ufw --force enable

# Docker + Compose (если ещё нет)
curl -fsSL https://get.docker.com | sh
# Compose v2 идёт в составе docker-ce, проверь: docker compose version

# Nginx + certbot
apt-get install -y -qq nginx certbot python3-certbot-nginx
rm -f /etc/nginx/sites-enabled/default
```

---

## 2. Доставка кода

Из локальной машины разработчика:

```bash
rsync -az --delete \
  --exclude '.git/' --exclude 'node_modules/' --exclude 'dist/' \
  --exclude 'coverage/' --exclude 'tests/load/results/' \
  --exclude '.env' --exclude '.env.*' \
  --exclude 'DEPLOYMENT.md' --exclude 'MARKET_ANALYSIS.md' \
  --exclude 'NEW_PLAN.md' --exclude 'PLAN.md' \
  --exclude '.claude/' --exclude 'gcp-service-account.json' \
  -e "ssh -i ~/.ssh/<key>" \
  ./ root@<VPS_IP>:/opt/gdpr-backend/
```

> Почему rsync, а не git clone: не нужно давать VPS доступ к Azure
> DevOps / GitHub, и синхронизация инкрементальная (только дельта).
> Для CI/CD рассмотреть переход на git-based deploy с deploy-ключом.

---

## 3. `.env.production` (на сервере)

Создать `/opt/gdpr-backend/.env.production` вручную, `chmod 600`:

```bash
# --- Database (dockerised postgres:16) ---
POSTGRES_USER=gdpr
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=gdpr_audit

# --- App ---
NODE_ENV=production
PORT=3000

# --- Queue ---
QUEUE_TYPE=redis              # или postgres для single-node без Redis
REDIS_URL=redis://redis:6379  # docker network service name
WORKER_ENABLED=true
WORKER_CONCURRENCY=1

# --- CORS ---
FRONTEND_URL=https://policytracker.eu

# --- Email (Resend) ---
RESEND_API_KEY=<re_...>
EMAIL_FROM=PolicyTracker <noreply@policytracker.eu>
ADMIN_EMAIL=<email>

# --- Stripe ---
STRIPE_SECRET_KEY=<sk_live_... или sk_test_...>
STRIPE_WEBHOOK_SECRET=<whsec_...>

# --- Cloudflare Turnstile (captcha) ---
# Без этого POST /scanner/scan fails closed в production
TURNSTILE_SECRET_KEY=<secret>

# --- Sentry (опционально) ---
SENTRY_DSN=<dsn>
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
```

Дополнительные env-переменные (все опциональные, с дефолтами) —
см. `.env.example`.

---

## 4. Первый запуск

```bash
cd /opt/gdpr-backend
docker compose --env-file .env.production --profile redis up -d --build
```

На первом запуске Prisma применит миграции автоматически
(`npx prisma migrate deploy` в `command:` сервиса `api-redis`).

Проверка:

```bash
docker compose ps                           # все healthy
curl http://127.0.0.1:3000/api/v1/health    # 200 OK
docker logs gdpr-api-redis --tail 50
```

---

## 5. Nginx + SSL (один раз на домен)

`/etc/nginx/sites-available/api.policytracker.eu`:

```nginx
server {
    listen 80;
    server_name api.policytracker.eu;
    client_max_body_size 2M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Scanner может работать до 2 минут (SCAN_TIMEOUT_MS)
        proxy_read_timeout 180s;
        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
    }

    location = /favicon.ico { access_log off; log_not_found off; return 204; }
    location = /robots.txt { access_log off; log_not_found off; return 204; }
}
```

```bash
ln -sf /etc/nginx/sites-available/api.policytracker.eu \
       /etc/nginx/sites-enabled/api.policytracker.eu
nginx -t && systemctl enable --now nginx

# Let's Encrypt — добавит SSL блок и HTTPS redirect автоматически
certbot --nginx -d api.policytracker.eu \
  --non-interactive --agree-tos \
  -m <admin-email> --redirect

# Auto-renewal
systemctl status certbot.timer   # уже включён после установки certbot
```

Проверка:

```bash
curl -sI https://api.policytracker.eu/api/v1/health
# HTTP/2 200
```

---

## 6. Обновление deploy (пересборка образа)

```bash
# Локально
rsync -az --delete [...] ./ root@<VPS>:/opt/gdpr-backend/

# На сервере
cd /opt/gdpr-backend
docker compose --env-file .env.production --profile redis up -d --build
docker image prune -f   # чистим старый образ
```

Миграции БД применяются автоматически при старте контейнера через
`npx prisma migrate deploy`.

---

## 7. Типовые операции

### Логи

```bash
docker logs -f gdpr-api-redis
docker logs -f gdpr-postgres
docker logs -f gdpr-redis
```

### Backup Postgres

```bash
docker exec gdpr-postgres pg_dump -U gdpr gdpr_audit \
  | gzip > /root/backups/gdpr-$(date +%F-%H%M).sql.gz
```

> **TODO:** автоматизировать cron + offsite upload (S3 / Backblaze).
> См. `TODO.md` — Backup Postgres cron.

### Restart одного сервиса

```bash
docker compose --env-file .env.production --profile redis restart api-redis
```

### Редактирование `.env.production` без даунтайма

Нет — изменения переменных требуют `up -d` (пересоздание контейнера).
Время простоя ~5 секунд благодаря graceful shutdown.

### Сменить SCAN_TIMEOUT_MS / rate limits / LAUNCH_MAX_PRICE

Правим `.env.production`, затем:

```bash
docker compose --env-file .env.production --profile redis up -d
```

---

## 8. Известные gotchas

| Проблема                                         | Фикс                                                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `POST /scanner/scan` возвращает 400 в production | Не задан `TURNSTILE_SECRET_KEY`. В prod captcha fails closed по дизайну                                      |
| Bull теряет job'ы под нагрузкой                  | Проверь `redis-cli CONFIG GET maxmemory-policy` — должно быть `noeviction`                                   |
| Prisma migrate hangs при старте                  | Проверь что `DATABASE_URL` доступен из api-контейнера; URI-escape спецсимволов в пароле (`!` → `%21` и т.д.) |
| Let's Encrypt renewal fails                      | `certbot renew --dry-run`; порт 80 должен быть открыт снаружи                                                |
| OOM / swap активно используется                  | `docker stats`; уменьшить `WORKER_CONCURRENCY` или поднять RAM                                               |
| Kernel upgrade pending после apt                 | `needrestart -r a` или `reboot` в окно maintenance                                                           |

---

## 9. Checklist для нового инстанса

- [ ] Swap настроен (>= 2 GB)
- [ ] UFW активен (22/80/443 only)
- [ ] Docker + Compose установлены
- [ ] DNS A-record смотрит на IP VPS
- [ ] Код доставлен в `/opt/gdpr-backend`
- [ ] `.env.production` создан, `chmod 600`
- [ ] `docker compose up` — все контейнеры healthy
- [ ] `curl http://127.0.0.1:3000/api/v1/health` → 200
- [ ] Nginx конфиг для домена создан
- [ ] `certbot --nginx` — сертификат получен
- [ ] `curl https://<домен>/api/v1/health` → 200
- [ ] Postgres backup настроен (cron)
- [ ] `TURNSTILE_SECRET_KEY` заполнен (иначе scan endpoint не работает)
- [ ] `SENTRY_DSN` заполнен (иначе ошибки не улетают)
