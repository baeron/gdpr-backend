# Backend — оставшиеся задачи

Снимок на **2026-04-26** после серии коммитов `4e5ea59…c4c28d6`.
Базовый отчёт: `BACKEND_DUE_DILIGENCE.md`. Все автоматизируемые
пункты из таблицы техдолга (Section 13) закрыты — здесь только то,
что требует ручных действий или относится к long-term.

Условные обозначения:

- **🔴 Блокер** — нельзя считать систему production-ready без этого
- **🟡 Важно** — стоит сделать в ближайшие 1–2 спринта
- **🟢 Long-term** — нужно когда вырастет нагрузка / команда / scope

---

## 🔴 Блокеры (ручные операции, код менять не надо)

### 1. Ротация GCP service account ключа

**Контекст:** файл `gcp-service-account.json` присутствовал в репо
до коммита `4e5ea59`. Сейчас он в `.gitignore`, но **остаётся в
git-истории** и **остаётся валидным в GCP**.

**Что сделать:**

1. GCP Console → IAM & Admin → Service Accounts → найти аккаунт.
2. Создать **новый** ключ → скачать → положить локально (не в репо!).
3. Обновить deployment env (Vultr, Cloud Run, локальные `.env`).
4. **Удалить старый ключ** в GCP Console (это инвалидирует утечку).
5. Прокрутить логи GCP audit → проверить нет ли подозрительных
   вызовов от старого ключа за период с момента утечки.

**Кто:** владелец проекта (нужен доступ к GCP Console).
**Время:** 30–60 мин.
**Риск если не сделать:** утекший ключ может использоваться третьими
лицами для запуска оплачиваемых GCP-ресурсов от вашего имени.

---

### 2. Очистка GCP-ключа из git history

**Контекст:** даже после `.gitignore` файл живёт во всех старых
коммитах. `git log --all --oneline -- gcp-service-account.json`
покажет историю.

**Что сделать:**

```bash
# 1. Установить git-filter-repo (рекомендованный вместо filter-branch)
brew install git-filter-repo

# 2. Сделать свежий clone (filter-repo требует чистый репо)
git clone --mirror https://github.com/baeron/gdpr-backend.git gdpr-clean
cd gdpr-clean

# 3. Удалить файл из всей истории
git filter-repo --path gcp-service-account.json --invert-paths

# 4. Force-push в обе реморки (azure + origin)
git push --force --all
git push --force --tags
```

**ВАЖНО — координация:**

- Все разработчики должны **выкинуть свои локальные клоны**
  и сделать новый clone после force-push.
- Открытые PR / feature branches должны быть **зарибейзены** на
  новую историю.
- Pull request URL'ы и SHA коммитов **изменятся** — обновить ссылки
  в documentation, Jira/Linear/Notion.

**Альтернатива (если history rewrite неприемлем):**

- Просто ротировать ключ (пункт 1) — этого достаточно с точки
  зрения безопасности. История останется, но ключ невалиден.

**Кто:** tech lead + договорённость с командой.
**Время:** 1–2 часа + координация.

---

## 🟡 Важно (1–2 спринта)

### 3. Sentry DSN в production ✅ DSN ЗАДЕПЛОЕН — остался smoke-test

**Сделано в коде:**

- `Sentry.init()` в API (`src/main.ts`) — release из `package.json`,
  free-tier-friendly sample rates, `beforeSend` фильтр на 4xx,
  `ignoreErrors` для известного шума (ECONNRESET, P2025, etc.)
- `Sentry.init()` в worker (`src/worker/main.ts`) с release
  `gdpr-worker@x.y.z` — та же DSN, отдельный release tag
- `Sentry.captureException` в `GlobalExceptionFilter` (только 5xx)
- В worker scan failure path — `withScope` с тегами `jobId` +
  `websiteUrl` для корреляции
- `Sentry.close(2000)` на SIGTERM/SIGINT в обоих процессах
- Startup warning если `SENTRY_DSN` пустой в production

**Сделано (ops, 2026-04-27):**

- ✅ Создан проект `gdpr-backend` в Sentry (org `policytracker`,
  регион EU — `o4511292363767808.ingest.de.sentry.io`)
- ✅ `SENTRY_DSN` добавлен в production env (API + worker)
- ✅ Передеплой прошёл успешно
- ✅ Alert rule настроен через мастер: «high priority issues,
  > 10 occurrences / 1 min» → email

**Осталось (когда будет время):**

1. Smoke-test — убедиться что events реально приходят:
   - Вариант А (быстро): попросить Cascade добавить временный
     endpoint `/api/v1/debug/sentry-test` который кидает
     `throw new Error('sentry-smoke-test')`, дёрнуть curl-ом,
     проверить в Sentry → Issues, убрать endpoint вторым коммитом.
   - Вариант Б (пассивно): дождаться первой реальной 5xx — она
     прилетит сама. Проверить что в issue есть тэг
     `release: gdpr-backend@<version>`.
2. Опционально: подключить Slack-нотификации (Sentry → Alerts →
   Integrations → Slack) если email не удобен.

**Риск отложить smoke-test:** низкий. Если DSN ошибочный — Sentry
SDK молча no-op'ит, а в startup-логах нет warning'а (warning
выводится только если DSN **пустой**). Лучше проверить.

---

### 4. Бэкапы Postgres

**Контекст:** в репозитории есть `scripts/backup-db.sh`, но не видно
что он где-то планируется (cron / managed backup).

**Что сделать:**

