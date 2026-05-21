const fs = require('fs');
const xlsx = require('xlsx');

const MARK_LIMITS = {
  midTerm: 30,
  endSem: 50,
  assignment: 10,
  quiz: 10,
  attendance: 10,
  practical: 20,
  total: 100,
};

const DEFAULT_GRADE_BANDS = [
  { min: 90, max: 100, grade: 'O', point: 10 },
  { min: 80, max: 89.99, grade: 'A+', point: 9 },
  { min: 70, max: 79.99, grade: 'A', point: 8 },
  { min: 60, max: 69.99, grade: 'B+', point: 7 },
  { min: 50, max: 59.99, grade: 'B', point: 6 },
  { min: 40, max: 49.99, grade: 'C', point: 5 },
  { min: 0, max: 39.99, grade: 'F', point: 0 },
];

const normalizeRow = (row = {}) => ({
  enrollmentNo: String(row.EnrollmentNo || row.enrollmentNo || row['Enrollment No'] || '').trim(),
  studentName: String(row.StudentName || row.studentName || row['Student Name'] || '').trim(),
  midTerm: Number(row.MidTermMarks || row.midTerm || row.midTermMarks || 0),
  endSem: Number(row.EndSemMarks || row.endSem || row.endSemMarks || 0),
  assignment: Number(row.AssignmentMarks || row.assignment || row.assignmentMarks || 0),
  quiz: Number(row.QuizMarks || row.quiz || row.quizMarks || 0),
  attendance: Number(row.AttendanceMarks || row.attendance || row.attendanceMarks || 0),
  practical: Number(row.PracticalMarks || row.practical || row.practicalMarks || 0),
  totalMarks: Number(row.TotalMarks || row.total || row.totalMarks || 0),
});

const computeTotal = (row) => (
  (Number(row.midTerm) || 0)
  + (Number(row.endSem) || 0)
  + (Number(row.assignment) || 0)
  + (Number(row.quiz) || 0)
  + (Number(row.attendance) || 0)
  + (Number(row.practical) || 0)
);

const hasEmptyMarkRow = (row) => {
  const values = [row.midTerm, row.endSem, row.assignment, row.quiz, row.attendance, row.practical]
    .map(v => Number(v) || 0);
  return values.every(v => v === 0);
};

const validateMarkValue = (name, value, max) => {
  if (!Number.isFinite(value)) return `${name} is not a valid number`;
  if (value < 0) return `${name} cannot be negative`;
  if (value > max) return `${name} cannot be greater than ${max}`;
  return null;
};

const parseSheetRows = (filePath) => {
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return xlsx.utils.sheet_to_json(sheet, { defval: '' });
};

const cleanupUploadedFile = (filePath) => {
  if (!filePath) return;
  try {
    fs.unlinkSync(filePath);
  } catch (err) {
    // Intentionally ignore cleanup failures.
  }
};

const findBand = (marks, bands = DEFAULT_GRADE_BANDS) => {
  const value = Number(marks) || 0;
  const matched = bands.find(b => value >= b.min && value <= b.max);
  return matched || { grade: 'F', point: 0 };
};

module.exports = {
  MARK_LIMITS,
  DEFAULT_GRADE_BANDS,
  normalizeRow,
  computeTotal,
  hasEmptyMarkRow,
  validateMarkValue,
  parseSheetRows,
  cleanupUploadedFile,
  findBand,
};
