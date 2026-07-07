require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const DB_NAME = process.env.DB_NAME || 'bentabet_db';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASS = process.env.DB_PASSWORD || '';
const BACKUP_DIR = path.join(__dirname, '..', '..', 'backups');
const RETENTION_DAYS = 30;

const action = process.argv[2] || 'daily';

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const filename = path.join(BACKUP_DIR, `bentabet_db_${timestamp.replace(/[-]/g, '').slice(0, 8)}-${timestamp.replace(/[-]/g, '').slice(8).replace(/[T]/g, '-').replace(/[^0-9-]/g, '')}.sql`);

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function log(msg, level = 'INFO') {
  const line = `${new Date().toISOString()} | [${level}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(path.join(BACKUP_DIR, 'backup.log'), line + '\n');
  } catch (e) { /* skip */ }
}

function doBackup() {
  log('Starting daily backup...');

  const env = { ...process.env, MYSQL_PWD: DB_PASS };
  const dumpArgs = [
    'mysqldump',
    `-u${DB_USER}`,
    '--single-transaction',
    '--routines',
    '--triggers',
    '--quick',
    '--default-character-set=utf8mb4',
    DB_NAME,
  ];

  try {
    const cmd = `${dumpArgs.join(' ')} > "${filename}"`;
    execSync(cmd, { env, timeout: 120000, stdio: 'pipe', shell: true, maxBuffer: 100 * 1024 * 1024 });
    const size = (fs.statSync(filename).size / 1024 / 1024).toFixed(2);
    log(`Backup saved: ${filename} (${size} MB)`, 'OK');

    // Verify header
    const header = fs.readFileSync(filename, 'utf-8').split('\n')[0];
    if (header.startsWith('--')) {
      log('Backup integrity verified', 'OK');
    }

    // Purge old backups
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('bentabet_db_') && f.endsWith('.sql'))
      .filter(f => fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs < cutoff);
    for (const f of files) {
      fs.unlinkSync(path.join(BACKUP_DIR, f));
      log(`Purged old backup: ${f}`, 'OK');
    }

    log('Backup complete');
    return true;
  } catch (err) {
    log(`Backup FAILED: ${err.message}`, 'ERROR');
    return false;
  }
}

function doRestore() {
  const restoreFile = process.argv[3] || null;
  let fileToRestore = restoreFile;

  if (!fileToRestore) {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('bentabet_db_') && f.endsWith('.sql'))
      .sort((a, b) => fs.statSync(path.join(BACKUP_DIR, b)).mtimeMs - fs.statSync(path.join(BACKUP_DIR, a)).mtimeMs);
    if (files.length === 0) {
      log('No backup files found to restore', 'ERROR');
      process.exit(1);
    }
    fileToRestore = path.join(BACKUP_DIR, files[0]);
  }

  log(`Restoring from: ${fileToRestore}`);
  log('WARNING: This will OVERWRITE the database!', 'WARN');

  const env = { ...process.env, MYSQL_PWD: DB_PASS };
  try {
    const sql = fs.readFileSync(fileToRestore, 'utf-8');
    execSync(`mysql -u${DB_USER} ${DB_NAME}`, { env, timeout: 120000, stdio: ['pipe', 'inherit', 'inherit'], input: sql, shell: true });
    log('Restore completed successfully', 'OK');
    return true;
  } catch (err) {
    log(`Restore FAILED: ${err.message}`, 'ERROR');
    return false;
  }
}

switch (action) {
  case 'daily':
    doBackup();
    break;
  case 'restore':
    doRestore();
    break;
  default:
    console.log('Usage: node scripts/backup-db.js [daily|restore] [file]');
    break;
}
