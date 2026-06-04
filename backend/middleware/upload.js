// middleware/upload.js
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const { CLOUDINARY } = require('../config/constants');

cloudinary.config({
  cloud_name: CLOUDINARY.CLOUD_NAME,
  api_key: CLOUDINARY.API_KEY,
  api_secret: CLOUDINARY.API_SECRET,
});

const createStorage = (folder) => new CloudinaryStorage({
  cloudinary,
  params: { folder: `bentabet/${folder}`, allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'webp'] },
});

const memStorage = multer.memoryStorage();

module.exports = {
  uploadContract: multer({ storage: createStorage('contracts') }),
  uploadReceipt: multer({ storage: createStorage('receipts') }),
  uploadMeter: multer({ storage: memStorage }),
  uploadAvatar: multer({ storage: createStorage('avatars') }),
  uploadTicket: multer({ storage: createStorage('tickets') }),
  uploadEmployee: multer({ storage: createStorage('employees') }).array('documents', 5),
  cloudinary,
};
