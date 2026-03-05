<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

GDPR Audit Backend - API сервер для анализа веб-сайтов на соответствие GDPR.

## Queue System

Проект поддерживает **4 режима работы очереди** для обработки сканирований:

### 1. PostgreSQL Queue (по умолчанию)
```bash
QUEUE_TYPE=postgres
```
- ✅ Использует базу данных PostgreSQL для хранения задач
- ✅ Не требует дополнительных сервисов (Redis)
- ✅ Простая настройка и деплой
- ⚠️ Подходит для небольших и средних нагрузок
- 💡 **Use case:** Development, staging, малый/средний production

### 2. Redis/BullMQ Queue
```bash
QUEUE_TYPE=redis
REDIS_URL=redis://localhost:6379
```
- ✅ Высокопроизводительная очередь на базе Redis и BullMQ
- ✅ Локальный worker обрабатывает все задачи на VPS
- ✅ Лучшая производительность для высоких нагрузок
- ⚠️ Требует Redis сервер (дополнительная RAM ~64-128MB)
- 💡 **Use case:** Production с высокой нагрузкой, все задачи обрабатываются локально

### 3. Hybrid Queue (Redis + Cloud Run overflow)
```bash
QUEUE_TYPE=hybrid
REDIS_URL=redis://localhost:6379
WORKER_URL=https://your-worker.run.app
OVERFLOW_QUEUE_THRESHOLD=2
OVERFLOW_WAIT_THRESHOLD_SEC=120
```
- ✅ Оптимизация затрат: 90%+ задач обрабатываются локально (бесплатно)
- ✅ При пиковых нагрузках автоматически использует Cloud Run
- ✅ Cloud Run масштабируется до нуля ($0 в idle)
- ⚠️ Требует Redis + настройку Cloud Run worker
- 💡 **Use case:** Production с переменной нагрузкой, оптимизация затрат

### 4. Cloud Run Queue (serverless only)
```bash
QUEUE_TYPE=cloudrun
WORKER_URL=https://your-worker.run.app
```
- ✅ Полностью serverless, масштабируется автоматически
- ✅ Не требует постоянно работающего VPS worker
- ⚠️ Выше стоимость при постоянной нагрузке
- 💡 **Use case:** Serverless архитектура, спорадические нагрузки

---

**Общие переменные окружения:**
```bash
QUEUE_TYPE=postgres|redis|hybrid|cloudrun  # Тип очереди (по умолчанию: postgres)
REDIS_URL=redis://localhost:6379           # URL Redis (для redis/hybrid)
WORKER_ENABLED=true                        # Включить локальный worker
WORKER_CONCURRENCY=1                       # Параллельные обработчики
WORKER_URL=https://worker.run.app          # URL Cloud Run worker (для hybrid/cloudrun)
OVERFLOW_QUEUE_THRESHOLD=2                 # Порог очереди для overflow (hybrid)
OVERFLOW_WAIT_THRESHOLD_SEC=120            # Порог ожидания для overflow (hybrid)
```

**Docker Compose профили:**
- `postgres` - API с PostgreSQL очередью (по умолчанию)
- `redis` - API с Redis/BullMQ очередью

**Важно:** При использовании `QUEUE_TYPE=postgres` RedisModule не инициализируется, что экономит ресурсы и предотвращает ошибки подключения к несуществующему Redis.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
