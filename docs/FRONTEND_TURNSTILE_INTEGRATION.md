# Frontend — интеграция Cloudflare Turnstile

Спека для команды фронтенда: что нужно сделать чтобы фронт начал
проходить captcha-проверку на новом backend (`api.policytracker.eu`).

**Контекст.** Backend (коммит `4e5ea59`) защищает 3 эндпоинта
TurnstileGuard'ом. В production guard всегда требует валидный токен в
теле запроса. Фронт сейчас токен не отправляет → backend возвращает
**403 Forbidden** на любой scan/audit. Это блокер всей бизнес-логики.

---

## 1. Cloudflare Dashboard — получить ключи

Зайти в Cloudflare → **Turnstile** → выбрать (или создать) сайт.

Если сайт уже есть — должна существовать пара ключей:

- **Site Key** — публичный, идёт в код фронта (формат `0x4AAAAA...`)
- **Secret Key** — серверный, уже прописан на бэке (`0x4AAAAAADDnjH9vmfnFF0YiJpHKKRbG3sA`)

> **Важно:** Site Key, который добавляется во фронт, должен быть
> **из той же пары** что и Secret Key на бэке. Если site key взять
> из другого Cloudflare-сайта — все токены будут невалидными.

В настройках сайта проверить **Domains**:

```
policytracker.eu
www.policytracker.eu
dev.policytracker.eu        (если используется dev)
www.dev.policytracker.eu    (если используется dev)
localhost                   (для локальной разработки)
```

Widget mode рекомендован **Managed** (Cloudflare сам решает: невидимая
проверка / interactive / managed challenge).

---

## 2. Куда добавлять widget

Backend требует токен на этих эндпоинтах:

| Endpoint                     | Когда вызывается                          | Поле с токеном   |
| ---------------------------- | ----------------------------------------- | ---------------- |
| `POST /api/v1/scanner/scan`  | Синхронный скан с лендинга / hero-формы   | `turnstileToken` |
| `POST /api/v1/scanner/queue` | Постановка скана в очередь (asynchronous) | `turnstileToken` |
| `POST /api/v1/audit`         | Заявка на аудит (форма с email)           | `turnstileToken` |

**Все три формы** на фронте должны рендерить Turnstile widget и
прокидывать токен в body запроса.

---

## 3. Установка библиотеки (Angular)

Рекомендую `ngx-turnstile` — поддерживаемая обёртка для Angular 16+:

```bash
npm install ngx-turnstile
```

Альтернатива — vanilla JS (без библиотеки): подключить
`https://challenges.cloudflare.com/turnstile/v0/api.js` через
`<script>` тег в `index.html` и вызывать `turnstile.render()` руками.
Чуть больше boilerplate, но работает в любой версии Angular.

---

## 4. Конфиг (environment)

`src/environments/environment.prod.ts`:

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://api.policytracker.eu/api/v1',
  turnstileSiteKey: '0x4AAAAA...', // ← из Cloudflare, см. п. 1
};
```

Для dev:

```typescript
// environment.ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api/v1',
  turnstileSiteKey: '1x00000000000000000000AA', // ← Cloudflare test key (всегда passes)
};
```

> Cloudflare предоставляет **тестовые** Site Keys для разработки —
> они всегда возвращают success без UI. Список:
> https://developers.cloudflare.com/turnstile/troubleshooting/testing/

---

## 5. Пример компонента (ngx-turnstile)

```typescript
// hero-scan-form.component.ts
import { Component, signal } from '@angular/core';
import { NgxTurnstileModule } from 'ngx-turnstile';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-hero-scan-form',
  standalone: true,
  imports: [NgxTurnstileModule /* ... */],
  template: `
    <form (ngSubmit)="onSubmit()">
      <input [(ngModel)]="websiteUrl" name="url" required />

      <ngx-turnstile
        [siteKey]="siteKey"
        (resolved)="onTurnstileResolved($event)"
        (errored)="onTurnstileError($event)"
        theme="light"
        size="normal"
      ></ngx-turnstile>

      <button type="submit" [disabled]="!turnstileToken() || loading()">
        Scan now
      </button>
    </form>
  `,
})
export class HeroScanFormComponent {
  readonly siteKey = environment.turnstileSiteKey;
  websiteUrl = '';
  turnstileToken = signal<string | null>(null);
  loading = signal(false);

