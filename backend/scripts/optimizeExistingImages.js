/**
 * optimizeExistingImages.js — one-time backfill for pre-existing uploads.
 *
 * For every image under backend/uploads/ it creates a WebP (max 1200px) and a
 * 200px "-thumb.webp" variant in the SAME folder, then (best-effort) backfills
 * the new `<col>_optimized` / `<col>_thumb` DB columns so existing records get
 * the optimized treatment too.
 *
 * Safe to re-run: files that already have a sibling `.webp` are skipped.
 * Original files are NEVER deleted or modified.
 *
 * Usage:
 *   node scripts/optimizeExistingImages.js              # files + DB backfill
 *   node scripts/optimizeExistingImages.js --files-only # skip DB update
 *   node scripts/optimizeExistingImages.js --dry-run    # report only, change nothing
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.resolve(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
const IMAGE_MAX_WIDTH = 1200;
const THUMB_MAX_WIDTH = 200;
const WEBP_QUALITY = 80;
const THUMB_QUALITY = 75;
const IMAGE_EXT_RE = /\.(jpg|jpeg|png|gif|bmp|tiff)$/i;

const DRY_RUN = process.argv.includes('--dry-run');
const FILES_ONLY = process.argv.includes('--files-only');
const CONCURRENCY = 4;

let processed = 0;
let skipped = 0;
let failed = 0;
let dryRunCount = 0;

function isImage(name) {
  return IMAGE_EXT_RE.test(name);
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (isImage(entry.name)) out.push(full);
  }
  return out;
}

function urlFromDisk(filePath) {
  // backend/uploads/<sub>/<file>  ->  /uploads/<sub>/<file>
  const rel = path.relative(UPLOAD_DIR, filePath).split(path.sep).join('/');
  return `/uploads/${rel}`;
}

async function processOne(filePath) {
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  const dir = path.dirname(filePath);
  const optimizedDisk = path.join(dir, `${base}.webp`);
  const thumbDisk = path.join(dir, `${base}-thumb.webp`);

  if (fs.existsSync(optimizedDisk) && fs.existsSync(thumbDisk)) {
    skipped++;
    return { filePath, optimizedDisk, thumbDisk };
  }

  if (DRY_RUN) {
    dryRunCount++;
    return null;
  }

  const isGif = /\.gif$/i.test(filePath);
  const opts = isGif ? { animated: true, loop: true } : {};

  try {
    if (!fs.existsSync(optimizedDisk)) {
      let pipeline = sharp(filePath, opts);
      const metadata = await pipeline.metadata();
      if ((metadata.width || 0) > IMAGE_MAX_WIDTH) {
        pipeline = pipeline.resize({ width: IMAGE_MAX_WIDTH, withoutEnlargement: true });
      }
      await pipeline.webp({ quality: WEBP_QUALITY, ...opts }).toFile(optimizedDisk);
    }
    if (!fs.existsSync(thumbDisk)) {
      await sharp(filePath, opts)
        .resize({ width: THUMB_MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: THUMB_QUALITY, ...opts })
        .toFile(thumbDisk);
    }
    processed++;
    return { filePath, optimizedDisk, thumbDisk };
  } catch (err) {
    failed++;
    console.error(`  ! failed ${filePath}: ${err.message}`);
    return null;
  }
}

async function mapLimit(items, limit, worker) {
  const results = [];
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      const r = await worker(item);
      if (r) results.push(r);
    }
  });
  await Promise.all(runners);
  return results;
}

async function backfillDb(generated) {
  if (FILES_ONLY || generated.length === 0) return;

  let models;
  try {
    models = require('../models');
  } catch (err) {
    console.log('  DB backfill skipped (models not loadable):', err.message);
    return;
  }

  // [Model, originalColumn, optimizedColumn, thumbColumn]
  const colMaps = [
    [models.Collection, 'meter_image_url', 'meter_image_optimized', 'meter_image_thumb'],
    [models.NovomaticReading, 'screenshot_url', 'screenshot_optimized', 'screenshot_thumb'],
    [models.Expense, 'receipt_url', 'receipt_optimized', 'receipt_thumb'],
    [models.MachineDebt, 'receipt_url', 'receipt_optimized', 'receipt_thumb'],
    [models.AccountTransaction, 'receipt_url', 'receipt_optimized', 'receipt_thumb'],
    [models.StockMovement, 'receipt_url', 'receipt_optimized', 'receipt_thumb'],
  ];

  let dbUpdated = 0;
  for (const item of generated) {
    const originalUrl = urlFromDisk(item.filePath);
    const optimizedUrl = urlFromDisk(item.optimizedDisk);
    const thumbUrl = urlFromDisk(item.thumbDisk);

    for (const [Model, col, optCol, thumbCol] of colMaps) {
      if (!Model) continue;
      try {
        const [n] = await Model.update(
          { [optCol]: optimizedUrl, [thumbCol]: thumbUrl },
          { where: { [col]: originalUrl, [optCol]: null } }
        );
        dbUpdated += n;
      } catch (err) {
        // Column may not exist yet on production DB — skip this model for remaining rows.
        if (err.message && /Unknown column/.test(err.message)) continue;
        console.warn(`  ! DB backfill failed for ${Model.name}: ${err.message}`);
      }
    }
  }
  console.log(`  DB columns backfilled: ${dbUpdated} row(s)`);
}

async function main() {
  console.log(`Scanning ${UPLOAD_DIR} ...`);
  const files = walk(UPLOAD_DIR).filter((f) => fs.statSync(f).size > 0);
  console.log(`Found ${files.length} image file(s)`);

  const generated = await mapLimit(files, CONCURRENCY, processOne);

  if (DRY_RUN) {
    console.log(`DRY-RUN: would process ${dryRunCount} file(s), skip ${skipped} already optimized.`);
    return;
  }
  console.log(`Done: ${processed} optimized, ${skipped} already done, ${failed} failed.`);
  await backfillDb(generated);

  const { sequelize } = require('../models');
  await sequelize.close().catch(() => {});
}

main().catch((err) => {
  console.error('Backfill error:', err);
  process.exit(1);
});