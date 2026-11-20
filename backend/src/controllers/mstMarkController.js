const fs = require('fs');
const xlsx = require('xlsx');
const Faculty = require('../models/Faculty');
const FacultyTeachingAssignment = require('../models/FacultyTeachingAssignment');
const Subject = require('../models/Subject');
const Student = require('../models/Student');
const Result = require('../models/Result');
const MstMark = require('../models/MstMark');
const {
  MST_MAX_MARKS,
  normalizeAssessment,
  assessmentLabel,
  validateMstRows,
  canSyncMstMark,
  buildMstSubjectMark,
} = require('../utils/mstMarks');
const { getMstRoster, normalizeSection } = require('../services/mstRoster');
const { getFacultyAssignments, buildAudienceOptions } = require('../services/noticeAudienceService');
const { normalizeSession, getAcademicContext } = require('../utils/academicSession');
const { resolveStudentSection } = require('../utils/sectionResolver');

const normalizeBranch = (value) => String(value ?? '').trim().toUpperCase();
const isValidObjectId = (value) => /^[0-9a-fA-F]{24}$/.test(String(value || ''));

const cleanupFile = (filePath) => {
  if (!filePath) return;
  try {
    fs.unlinkSync(filePath);
  } catch {
    // Best-effort temp cleanup.
  }
};

const getFaculty = async (req) => Faculty.findOne({ userId: req.user._id }).lean();

const resolveAssignment = async ({ facultyId, assignmentId, session, term }) => {
  if (!isValidObjectId(assignmentId)) return { error: 'Select a valid class.' };
  const assignment = await FacultyTeachingAssignment.findOne({
    _id: assignmentId,
    facultyId,
    itemType: 'class',
    session: normalizeSession(session),
    term,
  })
    .populate('subjectId', 'code name branch semester credits')
    .lean();
  if (!assignment?.subjectId) {
    return { error: 'This class is not assigned to you for the selected session and term.' };
  }
  return { assignment };
};

const readRows = (filePath) => {
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) return [];
  return xlsx.utils.sheet_to_json(firstSheet, { defval: '' });
};

const assignmentSummary = (assignment) => ({
  assignmentId: assignment._id,
  subjectId: assignment.subjectId._id,
  subjectCode: assignment.subjectId.code,
  subjectName: assignment.subjectId.name,
  branch: normalizeBranch(assignment.branch || assignment.subjectId.branch),
  semester: Number(assignment.semester),
  section: normalizeSection(assignment.section),
  sectionLabel: assignment.section ? `Section ${normalizeSection(assignment.section)}` : 'All sections',
  session: normalizeSession(assignment.session),
  term: assignment.term,
});

const parseRequest = (req) => {
  const assessment = normalizeAssessment(req.body.assessment);
  if (!assessment) return { error: 'Assessment must be MST 1 or MST 2.' };
  if (!req.file) return { error: 'Upload an Excel or CSV file.' };
  if (!req.academicSession) return { error: 'Select an academic session before uploading MST marks.' };
  if (!req.academicTerm) return { error: 'Select an academic term before uploading MST marks.' };
  return { assessment };
};