- **Если managed Postgres** (Supabase, RDS, Cloud SQL): включить
  Point-in-Time Recovery в консоли провайдера, проверить retention
  (минимум 7 дней).
- **Если self-hosted на Vultr VPS**: настроить cron для
  `scripts/backup-db.sh` + offsite копию (например в S3-совместимое
  хранилище).
  ```cron
  # /etc/cron.d/gdpr-backup — daily at 02:30
  30 2 * * * deploy /opt/gdpr/scripts/backup-db.sh >> /var/log/gdpr-backup.log 2>&1
  ```
- Раз в квартал — **тест восстановления** (поднять копию в staging,
  убедиться что приложение стартует).

**Время:** 2–4 часа на первичную настройку.
**Риск:** потеря всех данных при сбое диска / human error.

---

### 5. Frontend миграция на `/api/v1`

**Контекст:** backend делает dual-mount, frontend ещё ходит на
голый `/api/...`. Не блокер (back-compat работает), но фиксация
контракта v1 на клиенте — небольшая работа сейчас, чтобы будущий
v2 был чистым.

**Подробный план:** см. сообщение Cascade от 2026-04-26 12:28
(или попросить заново).

**Время:** 2–4 часа на frontend.

---

### 6. PgBouncer (только если выходим на 10x нагрузки)

**Контекст:** сейчас Prisma открывает прямые connection'ы к Postgres.
При >50 одновременных запросов с воркеров+API это упрётся в
`max_connections`.

**Что сделать (когда станет нужно):**

- Запустить PgBouncer в transaction-pooling mode.
- В `DATABASE_URL` указать порт PgBouncer (обычно 6432).
- Для Prisma добавить `?pgbouncer=true&connection_limit=1` к
  connection string.

**Триггер:** видим в логах ошибки `too many connections` или
`PrismaClientInitializationError` при пиковых нагрузках.

---

## 🟢 Long-term

### 7. Метрики (Prometheus / Grafana)

- Бизнес: scans/min, payment success rate, queue depth, DLQ size.
- Технические: HTTP latency p50/p95/p99, DB pool usage, Redis hit rate.
- Сейчас всё это видно только косвенно через логи.

**Готовый старт:** `nestjs-prometheus` + Grafana Cloud free tier.

---

### 8. Distributed tracing

- OpenTelemetry → Jaeger / Honeycomb / Sentry Performance.
- Полезно когда появятся 3+ микросервиса. Сейчас два процесса
  (API + worker) — можно прожить на логах.

---

### 9. Zero-downtime deploy

**Сейчас:** SIGTERM ловится корректно (после `cd116b9`), graceful
shutdown работает. Но deployment скрипты в `cloudbuild.yaml` /
docker-compose не делают rolling-update.

**Что нужно:**

- Health check endpoints уже есть (`/api/health/detailed`).
- Добавить readiness probe отдельно от liveness (для очереди
  «принимает запросы» vs «процесс жив»).
- В deploy-скрипте: запустить новый контейнер → дождаться health
  green → переключить балансировщик → killSIGTERM старому.

**Сложность:** зависит от хостинга. На Vultr VPS — nginx upstream
swap. На Cloud Run — встроено.

---

### 10. Infrastructure as Code (Terraform / Pulumi)

- Сейчас вся инфраструктура (VPS, GCP проект, Cloudflare, домены)
  настроена вручную.
- Bus factor = 1: если уйдёт человек, который это настраивал —
  восстановление займёт дни.
- При следующем ребилде / переезде — описать всё в Terraform.

---

### 11. Hardcoded бизнес-константы → ENV ✅ СДЕЛАНО (2026-04-27)

Из § 14 отчёта — все вынесены в env с дефолтами, идентичными
прежним хардкод-значениям:

- `LAUNCH_MAX_PRICE` (default 99) — `src/pricing/pricing.service.ts`
  через `ConfigService`
- `LAUNCH_CAMPAIGN_ID` (default `launch-2026`) — там же
- `SCAN_TIMEOUT_MS` (default 120000) — `src/scanner/scanner.service.ts`
- `SCAN_RATE_*` / `SCAN_QUEUE_*` (8 переменных) — per-route rate
  limits в `src/scanner/scanner.controller.ts` через
  `src/scanner/scanner.config.ts` (модуль читает env при старте,
  декораторы подставляют значения)

Все переменные задокументированы в `.env.example`. Тюнинг на
production теперь не требует ребилда.

---

### 12. Bus factor / onboarding doc

- README сейчас generic NestJS boilerplate.
- Добавить раздел «как поднять локально», «как добавить новый
  scanner analyzer», «как работает queue selection (`QUEUE_TYPE`)»,
  «куда смотреть при инциденте».

---

### 13. Оставшиеся `as any` (38 шт.)

Все оставшиеся — **легитимные** (BullMQ untyped, browser DOM
globals, Stripe webhook payloads, Prisma JSON-input quirk).
Не приоритет, но можно постепенно вычищать через типизированные
обёртки.

---

## ✅ Что уже сделано в этой серии коммитов

- Section 13 таблица техдолга: **9/9 пунктов**
- Pricing race (§ 5)
- Email reminder leak (§ 14)
- Graceful shutdown (§ 6)
- Idempotency keys (§ 4)
- Idempotency cleanup cron
- DLQ для scan jobs (§ 6)
- BaseQueueService refactor (§ 13)
- 110 новых тестов (414 → 523)
- 30 CVE → 0
- 4/4 strict TypeScript flags

Подробнее: `git log --oneline 4e5ea59..c4c28d6`.
