const { calculateGrade } = require('./resultManagement');

const MST_MAX_MARKS = 20;
const MST_ASSESSMENTS = ['mst1', 'mst2'];

const normalizeAssessment = (value) => {
  const compact = String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (compact === 'mst1' || compact === 'midterm1') return 'mst1';
  if (compact === 'mst2' || compact === 'midterm2') return 'mst2';
  return null;
};

const assessmentLabel = (assessment) => (
  normalizeAssessment(assessment) === 'mst2' ? 'MST 2' : 'MST 1'
);

const normalizeEnrollmentNo = (value) => String(value ?? '').trim();

const normalizeHeader = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

const markHeaderCandidates = (assessment) => (
  normalizeAssessment(assessment) === 'mst2'
    ? ['mst2', 'midterm2', 'midtermmark2', 'mstmarks', 'midtermmark', 'marks']
    : ['mst1', 'midterm1', 'midtermmark1', 'mstmarks', 'midtermmark', 'marks']
);

const findMarkCell = (row, assessment) => {
  if (!row || typeof row !== 'object') return { found: false, value: undefined };
  const candidates = markHeaderCandidates(assessment);
  const entries = Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]);
  for (const candidate of candidates) {
    const match = entries.find(([key]) => key === candidate);
    if (match) return { found: true, value: match[1] };
  }
  return { found: false, value: undefined };
};

const parseMark = (value) => {
  if (value === '' || value === null || value === undefined) return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : NaN;
};

/**
 * Validate raw Excel/CSV rows against an authorized roster.
 * roster items: { _id, enrollmentNo, firstName, lastName, sectionName }
 */
const validateMstRows = ({ rows = [], assessment, roster = [] } = {}) => {
  const normalizedAssessment = normalizeAssessment(assessment);
  if (!normalizedAssessment) {
    return { error: 'Assessment must be MST 1 or MST 2.', valid: [], failed: [] };
  }

  const rosterMap = new Map();
  roster.forEach((student) => {
    const key = normalizeEnrollmentNo(student.enrollmentNo).toLowerCase();
    if (key) rosterMap.set(key, student);
  });

  const duplicates = new Map();
  rows.forEach((row) => {
    const key = normalizeEnrollmentNo(
      row.enrollmentNo ?? row.EnrollmentNo ?? row['Enrollment No'] ?? row.rollNo ?? row.RollNo,
    ).toLowerCase();
    if (!key) return;
    duplicates.set(key, (duplicates.get(key) || 0) + 1);
  });

  const hasMarkHeader = rows.some((row) => findMarkCell(row, normalizedAssessment).found);
  if (rows.length > 0 && !hasMarkHeader) {
    return {
      error: `The file has no ${assessmentLabel(normalizedAssessment)} marks column. Download the template and try again.`,
      valid: [],
      failed: [],
    };
  }

  const valid = [];
  const failed = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const enrollmentNo = normalizeEnrollmentNo(
      row.enrollmentNo ?? row.EnrollmentNo ?? row['Enrollment No'] ?? row.rollNo ?? row.RollNo,
    );
    if (!enrollmentNo) {
      failed.push({ row: rowNumber, enrollmentNo: '', reason: 'Missing enrollment number' });
      return;
    }

    const key = enrollmentNo.toLowerCase();
    if ((duplicates.get(key) || 0) > 1) {
      failed.push({ row: rowNumber, enrollmentNo, reason: 'Duplicate enrollment number in the uploaded file' });
      return;
    }

    const student = rosterMap.get(key);
    if (!student) {
      failed.push({
        row: rowNumber,
        enrollmentNo,
        reason: 'Student is not in the active roster for this class/section',
      });
      return;
    }

    const cell = findMarkCell(row, normalizedAssessment);
    if (!cell.found) {
      failed.push({
        row: rowNumber,
        enrollmentNo,
        reason: `Missing ${assessmentLabel(normalizedAssessment)} marks`,
      });
      return;
    }
    const marks = parseMark(cell.value);
    if (!Number.isFinite(marks)) {
      failed.push({ row: rowNumber, enrollmentNo, reason: 'Marks must be a valid number' });
      return;
    }
    if (marks < 0 || marks > MST_MAX_MARKS) {
      failed.push({
        row: rowNumber,
        enrollmentNo,
        reason: `Marks must be between 0 and ${MST_MAX_MARKS}`,
      });
      return;
    }

    valid.push({
      row: rowNumber,
      studentId: student._id,
      enrollmentNo: student.enrollmentNo || enrollmentNo,
      studentName: `${student.firstName || ''} ${student.lastName || ''}`.trim(),
      marks: Number(marks.toFixed(2)),
    });
  });

  return { valid, failed };
};