  constructor(private scanner: ScannerApiService) {}

  onTurnstileResolved(token: string | null) {
    this.turnstileToken.set(token);
  }

  onTurnstileError(error: unknown) {
    console.error('[Turnstile] error', error);
    this.turnstileToken.set(null);
  }

  async onSubmit() {
    const token = this.turnstileToken();
    if (!token) return;

    this.loading.set(true);
    try {
      await this.scanner.scan({
        websiteUrl: this.websiteUrl,
        turnstileToken: token,
      });
    } finally {
      // Token is single-use — reset widget after submit (success or fail)
      this.turnstileToken.set(null);
      // Если используете ViewChild на ngx-turnstile, вызовите .reset()
      this.loading.set(false);
    }
  }
}
```

> **Critical:** токен Turnstile **одноразовый**. После любого
> отправленного запроса его нужно сбросить (виджет сам
> перезагрузится либо вручную через `.reset()`).

---

## 6. Сервис для API-запросов

```typescript
// scanner-api.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';

interface ScanRequest {
  websiteUrl: string;
  turnstileToken: string; // ← обязательно в production
  saveToDb?: boolean;
  auditRequestId?: string;
}

interface QueueScanRequest {
  websiteUrl: string;
  turnstileToken: string;
  userEmail?: string;
  locale?: string;
  priority?: number;
  auditRequestId?: string;
}

interface CreateAuditRequest {
  websiteUrl: string;
  email: string;
  agreeScan: boolean;
  agreeMarketing?: boolean;
  locale?: string;
  turnstileToken: string;
}

@Injectable({ providedIn: 'root' })
export class ScannerApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  scan(req: ScanRequest) {
    return firstValueFrom(this.http.post(`${this.base}/scanner/scan`, req));
  }

  queue(req: QueueScanRequest) {
    return firstValueFrom(this.http.post(`${this.base}/scanner/queue`, req));
  }

  createAudit(req: CreateAuditRequest) {
    return firstValueFrom(this.http.post(`${this.base}/audit`, req));
  }
}
```

---

## 7. Vanilla JS вариант (без ngx-turnstile)

Если не хочется ставить пакет, в `index.html`:

```html
<script
  src="https://challenges.cloudflare.com/turnstile/v0/api.js"
  defer
></script>
```

В компоненте:

```typescript
declare const turnstile: {
  render: (
    selector: string | HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      'error-callback'?: () => void;
      'expired-callback'?: () => void;
      theme?: 'light' | 'dark' | 'auto';
      size?: 'normal' | 'compact';
    },
  ) => string; // widget id
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

@Component({
  /* ... */
})
export class HeroScanFormComponent implements AfterViewInit {
  @ViewChild('turnstileContainer') container!: ElementRef<HTMLDivElement>;
  private widgetId?: string;
  turnstileToken = signal<string | null>(null);

  ngAfterViewInit() {
    this.widgetId = turnstile.render(this.container.nativeElement, {
      sitekey: environment.turnstileSiteKey,
      callback: (token) => this.turnstileToken.set(token),
      'expired-callback': () => this.turnstileToken.set(null),
      'error-callback': () => this.turnstileToken.set(null),
      theme: 'light',
    });
  }

  ngOnDestroy() {
    if (this.widgetId) turnstile.remove(this.widgetId);
  }

  async onSubmit() {
    const token = this.turnstileToken();
    if (!token) return;
    await this.scanner.scan({ websiteUrl: this.url, turnstileToken: token });
    if (this.widgetId) turnstile.reset(this.widgetId); // single-use reset
    this.turnstileToken.set(null);
  }
}
```

```html
<form (ngSubmit)="onSubmit()">
  <input [(ngModel)]="url" name="url" required />
  <div #turnstileContainer></div>
  <button type="submit" [disabled]="!turnstileToken()">Scan</button>
</form>
```

---

## 8. Content Security Policy (CSP)

Если у фронта прописан CSP-заголовок (через nginx или meta tag), добавить:

```
script-src  'self' https://challenges.cloudflare.com;
frame-src   https://challenges.cloudflare.com;
connect-src 'self' https://api.policytracker.eu
            https://challenges.cloudflare.com;
