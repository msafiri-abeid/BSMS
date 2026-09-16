const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const IMAGE_MAX_WIDTH = 1200;
const THUMB_MAX_WIDTH = 200;
const WEBP_QUALITY = 80;
const THUMB_QUALITY = 75;
const IMAGE_EXT_RE = /\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/i;

const isImageFile = (name) => IMAGE_EXT_RE.test(name);

// Detect animated input so GIF animation is preserved, not dropped.
const animatedOpts = (file) =>
  (file.mimetype === 'image/gif' || /\.gif$/i.test(file.filename || ''))
    ? { animated: true, loop: true }
    : {};

/**
 * Process a single multer file: once the file is on disk, resize it to a
 * sane max width, re-encode to WebP (optimized + thumbnail) in the SAME
 * subfolder, and attach the browser-relative URLs to the file object.
 *
 * This runs AWAITED (synchronously) inside the upload middleware BEFORE the
 * DB record is created / response is sent, so the DB is only ever written
 * with paths to files that actually exist on disk. If processing fails, the
 * original file is preserved untouched and file.optimized stays false — the
 * caller (controller/service) then stores only the original URL.
 */
async function processFile(file) {
  if (!file || !isImageFile(file.filename)) return;
  const diskPath = path.join(file.destination, file.filename);
  if (!fs.existsSync(diskPath)) return;

  const ext = path.extname(file.filename);
  const base = path.basename(file.filename, ext);
  const optimizedDisk = path.join(file.destination, `${base}.webp`);
  const thumbDisk = path.join(file.destination, `${base}-thumb.webp`);
  const opts = animatedOpts(file);

  try {
    const metadata = await sharp(diskPath, { animated: !!opts.animated }).metadata();

    // Optimized WebP (max 1200px wide)
    let pipeline = sharp(diskPath, opts);
    if ((metadata.width || 0) > IMAGE_MAX_WIDTH) {
      pipeline = pipeline.resize({ width: IMAGE_MAX_WIDTH, withoutEnlargement: true });
    }
    await pipeline.webp({ quality: WEBP_QUALITY, ...opts }).toFile(optimizedDisk);

    // Thumbnail WebP (200px wide)
    await sharp(diskPath, opts)
      .resize({ width: THUMB_MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: THUMB_QUALITY, ...opts })
      .toFile(thumbDisk);

    const url = file.path; // browser-relative original URL: /uploads/<sub>/<file>
    const dir = url.slice(0, url.lastIndexOf('/'));
    file.optimizedPath = `${dir}/${base}.webp`;
    file.thumbnailPath = `${dir}/${base}-thumb.webp`;
    file.optimized = true;
  } catch (err) {
    console.error('[imageProcessor] Failed to optimize', diskPath, err.message);
    file.optimized = false;
  }
}

/**
 * Express middleware to run after a multer uploader. Processes every image
 * file on the request and only then calls next(). Errors never block the
 * upload flow — on failure the original file is used as-is.
 */
async function processUploadedImages(req, res, next) {
  try {
    const files = [];
    if (req.file) files.push(req.file);
    if (Array.isArray(req.files)) files.push(...req.files);
    for (const f of files) {
      await processFile(f);
    }
  } catch (err) {
    console.error('[imageProcessor]', err.message);
  }
  next();
}

module.exports = { processImage: processFile, processUploadedImages, isImageFile };