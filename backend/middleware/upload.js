const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.resolve(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');

const ensureDir = (sub) => {
  const dir = path.join(UPLOAD_DIR, sub);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const localDisk = (subfolder) => {
  const getSub = typeof subfolder === 'function' ? subfolder : () => subfolder;
  const disk = multer.diskStorage({
    destination: (req, file, cb) => cb(null, ensureDir(getSub(req))),
    filename: (req, file, cb) => {
      const sub = getSub(req);
      const ext = path.extname(file.originalname) || '';
      cb(null, `${sub.slice(0, -1)}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  });
  return {
    _handleFile: (req, file, cb) => {
      disk._handleFile(req, file, (err, info) => {
        if (err) return cb(err);
        info.path = '/uploads/' + getSub(req) + '/' + info.filename;
        cb(null, info);
      });
    },
    _removeFile: (req, file, cb) => { disk._removeFile(req, file, cb); },
  };
};

const base = (sub) => multer({ storage: localDisk(sub), limits: { fileSize: 10 * 1024 * 1024 } });

const manufacturerFolder = (req) => {
  const mfr = req.body?.manufacturer;
  if (mfr === 'Novomatic') return 'novomatic';
  if (mfr === 'Meteora') return 'meteora';
  return 'meters';
};

module.exports = {
  uploadContract: base('contracts'),
  uploadDocuments: base('documents').array('documents', 5),
  uploadReceipt: base('receipts'),
  uploadMeter: base(manufacturerFolder),
  uploadAvatar: base('avatars'),
  uploadTicket: base('tickets'),
  uploadEmployee: base('employees').array('documents', 5),
};