```

Без `frame-src` widget не отрендерится — Turnstile использует iframe.

---

## 9. Тестирование

### Локально (`localhost:4200`)

1. Использовать Cloudflare **test site key** `1x00000000000000000000AA`
   (всегда выдаёт `XXXX.DUMMY.TOKEN.XXXX`)
2. Backend в dev-режиме `NODE_ENV != 'production'` — captcha не
   проверяется, любой токен (даже фейковый) проходит

### Staging (api.dev.policytracker.eu)

1. Создать **отдельный Turnstile site** в Cloudflare с доменами
   `dev.policytracker.eu`, `www.dev.policytracker.eu`
2. Site Key — в `environment.staging.ts`, Secret Key — в
   `.env.production` старого Vultr (если dev мигрирует на Contabo —
   создать `.env.devprod` на новом VPS)

### Production (api.policytracker.eu)

1. Site Key — из реального Cloudflare-сайта `policytracker.eu`
2. Открыть https://policytracker.eu, заполнить форму скана
3. **DevTools → Network**: запрос `POST /api/v1/scanner/scan`
   - Body должен содержать `"turnstileToken": "..."` (длинная base64-строка)
   - Response 200 OK + результаты скана
4. Если 403 — токен невалиден; проверить:
   - Site Key и Secret Key из одной пары?
   - Domain в Cloudflare site whitelist включает `policytracker.eu`?
   - Не истёк ли токен (TTL 5 минут с момента resolve)?

### Smoke с curl (без реального токена — должен вернуть 403)

```bash
curl -X POST https://api.policytracker.eu/api/v1/scanner/scan \
  -H "Content-Type: application/json" \
  -H "Origin: https://policytracker.eu" \
  -d '{"websiteUrl": "https://example.com"}'
# → 403 {"message":"Captcha verification failed", "errorCodes": ["missing-input-response"]}
```

---

## 10. Чеклист интегратору

- [ ] В Cloudflare Dashboard скопирован Site Key (тот же сайт что и Secret Key на бэке)
- [ ] В whitelist Cloudflare-сайта добавлены: `policytracker.eu`, `www.policytracker.eu` (+ `localhost` для dev)
- [ ] `environment.prod.ts` содержит `turnstileSiteKey: '0x4AAAAA...'`
- [ ] `environment.ts` (dev) содержит test key `1x00000000000000000000AA`
- [ ] Установлен `ngx-turnstile` (или подключён vanilla скрипт в `index.html`)
- [ ] Widget добавлен на 3 формы: hero scan, audit request, queue scan
- [ ] Token прокидывается в API-сервис как `turnstileToken` в body POST
- [ ] После submit токен сбрасывается (`reset()` или re-render виджета)
- [ ] CSP обновлён (если используется): `frame-src https://challenges.cloudflare.com`
- [ ] Локальный smoke: форма работает с test key
- [ ] Prod smoke: реальная форма даёт 200 на `/scanner/scan` с настоящим токеном
- [ ] Error UX: если token expired / error — показать ретрай вместо silent fail

---

## 11. Что НЕ нужно делать

- ❌ Не отправлять Site Key или Secret Key через API в фронт (Site Key
  публичный — хардкодить в env, Secret Key вообще не должен попасть на клиент)
- ❌ Не пытаться кэшировать токен — он одноразовый и TTL ~5 минут
- ❌ Не звать `siteverify` со фронта — это серверный endpoint, secret
  раскроется в network tab
- ❌ Не делать собственный fallback "если turnstile не загрузился —
  отправить без токена" — backend всё равно отклонит

---

## 12. Контакты / вопросы

- Spec backend captcha logic: `src/common/turnstile/turnstile.service.ts`
  и `src/common/turnstile/turnstile.guard.ts`
- DTO с полями `turnstileToken`:
  - `src/scanner/scanner.controller.ts` (ScanRequestDto, QueueScanRequestDto)
  - `src/audit/dto/create-audit.dto.ts` (CreateAuditDto)
- Cloudflare Turnstile docs: https://developers.cloudflare.com/turnstile/
- Test keys: https://developers.cloudflare.com/turnstile/troubleshooting/testing/
- ngx-turnstile npm: https://www.npmjs.com/package/ngx-turnstile