exports.getOptions = async (req, res) => {
  try {
    const faculty = await getFaculty(req);
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });
    if (!req.academicSession) {
      return res.status(400).json({ success: false, message: 'Select an academic session first.' });
    }
    const assignments = await getFacultyAssignments(faculty._id, {
      session: req.academicSession,
      term: req.academicTerm,
    });
    const options = buildAudienceOptions(assignments).filter((option) => option.itemType === 'class');
    res.json({
      success: true,
      data: {
        session: normalizeSession(req.academicSession),
        term: req.academicTerm,
        options,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMarks = async (req, res) => {
  try {
    const faculty = await getFaculty(req);
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });
    const filter = { facultyId: faculty._id };
    if (req.query.session || req.academicSession) filter.session = normalizeSession(req.query.session || req.academicSession);
    if (req.query.term || req.academicTerm) filter.term = req.query.term || req.academicTerm;
    if (isValidObjectId(req.query.subjectId)) filter.subjectId = req.query.subjectId;
    if (normalizeAssessment(req.query.assessment)) filter.assessment = normalizeAssessment(req.query.assessment);

    const marks = await MstMark.find(filter)
      .populate('subjectId', 'code name')
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ success: true, data: { marks } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.previewUpload = async (req, res) => {
  try {
    const parsed = parseRequest(req);
    if (parsed.error) {
      cleanupFile(req.file?.path);
      return res.status(400).json({ success: false, message: parsed.error });
    }
    const faculty = await getFaculty(req);
    if (!faculty) {
      cleanupFile(req.file.path);
      return res.status(404).json({ success: false, message: 'Faculty profile not found' });
    }
    const resolved = await resolveAssignment({
      facultyId: faculty._id,
      assignmentId: req.body.assignmentId,
      session: req.academicSession,
      term: req.academicTerm,
    });
    if (resolved.error) {
      cleanupFile(req.file.path);
      return res.status(403).json({ success: false, message: resolved.error });
    }

    const rows = readRows(req.file.path);
    if (rows.length === 0) {
      cleanupFile(req.file.path);
      return res.status(400).json({ success: false, message: 'The uploaded file has no data rows.' });
    }
    const roster = await getMstRoster(resolved.assignment);
    const validation = validateMstRows({ rows, assessment: parsed.assessment, roster });
    cleanupFile(req.file.path);
    if (validation.error) {
      return res.status(400).json({ success: false, message: validation.error });
    }
    res.json({
      success: true,
      data: {
        assignment: assignmentSummary(resolved.assignment),
        assessment: parsed.assessment,
        assessmentLabel: assessmentLabel(parsed.assessment),
        maxMarks: MST_MAX_MARKS,
        rosterCount: roster.length,
        valid: validation.valid,
        failed: validation.failed,
        stats: {
          totalRows: rows.length,
          validCount: validation.valid.length,
          failedCount: validation.failed.length,
        },
      },
    });
  } catch (err) {
    cleanupFile(req.file?.path);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.uploadMarks = async (req, res) => {
  try {
    const parsed = parseRequest(req);
    if (parsed.error) {
      cleanupFile(req.file?.path);
      return res.status(400).json({ success: false, message: parsed.error });
    }
    const faculty = await getFaculty(req);
    if (!faculty) {
      cleanupFile(req.file.path);
      return res.status(404).json({ success: false, message: 'Faculty profile not found' });
    }
    const resolved = await resolveAssignment({
      facultyId: faculty._id,
      assignmentId: req.body.assignmentId,
      session: req.academicSession,
      term: req.academicTerm,
    });
    if (resolved.error) {
      cleanupFile(req.file.path);
      return res.status(403).json({ success: false, message: resolved.error });
    }

    const rows = readRows(req.file.path);
    if (rows.length === 0) {
      cleanupFile(req.file.path);
      return res.status(400).json({ success: false, message: 'The uploaded file has no data rows.' });
    }
    const roster = await getMstRoster(resolved.assignment);
    if (roster.length === 0) {
      cleanupFile(req.file.path);
      return res.status(400).json({ success: false, message: 'No active students were found for this class.' });
    }
    const validation = validateMstRows({ rows, assessment: parsed.assessment, roster });
    if (validation.error) {
      cleanupFile(req.file.path);
      return res.status(400).json({ success: false, message: validation.error });
    }
    if (validation.failed.length > 0) {
      cleanupFile(req.file.path);
      return res.status(400).json({
        success: false,
        message: `Fix ${validation.failed.length} invalid row(s) before saving the draft.`,
        data: { failed: validation.failed },
      });
    }
    if (validation.valid.length === 0) {
      cleanupFile(req.file.path);
      return res.status(400).json({ success: false, message: 'No valid MST marks were found in the file.' });
    }

    const assignment = resolved.assignment;
    const summary = assignmentSummary(assignment);
    const existing = await MstMark.findOne({
      facultyId: faculty._id,
      subjectId: summary.subjectId,
      session: summary.session,
      term: summary.term,
      semester: summary.semester,
      section: summary.section,
      assessment: parsed.assessment,
    });
    if (existing?.status === 'published') {
      cleanupFile(req.file.path);
      return res.status(409).json({
        success: false,
        message: `${assessmentLabel(parsed.assessment)} marks for this class are already published and cannot be overwritten.`,
      });
    }

    const payload = {
      facultyId: faculty._id,
      assignmentId: assignment._id,
      subjectId: summary.subjectId,
      assessment: parsed.assessment,
      session: summary.session,
      term: summary.term,
      semester: summary.semester,
      branch: summary.branch,
      section: summary.section,
      sectionLabel: summary.sectionLabel,
      maxMarks: MST_MAX_MARKS,
      marks: validation.valid.map((mark) => ({
        studentId: mark.studentId,
        enrollmentNo: mark.enrollmentNo,
        studentName: mark.studentName,
        marks: mark.marks,
      })),
      status: 'draft',
      fileName: req.file.originalname,
      uploadedAt: new Date(),
      publishedAt: undefined,
    };

    let doc;
    if (existing) {
      existing.set(payload);
      doc = await existing.save();
    } else {
      doc = await MstMark.create(payload);
    }
    cleanupFile(req.file.path);
    res.json({
      success: true,
      message: `${assessmentLabel(parsed.assessment)} draft saved for ${validation.valid.length} student(s).`,
      data: { mark: doc },
    });
  } catch (err) {
    cleanupFile(req.file?.path);
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, message: 'MST marks already exist for this class and assessment.' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.publishMarks = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid MST marks id' });
    }
    const faculty = await getFaculty(req);
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });
    const doc = await MstMark.findOne({ _id: req.params.id, facultyId: faculty._id });
    if (!doc) return res.status(404).json({ success: false, message: 'MST marks not found or not owned by you.' });
    if (doc.status === 'published') {
      return res.status(409).json({ success: false, message: 'These MST marks are already published.' });
    }
    if (!doc.marks.length) {
      return res.status(400).json({ success: false, message: 'This MST draft has no student marks to publish.' });
    }

    const stillAssigned = await FacultyTeachingAssignment.exists({
      facultyId: faculty._id,
      itemType: 'class',
      subjectId: doc.subjectId,
      session: doc.session,
      term: doc.term,
      semester: doc.semester,
      section: doc.section,
    });
    if (!stillAssigned) {
      return res.status(403).json({
        success: false,
        message: 'Your teaching assignment for this class is no longer active. Ask the administration to reassign it.',
      });
    }

    const item = await Subject.findById(doc.subjectId).lean();
    if (!item) return res.status(404).json({ success: false, message: 'Subject not found.' });

    const studentIds = doc.marks.map((mark) => mark.studentId);
    const results = await Result.find({
      studentId: { $in: studentIds },
      semester: doc.semester,
      session: doc.session,
    });
    const resultMap = new Map(results.map((result) => [String(result.studentId), result]));

    const failures = [];
    const writes = [];
    const now = new Date();
    doc.marks.forEach((mstMark) => {
      const result = resultMap.get(String(mstMark.studentId));
      const existingMark = result?.subjectMarks?.find(
        (mark) => String(mark.subjectId) === String(doc.subjectId),
      );
      const blocked = canSyncMstMark({ result, existingMark });
      if (blocked) {
        failures.push({
          enrollmentNo: mstMark.enrollmentNo,
          studentName: mstMark.studentName,
          reason: blocked,
        });
        return;
      }
      const markEntry = buildMstSubjectMark({
        existingMark,
        item,
        assessment: doc.assessment,
        marks: mstMark.marks,
        facultyId: faculty._id,
        now,
      });
      writes.push({
        result: result || new Result({
          studentId: mstMark.studentId,
          semester: doc.semester,
          session: doc.session,
          branch: doc.branch,
          subjectMarks: [],
        }),
        existingMark,
        markEntry,
      });
    });

    if (failures.length > 0) {
      return res.status(409).json({
        success: false,
        message: `${failures.length} student result(s) could not be updated because marks are already published or approved.`,
        data: { failed: failures },
      });
    }

    for (const write of writes) {
      const { result, markEntry, existingMark } = write;
      const existingIndex = result.subjectMarks.findIndex(
        (mark) => String(mark.subjectId) === String(doc.subjectId),
      );
      if (existingIndex >= 0) result.subjectMarks[existingIndex] = markEntry;
      else result.subjectMarks.push(markEntry);
      result.markModified('subjectMarks');
      if (!existingMark && !result.branch) result.branch = doc.branch;
      await result.save();
    }

    doc.status = 'published';
    doc.publishedAt = now;
    await doc.save();

    res.json({
      success: true,
      message: `${assessmentLabel(doc.assessment)} marks published for ${writes.length} student(s).`,
      data: { mark: doc, updatedResults: writes.length },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.downloadTemplate = async (req, res) => {
  try {
    const assessment = normalizeAssessment(req.query.assessment || 'mst1');
    if (!assessment) return res.status(400).json({ success: false, message: 'Assessment must be MST 1 or MST 2.' });
    const faculty = await getFaculty(req);
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });
    if (!req.academicSession) {
      return res.status(400).json({ success: false, message: 'Select an academic session first.' });
    }
    const resolved = await resolveAssignment({
      facultyId: faculty._id,
      assignmentId: req.query.assignmentId,
      session: req.academicSession,
      term: req.academicTerm,
    });
    if (resolved.error) return res.status(403).json({ success: false, message: resolved.error });

    const roster = await getMstRoster(resolved.assignment);
    const label = `${assessmentLabel(assessment)} (${MST_MAX_MARKS})`;
    const sheet = xlsx.utils.aoa_to_sheet([
      ['enrollmentNo', 'studentName', label],
      ...roster.map((student) => [
        student.enrollmentNo,
        `${student.firstName || ''} ${student.lastName || ''}`.trim(),
        '',
      ]),
    ]);
    sheet['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 15 }];
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, sheet, 'MST Marks');
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const summary = assignmentSummary(resolved.assignment);
    const sectionPart = summary.section ? `-${summary.section}` : '';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${summary.subjectCode || 'subject'}-${assessment.toUpperCase()}${sectionPart}.xlsx"`,
    );
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getStudentMstMarks = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id }).lean();
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found' });
    const academic = getAcademicContext(student, req.academicSession, req.academicHistory, req.academicTerm);
    const resolvedSection = await resolveStudentSection({
      ...student,
      section: academic.section ?? student.section,
      branch: academic.branch ?? student.branch,
      currentSemester: academic.semester ?? student.currentSemester,
    });
    const sectionName = normalizeSection(resolvedSection.sectionName);
    const requestedSemester = Number(req.query.semester);
    const semester = Number.isInteger(requestedSemester) && requestedSemester >= 1 && requestedSemester <= 8
      ? requestedSemester
      : Number(academic.semester || student.currentSemester);
    const docs = await MstMark.find({
      status: 'published',
      session: normalizeSession(academic.session),
      term: academic.term,
      branch: normalizeBranch(academic.branch || student.branch),
      semester,
      section: { $in: ['', ...(sectionName ? [sectionName] : [])] },
      marks: { $elemMatch: { studentId: student._id } },
    })
      .populate('subjectId', 'code name')
      .sort({ publishedAt: -1 })
      .lean();

    const deduped = new Map();
    docs.forEach((doc) => {
      const mark = doc.marks.find((entry) => String(entry.studentId) === String(student._id));
      if (!mark) return;
      const key = `${String(doc.subjectId?._id || doc.subjectId)}|${doc.assessment}`;
      const item = {
        _id: doc._id,
        assessment: doc.assessment,
        assessmentLabel: assessmentLabel(doc.assessment),
        subjectId: doc.subjectId?._id || doc.subjectId,
        subjectCode: doc.subjectId?.code,
        subjectName: doc.subjectId?.name,
        marks: mark.marks,
        maxMarks: doc.maxMarks || MST_MAX_MARKS,
        publishedAt: doc.publishedAt,
        sectionLabel: doc.sectionLabel,
      };
      const current = deduped.get(key);
      if (!current || (current.sectionLabel === 'All sections' && doc.section)) {
        deduped.set(key, item);
      }
    });

    res.json({
      success: true,
      data: {
        items: [...deduped.values()].sort((a, b) => (
          String(a.subjectCode || '').localeCompare(String(b.subjectCode || ''))
          || String(a.assessment).localeCompare(String(b.assessment))
        )),
        session: normalizeSession(academic.session),
        term: academic.term,
        semester,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
