const multer = require('multer');
const path = require('path');

const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv', '.pdf'];

const importFileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname || '').toLowerCase();
  if (ALLOWED_EXTENSIONS.includes(extension)) {
    cb(null, true);
    return;
  }
  const error = new Error('Invalid file type. Upload an .xlsx, .xls, .csv or .pdf file.');
  error.statusCode = 400;
  error.isImportUploadError = true;
  cb(error);
};

const uploadImportFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMPORT_FILE_SIZE },
  fileFilter: importFileFilter,
});

module.exports = uploadImportFile;
module.exports.MAX_IMPORT_FILE_SIZE = MAX_IMPORT_FILE_SIZE;
module.exports.ALLOWED_EXTENSIONS = ALLOWED_EXTENSIONS;
