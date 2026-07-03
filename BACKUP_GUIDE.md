# Bentabet Database Backup Guide

> **Purpose**: Protect your business data against hardware failure, corruption, accidental deletion, and disasters.
> **Goal**: Lose at most 1 minute of data (point-in-time recovery) with daily off-site backups.

---

## Table of Contents

1. [Backup Architecture](#1-backup-architecture)
2. [Daily Automated Dumps](#2-daily-automated-dumps)
3. [Off-Site / Cloud Sync](#3-off-site--cloud-sync)
4. [Point-in-Time Recovery (Binary Logs)](#4-point-in-time-recovery-binary-logs)
5. [Restore Procedures](#5-restore-procedures)
6. [Integration With Ongoing Development](#6-integration-with-ongoing-development)
7. [Monitoring & Testing](#7-monitoring--testing)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Backup Architecture

```
MySQL 8 Database
    │
    ├── mysqldump (daily 02:00)
    │   └──→ /backups/daily/bentabet_YYYYMMDD.sql.gz
    │           │
    │           ├── Local retention: 30 days
    │           │
    │           └── rclone sync (03:00)
    │               └──→ Google Drive / Cloud Storage
    │
    └── Binary logs (continuous)
        └──→ /backups/binlogs/mysql-bin.000001
                └── Enables restore to ANY minute
```

### What Gets Backed Up

| Item | Included | Why |
|---|---|---|
| All tables + data | Yes | Full database restore |
| Stored procedures | Yes | Required for any DB logic |
| Triggers | Yes | Data integrity rules |
| MySQL binary logs | Yes | Point-in-time recovery |
| Uploaded files (Cloudinary) | No | Already stored in Cloudinary |
| .env / secrets | No | Managed separately |

---

## 2. Daily Automated Dumps

### Linux VPS (Production)

**Script**: `backend/scripts/backup-db.sh`

Install and configure:

```bash
# 1. Make executable
chmod +x /opt/bentabet/backend/scripts/backup-db.sh

# 2. Edit configuration at top of script
nano /opt/bentabet/backend/scripts/backup-db.sh
# Set: DB_USER, DB_PASS, BACKUP_DIR

# 3. Test manually
/opt/bentabet/backend/scripts/backup-db.sh daily

# 4. Add to crontab
crontab -e
```

**Cron entries**:

```cron
# Daily backup at 02:00
0 2 * * * /opt/bentabet/backend/scripts/backup-db.sh daily

# Flush binary logs at 03:00 (after daily dump)
0 3 * * * /opt/bentabet/backend/scripts/backup-db.sh flush-logs

# Off-site sync at 03:30
30 3 * * * rclone sync /backups/daily gdrive:bentabet-db-backups --delete-after
```

### Windows (Dev / Local)

**Script**: `backend/scripts/backup-db.ps1`

Configure via Task Scheduler:

```powershell
# 1. Edit configuration at top of script
# Set: DB_USER, DB_PASS, MYSQL_PATH, BACKUP_DIR

# 2. Test manually
.\backend\scripts\backup-db.ps1 -Action daily

# 3. Open Task Scheduler
#    - Create Task → Trigger: Daily at 02:00
#    - Action: Start a program
#      Program: powershell.exe
#      Arguments: -File "C:\Users\Traveller\Downloads\BSMS\BSMS\backend\scripts\backup-db.ps1" -Action daily
```

### What the Script Does

1. Runs `mysqldump --single-transaction` (no table locking — safe for live DB)
2. Compresses with gzip (saves ~80% disk space)
3. Verifies archive integrity
4. Purges backups older than 30 days
5. Syncs to off-site storage (if configured)
6. Logs everything to `/backups/daily/backup.log`

---

## 3. Off-Site / Cloud Sync

### Install rclone

```bash
# Linux
sudo -v; curl https://rclone.org/install.sh | sudo bash

# Windows — download from https://rclone.org/downloads/
# Add to PATH
```

### Configure Cloud Destination

```bash
# Interactive setup
rclone config

# Choose your provider:
#   13  → Google Drive (free 15GB, good for DB dumps)
#   4   → Backblaze B2 ($0.006/GB/mo — cheapest)
#   5   → Dropbox
#   33  → Mega (20GB free)

# Name your remote: gdrive
# Follow the OAuth prompt
```

### Test Sync

```bash
rclone ls gdrive:
rclone sync /backups/daily gdrive:bentabet-db-backups --dry-run
```

### Enable in Backup Script

Edit `backup-db.sh`:
```bash
ENABLE_OFFSITE_SYNC=true
RCLONE_REMOTE="gdrive:bentabet-db-backups"
```

---

## 4. Point-in-Time Recovery (Binary Logs)

Binary logs let you restore to **any specific minute**, not just the last dump time.

### Enable Binary Logs

Edit MySQL config (`/etc/mysql/mysql.conf.d/mysqld.cnf` on Linux):

```ini
[mysqld]
server-id = 1
log-bin = /backups/binlogs/mysql-bin
expire_logs_days = 7
max_binlog_size = 100M
```

Restart MySQL:

```bash
sudo systemctl restart mysql
```

### View Available Logs

```bash
mysqlbinlog /backups/binlogs/mysql-bin.* | grep "end_log_pos"
mysql -u root -p -e "SHOW BINARY LOGS;"
```

---

## 5. Restore Procedures

### Restore Latest Backup

```bash
# Linux
gunzip < /backups/daily/bentabet_latest.sql.gz | mysql -u bentabet -p bentabet_db

# Windows (PowerShell)
7z x -tgzip -so "C:\backups\bentabet\daily\bentabet_latest.sql.gz" | mysql -u bentabet -p bentabet_db
```

### Restore Specific Date

```bash
gunzip < /backups/daily/bentabet_20260702.sql.gz | mysql -u bentabet -p bentabet_db
```

### Point-in-Time Recovery

Useful when corruption happened AFTER the last dump:

```bash
# 1. Restore the most recent full dump
gunzip < /backups/daily/bentabet_latest.sql.gz | mysql -u bentabet -p bentabet_db

# 2. Replay binary logs from that point to just before the accident
mysqlbinlog /backups/binlogs/mysql-bin.000123 \
  --stop-datetime="2026-07-02 14:30:00" \
  | mysql -u bentabet -p bentabet_db
```

### Disaster Recovery (Full Server Loss)

1. Provision a new VPS
2. Install Node.js + MySQL + nginx
3. Clone the repo: `git clone ...`
4. Install deps: `cd backend && npm install --production`
5. Build frontend: `cd frontend && npm install && npm run build`
6. Restore DB from off-site backup:
   ```bash
   rclone copy gdrive:bentabet-db-backups/bentabet_20260702.sql.gz /tmp/
   gunzip < /tmp/bentabet_20260702.sql.gz | mysql -u bentabet -p bentabet_db
   ```
7. Start app: `pm2 start ecosystem.config.js`
8. Configure nginx + SSL

---

## 6. Integration With Ongoing Development

### Before Every Deployment

```bash
# Take a manual backup first
cd /opt/bentabet
npm run backup

# Then deploy your changes
git pull
npm install
pm2 restart all
```

### Schema Changes

When you modify models (add/remove columns):

1. **Development**: `alter: true` handles it
2. **Before production deploy**: Take a full backup
3. **After deploy**: Verify `backup.log` shows success
4. **If migration fails**: Restore from pre-deploy backup

### What Happens When...

| Scenario | Outcome |
|---|---|
| Hard drive fails on VPS | Restore from off-site backup to new server |
| Accidental `DELETE FROM collections` | Restore latest dump + replay binlogs |
| Developer drops a column | Restore from last dump before the change |
| Cloudinary goes down | Files are safe in Cloudinary, only DB needed |
| Ransomware encrypts server | Wipe server, restore from off-site backup |

---

## 7. Monitoring & Testing

### Daily Checks

```bash
# Check backup log
tail -5 /backups/daily/backup.log

# Verify off-site sync
rclone ls gdrive:bentabet-db-backups

# Check disk usage
df -h /backups

# Check MySQL replication (if enabled)
mysql -e "SHOW SLAVE STATUS\G"
```

### Monthly Restore Test

Prove your backups work by restoring to a test database:

```bash
# Create test DB
mysql -e "CREATE DATABASE bentabet_test;"

# Restore latest backup
gunzip < /backups/daily/bentabet_latest.sql.gz | mysql bentabet_test

# Compare row counts
for table in $(mysql -N -e "SHOW TABLES FROM bentabet_db"); do
  prod=$(mysql -N -e "SELECT COUNT(*) FROM bentabet_db.$table")
  test=$(mysql -N -e "SELECT COUNT(*) FROM bentabet_test.$table")
  echo "$table: prod=$prod test=$test"
done

# Clean up
mysql -e "DROP DATABASE bentabet_test;"
```

### Alerting (Simple)

Add to the backup script to send SMS via Beem Africa API on failure:

```bash
if [ $? -ne 0 ]; then
  # Send SMS alert to admin
  curl -X POST https://apisms.beem.africa/v1/send \
    -H "Content-Type: application/json" \
    -d '{"source_addr":"BENTABET","schedule_time":"","encoding":"0","message":"DB BACKUP FAILED — check server immediately","recipients":[{"recipient_id":1,"dest_addr":"2557XXXXXXXXX"}]}'
fi
```

---

## 8. Troubleshooting

| Problem | Solution |
|---|---|
| mysqldump: command not found | Add MySQL bin directory to PATH or use full path |
| Access denied for user | Check DB_USER password in script, ensure user has `SELECT, LOCK TABLES, SHOW VIEW, TRIGGER` grants |
| Backup file is 0 bytes | Disk full → `df -h`, free space and re-run |
| rclone: command not found | Install rclone: `sudo -v; curl https://rclone.org/install.sh | sudo bash` |
| gzip: No such file | Install: `sudo apt install gzip` |
| Binary logs filling disk | Set `expire_logs_days = 3` in MySQL config, restart |
| Backup takes too long | Check table sizes: `SELECT table_name, ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb FROM information_schema.tables WHERE table_schema = 'bentabet_db' ORDER BY size_mb DESC` — if any table > 5GB, consider `--where` option |

---

## Quick Reference Card

```bash
# ─── BACKUP ───
./backup-db.sh daily           # Take a backup now
npm run backup                  # Same via package.json

# ─── RESTORE ───
./backup-db.sh restore          # Restore latest
./backup-db.sh restore /backups/daily/bentabet_20260701.sql.gz  # Restore specific

# ─── VERIFY ───
gunzip -t /backups/daily/bentabet_latest.sql.gz  # Check integrity
tail -20 /backups/daily/backup.log                # View logs

# ─── OFF-SITE ───
rclone sync /backups/daily gdrive:bentabet-db-backups --delete-after
rclone ls gdrive:bentabet-db-backups
```

---

> **Last resort**: If you have no backup but the MySQL data directory is intact (`C:\ProgramData\MySQL\MySQL Server 8.0\Data\bentabet_db`), you can copy the `.ibd` files. But this requires exact MySQL version match. **Always maintain backups.**

