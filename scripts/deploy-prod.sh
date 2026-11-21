#!/usr/bin/env bash
# =============================================================================
# Production deploy on the Contabo host (runs ON the server, from
# /opt/gdpr-backend, after the code has been rsynced there).
#
#   scripts/deploy-prod.sh <release-tag>
#
# Called by the DeployProd stage of azure-pipelines.yml; can also be run by
# hand for a manual deploy or with --rollback.
#
# What it does, in order:
#   1. Checks .env.production exists and carries every required key. The
#      file is server-managed and is NEVER written by CI: the old pipeline
#      regenerated it from ~18 variables and silently dropped everything
#      else (ADMIN_API_TOKEN, TURNSTILE_SECRET_KEY, FRONTEND_URL, ...).
#   2. Dumps the database (pg_dump, gzip) before touching anything; keeps
#      the last 5 pre-deploy dumps in ./backups/.
#   3. Builds the API image tagged gdpr-backend-api:<release-tag>.
#   4. Runs `prisma migrate deploy` once, as its own step, with the new image.
#   5. Swaps the API container to the new image and waits for /api/health.
#   6. On a failed health check: rolls the container back to the previous
#      image and exits non-zero. (Migrations are not rolled back — they are
#      expected to be backward compatible; the pre-deploy dump is the escape
#      hatch.)
#   7. Records the release and prunes API images older than the previous one.
#
#   scripts/deploy-prod.sh --rollback   re-starts the previously deployed image.
#
# Never runs `docker volume prune`, `down`, or touches postgres/redis
# containers beyond starting them if they are not running.
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE=.env.production
IMAGE_REPO=gdpr-backend-api
STATE_CURRENT=.deployed-release
STATE_PREVIOUS=.deployed-release.previous
BACKUP_DIR=backups
KEEP_DUMPS=5

REQUIRED_KEYS=(
  POSTGRES_PASSWORD
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  RESEND_API_KEY
  ADMIN_API_TOKEN
  TURNSTILE_SECRET_KEY
  FRONTEND_URL
)

log() { printf '\n=== %s ===\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

env_value() {
  # Last assignment wins, like docker compose's env_file parsing. Quotes
  # around the value are stripped.
  # An absent key yields "" (grep's non-zero exit must not trip set -e).
  { grep -E "^${1}=" "$ENV_FILE" || true; } | tail -n1 | cut -d= -f2- |
    sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/'
}

[ -f "$ENV_FILE" ] || die "$ENV_FILE not found in $(pwd). Create it by hand (see DEPLOY.md §3); CI never writes it."

missing=()
for key in "${REQUIRED_KEYS[@]}"; do
  [ -n "$(env_value "$key")" ] || missing+=("$key")
done
[ ${#missing[@]} -eq 0 ] || die "$ENV_FILE is missing: ${missing[*]}"

# The queue type decides which compose profile/service runs the API.
case "$(env_value QUEUE_TYPE)" in
  redis | hybrid) PROFILE=redis; SERVICE=api-redis ;;
  *) PROFILE=postgres; SERVICE=api ;;
esac

compose() {
  docker compose --env-file "$ENV_FILE" --profile "$PROFILE" "$@"
}

wait_healthy() {
  for i in $(seq 1 45); do
    if curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
      echo "Health check passed."
      return 0
    fi
    echo "Waiting for API health... ($i/45)"
    sleep 2
  done
  return 1
}

start_release() {
  IMAGE_TAG="$1" compose up -d --no-build --no-deps "$SERVICE"
}

if [ "${1:-}" = "--rollback" ]; then
  [ -s "$STATE_PREVIOUS" ] || die "no previous release recorded"
  prev="$(cat "$STATE_PREVIOUS")"
  log "Rolling back $SERVICE to $prev"
  start_release "$prev"
  wait_healthy || die "rollback release $prev is not healthy either"
  cp "$STATE_PREVIOUS" "$STATE_CURRENT"
  exit 0
fi

RELEASE="${1:-}"
[ -n "$RELEASE" ] || die "usage: $0 <release-tag> | --rollback"
CURRENT="$(cat "$STATE_CURRENT" 2>/dev/null || true)"

log "Deploying $RELEASE (service $SERVICE, profile $PROFILE, current ${CURRENT:-none})"

# Data services must be up for the dump and the migration; never recreated.
compose up -d --no-recreate postgres
[ "$PROFILE" = redis ] && compose up -d --no-recreate redis

log "Pre-deploy database dump"
mkdir -p "$BACKUP_DIR"
DB_USER="$(env_value POSTGRES_USER)"; DB_USER="${DB_USER:-gdpr}"
DB_NAME="$(env_value POSTGRES_DB)"; DB_NAME="${DB_NAME:-gdpr_audit}"
DUMP="$BACKUP_DIR/predeploy-$(date -u +%Y%m%dT%H%M%SZ)-${RELEASE}.sql.gz"
for i in $(seq 1 30); do
  docker exec gdpr-postgres pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1 && break
  sleep 2
done
docker exec gdpr-postgres pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner | gzip >"$DUMP"
[ -s "$DUMP" ] || die "database dump is empty"
echo "Dump: $DUMP ($(du -h "$DUMP" | cut -f1))"
ls -1t "$BACKUP_DIR"/predeploy-*.sql.gz | tail -n +$((KEEP_DUMPS + 1)) | xargs -r rm -f

log "Building $IMAGE_REPO:$RELEASE"
IMAGE_TAG="$RELEASE" compose build --pull "$SERVICE"

log "Running database migrations"
IMAGE_TAG="$RELEASE" compose run --rm --no-deps "$SERVICE" npx prisma migrate deploy

log "Starting $RELEASE"
start_release "$RELEASE"

if ! wait_healthy; then
  docker logs --tail=200 "$(compose ps -q "$SERVICE")" || true
  if [ -n "$CURRENT" ]; then
    log "Health check failed - rolling back to $CURRENT"
    start_release "$CURRENT"
    wait_healthy || echo "WARNING: rollback release $CURRENT is not healthy either"
  fi
  die "release $RELEASE did not become healthy"
fi

[ -n "$CURRENT" ] && [ "$CURRENT" != "$RELEASE" ] && echo "$CURRENT" >"$STATE_PREVIOUS"
echo "$RELEASE" >"$STATE_CURRENT"

log "Pruning old API images (keeping $RELEASE and ${CURRENT:-none})"
docker image ls "$IMAGE_REPO" --format '{{.Tag}}' |
  grep -vxF -e "$RELEASE" -e "${CURRENT:-$RELEASE}" |
  xargs -r -I{} docker image rm "$IMAGE_REPO:{}" || true

compose ps
log "Deployed $RELEASE"
