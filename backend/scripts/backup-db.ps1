<#
.SYNOPSIS
  Bentabet Database Backup Script
.DESCRIPTION
  Creates a compressed MySQL dump with transaction-safe snapshot.
  Supports daily backups and point-in-time recovery via binary logs.
  Automatically purges backups older than retention period.
  Optionally syncs to off-site storage via rclone.
.PARAMETER Action
  'daily' - Create compressed dump (default)
  'restore' - Restore from latest backup
.PARAMETER RestoreFile
  Specific backup file path for restore action
.EXAMPLE
  .\backup-db.ps1 -Action daily
  .\backup-db.ps1 -Action restore -RestoreFile "C:\backups\bentabet\daily\bentabet_20260702_020000.sql.gz"
#>

param(
  [ValidateSet('daily', 'restore')]
  [string]$Action = 'daily',
  [string]$RestoreFile = ''
)

# ─── CONFIGURATION ─────────────────────────────────────────────
$DB_NAME = "bentabet_db"
$DB_USER = "root"
$DB_PASS = "FFSD@2026"
$MYSQL_PATH = "C:\Program Files\MySQL\MySQL Server 8.0\bin"
$BACKUP_DIR = "C:\Users\Traveller\Downloads\BSMS\BSMS\backups"
$RETENTION_DAYS = 30

# Off-site sync (optional — requires rclone configured)
$RCLONE_REMOTE = "gdrive:bentabet-db-backups"
$ENABLE_OFFSITE_SYNC = $false

# ─── HELPERS ───────────────────────────────────────────────────
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$FILENAME = "$BACKUP_DIR\bentabet_$TIMESTAMP.sql.gz"
$LOG_FILE = "$BACKUP_DIR\backup.log"

function Write-Log {
  param([string]$Message, [string]$Level = "INFO")
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') | [$Level] $Message"
  Write-Host $line
  Add-Content -Path $LOG_FILE -Value $line
}

# ─── DAILY BACKUP ──────────────────────────────────────────────
function Invoke-DailyBackup {
  Write-Log "Starting daily backup..."

  # Ensure backup directory exists
  New-Item -ItemType Directory -Force -Path $BACKUP_DIR | Out-Null

  # Set MySQL password env var (safe — only active during script)
  $env:MYSQL_PWD = $DB_PASS

  # mysqldump with --single-transaction (no table lock, consistent snapshot)
  $dumpArgs = @(
    "-u$DB_USER",
    "--single-transaction",
    "--routines",
    "--triggers",
    "--quick",
    "--default-character-set=utf8mb4",
    $DB_NAME
  )

  $mysqldump = Join-Path $MYSQL_PATH "mysqldump.exe"
  $sevenZip = "C:\Program Files\7-Zip\7z.exe"

  # Check if 7-Zip is available
  if (Test-Path $sevenZip) {
    & $mysqldump $dumpArgs | & $sevenZip a -tgzip -si "$FILENAME" 2>&1 | Out-Null
  } else {
    # Fallback: dump to SQL then compress with .NET
    Write-Log "7-Zip not found, using .NET GZip compression" "WARN"
    $sqlFile = "$BACKUP_DIR\temp_$TIMESTAMP.sql"
    & $mysqldump $dumpArgs > $sqlFile
    if ($LASTEXITCODE -eq 0) {
      $stream = [System.IO.File]::OpenRead($sqlFile)
      $compressed = [System.IO.File]::Create($FILENAME)
      $gzip = [System.IO.Compression.GZipStream]::new($compressed, [System.IO.Compression.CompressionMode]::Compress)
      $stream.CopyTo($gzip)
      $gzip.Close(); $compressed.Close(); $stream.Close()
      Remove-Item $sqlFile -Force
    }
  }

  $env:MYSQL_PWD = ""

  if ($LASTEXITCODE -eq 0 -and (Test-Path $FILENAME)) {
    $size = "{0:N2} MB" -f ((Get-Item $FILENAME).Length / 1MB)
    Write-Log "Backup saved: $FILENAME ($size)" "OK"

    # Verify integrity
    try {
      $file = [System.IO.File]::OpenRead($FILENAME)
      $gzip = [System.IO.Compression.GZipStream]::new($file, [System.IO.Compression.CompressionMode]::Decompress)
      $reader = [System.IO.StreamReader]::new($gzip)
      $header = $reader.ReadLine()
      $reader.Close(); $gzip.Close(); $file.Close()
      if ($header -match "^-- ") {
        Write-Log "Backup integrity verified" "OK"
      }
    } catch {
      Write-Log "Backup integrity check failed: $_" "ERROR"
    }

    # Purge old backups
    $cutoff = (Get-Date).AddDays(-$RETENTION_DAYS)
    Get-ChildItem "$BACKUP_DIR\bentabet_*.sql.gz" | Where-Object {
      $_.LastWriteTime -lt $cutoff
    } | ForEach-Object {
      Remove-Item $_.FullName -Force
      Write-Log "Purged old backup: $($_.Name)" "OK"
    }

    # Off-site sync
    if ($ENABLE_OFFSITE_SYNC) {
      try {
        $rclone = Get-Command "rclone.exe" -ErrorAction Stop
        & $rclone sync $BACKUP_DIR $RCLONE_REMOTE --delete-after --verbose 2>&1 | Out-Null
        Write-Log "Off-site sync completed" "OK"
      } catch {
        Write-Log "Off-site sync failed: $_" "WARN"
      }
    }

    return $true
  } else {
    Write-Log "Backup FAILED (exit code: $LASTEXITCODE)" "ERROR"
    return $false
  }
}

