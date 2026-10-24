const {
  preparePreview,
  confirmSubjectImport,
  createSubjectImportTemplateWorkbook,
  MAX_IMPORT_FILE_SIZE,
} = require('../services/subjectImport');

const sendImportError = (res, error) => {
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({ success: false, message: error.message });
};

exports.previewImport = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file was uploaded.' });
    }
    const data = await preparePreview({
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      size: req.file.size,
      session: req.body.session,
      branch: req.body.branch,
      year: req.body.year,
      semester: req.body.semester,
      updateMode: req.body.updateMode,
    });
    res.json({ success: true, data });
  } catch (error) {
    sendImportError(res, error);
  }
};

exports.confirmImport = async (req, res) => {
  try {
    const data = await confirmSubjectImport({
      session: req.body.session,
      branch: req.body.branch,
      year: req.body.year,
      semester: req.body.semester,
      updateMode: req.body.updateMode,
      rows: req.body.rows,
    });
    res.json({ success: true, data });
  } catch (error) {
    sendImportError(res, error);
  }
};

exports.downloadTemplate = async (req, res) => {
  try {
    const workbook = createSubjectImportTemplateWorkbook();
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="subject-lab-import-template.xlsx"',
    );
    res.setHeader('X-Max-Import-File-Size', String(MAX_IMPORT_FILE_SIZE));
    res.send(Buffer.from(buffer));
  } catch (error) {
    sendImportError(res, error);
  }
};
