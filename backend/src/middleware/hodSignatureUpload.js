const multer = require('multer');

const allowedTypes = new Set(['image/png', 'image/jpeg']);

module.exports = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!allowedTypes.has(file.mimetype)) {
      return cb(new Error('Only PNG and JPG/JPEG signature images are allowed.'));
    }
    cb(null, true);
  },
});