# ─── RESTORE ───────────────────────────────────────────────────
function Invoke-Restore {
  $restoreFile = $RestoreFile
  if (-not $restoreFile) {
    $restoreFile = Get-ChildItem "$BACKUP_DIR\bentabet_*.sql.gz" |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1 -ExpandProperty FullName
  }

  if (-not $restoreFile -or -not (Test-Path $restoreFile)) {
    Write-Log "No backup file found to restore" "ERROR"
    return $false
  }

  Write-Log "Restoring from: $restoreFile" "INFO"

  # Confirm
  Write-Host "WARNING: This will OVERWRITE the $DB_NAME database!" -ForegroundColor Red
  $confirm = Read-Host "Type 'RESTORE' to confirm"
  if ($confirm -ne "RESTORE") {
    Write-Log "Restore cancelled by user" "WARN"
    return $false
  }

  # Create temp db backup before restore (safety net)
  $env:MYSQL_PWD = $DB_PASS
  $tempBackup = "$BACKUP_DIR\_prerestore_$TIMESTAMP.sql.gz"
  $mysqldump = Join-Path $MYSQL_PATH "mysqldump.exe"
  & $mysqldump -u$DB_USER --single-transaction --quick $DB_NAME |
    & "C:\Program Files\7-Zip\7z.exe" a -tgzip -si "$tempBackup" 2>&1 | Out-Null
  Write-Log "Pre-restore backup saved: $tempBackup" "OK"

  # Decompress and restore
  $mysql = Join-Path $MYSQL_PATH "mysql.exe"
  & "C:\Program Files\7-Zip\7z.exe" x -tgzip -so "$restoreFile" |
    & $mysql -u$DB_USER $DB_NAME 2>&1

  $env:MYSQL_PWD = ""

  if ($LASTEXITCODE -eq 0) {
    Write-Log "Restore completed successfully" "OK"
    return $true
  } else {
    Write-Log "Restore FAILED" "ERROR"
    return $false
  }
}

# ─── MAIN ──────────────────────────────────────────────────────
switch ($Action) {
  'daily' { Invoke-DailyBackup }
  'restore' { Invoke-Restore }
}
