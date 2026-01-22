#!/bin/bash

# =============================================================================
# PostgreSQL Backup Script with Backblaze B2
# =============================================================================
# This script creates a compressed backup of PostgreSQL database and uploads
# it to Backblaze B2 cloud storage. It also handles cleanup of old backups.
# =============================================================================

set -e

# Configuration
BACKUP_DIR="/tmp/backups"
DATE=$(date +%Y-%m-%d)
DAY_OF_WEEK=$(date +%u)  # 1=Monday, 7=Sunday
DAY_OF_MONTH=$(date +%d)
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)

# Database configuration (from environment or defaults)
DB_CONTAINER="${DB_CONTAINER:-gdpr-postgres}"
DB_NAME="${DB_NAME:-gdpr_audit}"
DB_USER="${DB_USER:-gdpr}"

# Backblaze B2 configuration
B2_BUCKET="${B2_BUCKET_NAME:-gdpr-audit}"
B2_KEY_ID="${B2_APPLICATION_KEY_ID}"
B2_APP_KEY="${B2_APPLICATION_KEY}"

# Healthchecks.io ping URL for monitoring
HEALTHCHECK_URL="${HEALTHCHECK_URL:-https://hc-ping.com/80de4c41-3f8b-4665-a7a8-23aa5cb0421f}"

# Retention settings
DAILY_RETENTION_DAYS=7
WEEKLY_RETENTION_DAYS=28
MONTHLY_RETENTION_DAYS=90

# =============================================================================
# Functions
# =============================================================================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >&2
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >&2
}

check_requirements() {
    log "Checking requirements..."
    
    if ! command -v docker &> /dev/null; then
        error "docker not found"
        exit 1
    fi
    
    if ! command -v b2 &> /dev/null; then
        error "b2 CLI not found. Install with: pip install b2"
        exit 1
    fi
    
    if [ -z "$B2_KEY_ID" ] || [ -z "$B2_APP_KEY" ]; then
        error "B2 credentials not set. Set B2_APPLICATION_KEY_ID and B2_APPLICATION_KEY"
        exit 1
    fi
    
    # Check if postgres container is running
    if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
        error "PostgreSQL container '$DB_CONTAINER' is not running"
        exit 1
    fi
}

authorize_b2() {
    log "Authorizing with Backblaze B2..."
    b2 account authorize "$B2_KEY_ID" "$B2_APP_KEY" > /dev/null 2>&1
    if [ $? -ne 0 ]; then
        error "Failed to authorize with Backblaze B2"
        exit 1
    fi
}

create_backup() {
    local backup_type=$1
    local backup_file="gdpr-backup-${backup_type}-${DATE}.sql.gz"
    local backup_path="${BACKUP_DIR}/${backup_file}"
    
    log "Creating ${backup_type} backup: ${backup_file}"
    
    mkdir -p "$BACKUP_DIR"
    
    # Use docker exec to run pg_dump inside the container
    docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$backup_path"
    
    if [ $? -ne 0 ] || [ ! -s "$backup_path" ]; then
        error "Failed to create backup"
        rm -f "$backup_path"
        exit 1
    fi
    
    local size=$(du -h "$backup_path" | cut -f1)
    log "Backup created: ${size}"
    
    echo "$backup_path"
}

upload_to_b2() {
    local backup_path=$1
    local backup_file=$(basename "$backup_path")
    
    log "Uploading to Backblaze B2: ${backup_file}"
    
    b2 file upload "$B2_BUCKET" "$backup_path" "$backup_file" > /dev/null 2>&1
    
    if [ $? -ne 0 ]; then
        error "Failed to upload backup to B2"
        exit 1
    fi
    
    log "Upload complete"
}

cleanup_local() {
    local backup_path=$1
    
    log "Cleaning up local backup file..."
    rm -f "$backup_path"
}

ping_healthcheck() {
    local status=$1  # "start", "success", or "fail"
    
    if [ -z "$HEALTHCHECK_URL" ]; then
        return
    fi
    
    case $status in
        start)
            curl -fsS -m 10 --retry 3 "${HEALTHCHECK_URL}/start" > /dev/null 2>&1 || true
            ;;
        success)
            curl -fsS -m 10 --retry 3 "${HEALTHCHECK_URL}" > /dev/null 2>&1 || true
            ;;
        fail)
            curl -fsS -m 10 --retry 3 "${HEALTHCHECK_URL}/fail" > /dev/null 2>&1 || true
            ;;
    esac
}

cleanup_old_backups() {
    log "Cleaning up old backups from B2..."
    
    # Get list of files in bucket using new b2 CLI syntax
    local files=$(b2 ls "b2://$B2_BUCKET" 2>/dev/null)
    
    local today_epoch=$(date +%s)
    
    echo "$files" | while read -r file; do
        if [ -z "$file" ]; then
            continue
        fi
        
        # Extract date from filename (format: gdpr-backup-TYPE-YYYY-MM-DD.sql.gz)
        local file_date=$(echo "$file" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}')
        
        if [ -z "$file_date" ]; then
            continue
        fi
        
        local file_epoch=$(date -d "$file_date" +%s 2>/dev/null || date -j -f "%Y-%m-%d" "$file_date" +%s 2>/dev/null)
        
        if [ -z "$file_epoch" ]; then
            continue
        fi
        
        local age_days=$(( (today_epoch - file_epoch) / 86400 ))
        
        # Determine retention based on backup type
        if [[ "$file" == *"-daily-"* ]] && [ $age_days -gt $DAILY_RETENTION_DAYS ]; then
            log "Deleting old daily backup: $file (${age_days} days old)"
            b2 file delete "b2://$B2_BUCKET/$file" 2>/dev/null || true
        elif [[ "$file" == *"-weekly-"* ]] && [ $age_days -gt $WEEKLY_RETENTION_DAYS ]; then
            log "Deleting old weekly backup: $file (${age_days} days old)"
            b2 file delete "b2://$B2_BUCKET/$file" 2>/dev/null || true
        elif [[ "$file" == *"-monthly-"* ]] && [ $age_days -gt $MONTHLY_RETENTION_DAYS ]; then
            log "Deleting old monthly backup: $file (${age_days} days old)"
            b2 file delete "b2://$B2_BUCKET/$file" 2>/dev/null || true
        fi
    done
}

# =============================================================================
# Main
# =============================================================================

main() {
    log "=========================================="
    log "Starting PostgreSQL backup"
    log "=========================================="
    
    # Signal backup start to healthcheck
    ping_healthcheck "start"
    
    # Set trap to ping fail on any error
    trap 'ping_healthcheck "fail"' ERR
    
    check_requirements
    authorize_b2
    
    # Always create daily backup
    local backup_path=$(create_backup "daily")
    upload_to_b2 "$backup_path"
    cleanup_local "$backup_path"
    
    # Create weekly backup on Sunday (day 7)
    if [ "$DAY_OF_WEEK" -eq 7 ]; then
        log "Sunday - creating weekly backup"
        backup_path=$(create_backup "weekly")
        upload_to_b2 "$backup_path"
        cleanup_local "$backup_path"
    fi
    
    # Create monthly backup on 1st of month
    if [ "$DAY_OF_MONTH" -eq "01" ]; then
        log "First of month - creating monthly backup"
        backup_path=$(create_backup "monthly")
        upload_to_b2 "$backup_path"
        cleanup_local "$backup_path"
    fi
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Signal success to healthcheck
    ping_healthcheck "success"
    
    log "=========================================="
    log "Backup completed successfully"
    log "=========================================="
}

main "$@"
