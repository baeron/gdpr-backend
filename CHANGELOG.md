# Changelog

## [] - 2026-01-26

### Features
- feat(ci): add SemVer release pipeline (60f9924)
- feat(email): add multi-language email templates with 24 EU languages support (c387354)
- feat(queue): add pipeline parameter for Redis/BullMQ selection (#3) (13a2623)
- feat(backup): add PostgreSQL backup script with Backblaze B2 (#5) (16bb0ad)
- feat(health): add comprehensive health check endpoints (#9, #63) (0f3535e)
- feat: Implement proper CI/CD with DEV/PROD environments (c45a6c7)

### Bug Fixes
- fix(docker): add missing Stripe env vars to api-redis service (c6ee1e8)
- fix(deploy): add profiles to prevent port conflicts between api and api-redis (01b0f33)
- fix(test): update E2E test for new health endpoint location (7a8ed5b)
- fix: stop only API containers during deploy, keep postgres running (03e2c23)
- fix: use printf instead of heredoc to prevent STRIPE_SECRET_KEY truncation (a55f5b3)

### Documentation
- docs: update .env.example with all environment variables (3e791fa)
- docs: add Queue System documentation (PostgreSQL/Redis) (770399e)

### Maintenance
- chore(release): v0.0.2-rc [skip ci] (b4440f9)
- test(queue): add unit tests for Redis/BullMQ and PostgreSQL queue services (80%+ coverage) (089f8e4)
- chore: update package-lock.json with bullmq dependencies (71a5f87)

### Other
- Update changes (34dc1fc)
- CORS issue (50d3bed)
- Allow prod deploy without dev 3 (e7e2f90)
- Allow prod deploy without dev 2 (2fb40ef)
- Allow prod deploy without dev (875ca8c)
- Ensure postgres is running before dev deploy (8714be3)
- Use gdpr-postgres host for dev DB (8e40eca)
- Use external network for dev DB (acb66b3)
- Fix dev compose to use host postgres (c06c8b1)
- Add dev compose file for dev stack (629eaa1)
- AzureDevOps config chanfes (327c500)
- Some experiment with price (a4a736f)
- change payment price (b9a9586)
- Fix deploy env separation (e6ed975)

---

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

