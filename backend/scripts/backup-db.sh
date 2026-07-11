#!/bin/bash
# =============================================================================
# Bentabet Database Backup Script (Linux/Mac)
# Usage:
#   ./backup-db.sh daily         # Create daily compressed dump
#   ./backup-db.sh restore [file] # Restore from backup
#   ./backup-db.sh flush-logs     # Flush MySQL binary logs
#
# Cron setup (crontab -e):
#   0 2 * * * /opt/bentabet/backend/scripts/backup-db.sh daily
#   0 3 * * * /opt/bentabet/backend/scripts/backup-db.sh flush-logs
#   30 3 * * * rclone sync /backups/daily gdrive:bentabet-db-backups --delete-after
# =============================================================================

set -euo pipefail

# ─── CONFIGURATION ─────────────────────────────────────────────
DB_NAME="bentabet_db"
DB_USER="bentabet"
DB_PASS="${DB_PASSWORD:?Set DB_PASSWORD environment variable}"
BACKUP_DIR="/backups/daily"
RETENTION_DAYS=30

# MySQL binary log dir (for point-in-time recovery)
BINLOG_DIR="/backups/binlogs"

# Off-site sync (requires rclone configured)
RCLONE_REMOTE="gdrive:bentabet-db-backups"
ENABLE_OFFSITE_SYNC=false

# ─── HELPERS ───────────────────────────────────────────────────
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="${BACKUP_DIR}/bentabet_${TIMESTAMP}.sql.gz"
LOG_FILE="${BACKUP_DIR}/backup.log"

log() {
  local level="$1" msg="$2"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $msg" | tee -a "$LOG_FILE"
}

mkdir -p "$BACKUP_DIR" "$BINLOG_DIR"

# ─── DAILY BACKUP ──────────────────────────────────────────────
daily_backup() {
  log "INFO" "Starting daily backup..."

  # mysqldump with --single-transaction for consistent snapshot without locking
  # --routines: include stored procedures
  # --triggers: include triggers
  if mysqldump -u "$DB_USER" -p"$DB_PASS" \
    --single-transaction \
    --routines \
    --triggers \
    --quick \
    --default-character-set=utf8mb4 \
    "$DB_NAME" | gzip > "$FILENAME"; then

    # Verify integrity
    if gunzip -t "$FILENAME" 2>/dev/null; then
      local size
      size=$(du -h "$FILENAME" | cut -f1)
      log "OK" "Backup saved: $FILENAME ($size)"

      # Purge old backups
      find "$BACKUP_DIR" -name "bentabet_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
      log "OK" "Purged backups older than ${RETENTION_DAYS} days"

      # Off-site sync
      if [ "$ENABLE_OFFSITE_SYNC" = true ]; then
        if command -v rclone &>/dev/null; then
          rclone sync "$BACKUP_DIR" "$RCLONE_REMOTE" --delete-after --verbose >> "$LOG_FILE" 2>&1
          log "OK" "Off-site sync completed"
        else
          log "WARN" "rclone not found, skipping off-site sync"
        fi
      fi

      return 0
    else
      log "ERROR" "Backup integrity check FAILED: $FILENAME"
      rm -f "$FILENAME"
      return 1
    fi
  else
    log "ERROR" "mysqldump failed (exit code: $?)"
    return 1
  fi
}

# ─── RESTORE ───────────────────────────────────────────────────
restore_backup() {
  local restore_file="${1:-}"
  if [ -z "$restore_file" ]; then
    restore_file=$(ls -t "$BACKUP_DIR"/bentabet_*.sql.gz 2>/dev/null | head -1)
  fi

  if [ -z "$restore_file" ] || [ ! -f "$restore_file" ]; then
    log "ERROR" "No backup file found to restore"
    return 1
  fi

  log "INFO" "Restoring from: $restore_file"

  # Safety backup before restore
  local pre_restore="${BACKUP_DIR}/_prerestore_${TIMESTAMP}.sql.gz"
  mysqldump -u "$DB_USER" -p"$DB_PASS" \
    --single-transaction --quick "$DB_NAME" | gzip > "$pre_restore"
  log "OK" "Pre-restore backup saved: $pre_restore"

  # Restore
  gunzip < "$restore_file" | mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME"
  log "OK" "Restore completed successfully"
}

# ─── FLUSH BINARY LOGS ─────────────────────────────────────────
flush_logs() {
  mysqladmin -u "$DB_USER" -p"$DB_PASS" flush-logs
  log "OK" "Binary logs flushed"
}

# ─── MAIN ──────────────────────────────────────────────────────
case "${1:-daily}" in
  daily)      daily_backup ;;
  restore)    restore_backup "${2:-}" ;;
  flush-logs) flush_logs ;;
  *)
    echo "Usage: $0 {daily|restore [file]|flush-logs}"
    exit 1
    ;;
esac