const canSyncMstMark = ({ result, existingMark }) => {
  if (result?.isPublished) {
    return 'Result is already published; MST marks cannot be changed.';
  }
  if (existingMark?.submissionStatus === 'approved') {
    return 'Subject marks are already approved; MST marks cannot be changed.';
  }
  return null;
};

/**
 * Build the Result.subjectMarks entry to persist when an MST draft is published.
 * Existing theory/internal components are preserved; only the selected MST
 * component and its derived CW/total/grade fields change.
 */
const buildMstSubjectMark = ({
  existingMark = {},
  item,
  assessment,
  marks,
  facultyId,
  now = new Date(),
}) => {
  const normalizedAssessment = normalizeAssessment(assessment);
  if (!normalizedAssessment) throw new Error('Invalid MST assessment');
  const numericMarks = Number(marks);
  if (!Number.isFinite(numericMarks) || numericMarks < 0 || numericMarks > MST_MAX_MARKS) {
    throw new Error(`MST marks must be between 0 and ${MST_MAX_MARKS}`);
  }

  const base = existingMark?.toObject ? existingMark.toObject() : { ...existingMark };
  const midTerm1 = normalizedAssessment === 'mst1'
    ? numericMarks
    : Number(base.midTerm1) || 0;
  const midTerm2 = normalizedAssessment === 'mst2'
    ? numericMarks
    : Number(base.midTerm2) || 0;
  const midTermMode = base.midTermMode === 'best' ? 'best' : 'average';
  const midTermAverage = Number((
    midTermMode === 'best'
      ? Math.max(midTerm1, midTerm2)
      : (midTerm1 + midTerm2) / 2
  ).toFixed(2));
  const assignmentMarks = Number(base.assignmentMarks) || 0;
  const cw = Number((midTermAverage + assignmentMarks).toFixed(2));
  const theory = Number(base.theory ?? base.externalMarks) || 0;
  const totalMarks = Number((cw + theory).toFixed(2));
  const credits = Number(base.credits || item?.credits || 3);
  const { grade, gradePoints } = calculateGrade(totalMarks);

  return {
    ...base,
    subjectId: item?._id,
    labId: undefined,
    itemType: 'class',
    itemCode: item?.code,
    itemName: item?.name,
    midTerm1,
    midTerm2,
    midTermMode,
    midTermAverage,
    assignmentMarks,
    cw,
    internalMarks: cw,
    theory,
    externalMarks: theory,
    totalMarks,
    grade,
    gradePoints,
    credits,
    creditPoints: gradePoints * credits,
    submissionStatus: 'pending',
    submittedBy: facultyId,
    submittedAt: now,
    reviewedBy: undefined,
    reviewedAt: undefined,
    rejectionReason: undefined,
  };
};

module.exports = {
  MST_MAX_MARKS,
  MST_ASSESSMENTS,
  normalizeAssessment,
  assessmentLabel,
  normalizeEnrollmentNo,
  findMarkCell,
  validateMstRows,
  canSyncMstMark,
  buildMstSubjectMark,
};
