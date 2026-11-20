const Subject = require('../models/Subject');
const Lab = require('../models/Lab');
const {
  previewImport,
  confirmImport,
  createImportTemplateWorkbook,
  createSubjectsExportWorkbook,
} = require('../services/subjectImportService');
const { normalizeSession } = require('../utils/academicSession');
const { departmentLabel } = require('../utils/departments');

exports.downloadTemplate = async (req, res) => {
  try {
    const workbook = createImportTemplateWorkbook();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="subject-lab-import-template.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.previewImport = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'Please select a file to upload' });
    }

    const session = req.body.session || req.academicSession;
    const branch = req.body.branch;
    const semester = req.body.semester;
    const updateMode = req.body.updateMode === 'update' ? 'update' : 'skip';

    const result = await previewImport({
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      session,
      branch,
      semester,
      updateMode,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.confirmImport = async (req, res) => {
  try {
    const session = req.body.session || req.academicSession;
    const branch = req.body.branch;
    const semester = req.body.semester;
    const updateMode = req.body.updateMode === 'update' ? 'update' : 'skip';
    const rows = req.body.rows;

    const result = await confirmImport({
      session,
      branch,
      semester,
      updateMode,
      rows,
    });

    res.json({
      success: true,
      data: {
        ...result,
        message: `Import complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped.`,
      },
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.exportSubjects = async (req, res) => {
  try {
    const session = normalizeSession(req.query.session) || normalizeSession(req.academicSession);
    const branch = req.query.branch ? String(req.query.branch).trim().toUpperCase() : null;
    const semester = req.query.semester ? Number(req.query.semester) : null;

    if (!session || !branch) {
      return res.status(400).json({ success: false, message: 'Session and Department are required for export' });
    }

    const filter = { session, branch };
    if (semester) filter.semester = semester;

    const [subjects, labs] = await Promise.all([
      Subject.find(filter).lean(),
      Lab.find(filter).lean(),
    ]);

    const workbook = createSubjectsExportWorkbook({
      subjects,
      labs,
      departmentName: departmentLabel(branch),
    });

    const semSuffix = semester ? `-Sem${semester}` : '';
    const filename = `Scheme_${branch}_${session}${semSuffix}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
