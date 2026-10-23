const Student = require('../models/Student');
const StudentAcademicHistory = require('../models/StudentAcademicHistory');
const Section = require('../models/Section');
const { normalizeSession } = require('../utils/academicSession');

const normalizeSection = (value) => String(value ?? '').trim().toUpperCase();
const normalizeBranch = (value) => String(value ?? '').trim().toUpperCase();

const sectionNameFromRef = (ref, sectionsById, sectionsByName) => {
  if (!ref) return '';
  if (typeof ref === 'object' && ref.sectionName) return String(ref.sectionName).trim();
  const raw = String(ref).trim();
  if (!raw) return '';
  const byId = sectionsById.get(raw);
  if (byId) return String(byId.sectionName || '').trim();
  const byName = sectionsByName.get(raw.toUpperCase());
  if (byName) return String(byName.sectionName || '').trim();
  return raw;
};

/**
 * Active roster for one authorized teaching assignment.
 * Assignment.section === '' means every section in that branch/semester.
 */
const getMstRoster = async (assignment) => {
  if (!assignment?.branch || !assignment?.semester) return [];

  const session = normalizeSession(assignment.session);
  const semester = Number(assignment.semester);
  const branch = normalizeBranch(assignment.branch);
  const requestedSection = normalizeSection(assignment.section);

  const histories = await StudentAcademicHistory.find({
    session,
    term: assignment.term,
    semester,
    branch,
    status: 'active',
  }).select('studentId section').lean();

  let students;
  if (histories.length > 0) {
    students = await Student.find({ _id: { $in: histories.map((history) => history.studentId) } })
      .populate('section', 'sectionName')
      .select('firstName lastName enrollmentNo branch currentSemester section')
      .lean();
  } else {
    students = await Student.find({
      branch,
      currentSemester: semester,
    })
      .populate('section', 'sectionName')
      .select('firstName lastName enrollmentNo branch currentSemester section')
      .lean();
  }

  const sections = await Section.find({}).select('_id sectionName').lean();
  const sectionsById = new Map(sections.map((section) => [String(section._id), section]));
  const sectionsByName = new Map(
    sections.map((section) => [String(section.sectionName || '').trim().toUpperCase(), section]),
  );
  const historyByStudent = new Map(
    histories.map((history) => [String(history.studentId), history]),
  );

  return students
    .map((student) => {
      const history = historyByStudent.get(String(student._id));
      const sectionName = normalizeSection(sectionNameFromRef(
        history?.section || student.section,
        sectionsById,
        sectionsByName,
      ));
      return {
        _id: student._id,
        enrollmentNo: student.enrollmentNo,
        firstName: student.firstName,
        lastName: student.lastName,
        sectionName,
      };
    })
    .filter((student) => !requestedSection || student.sectionName === requestedSection)
    .sort((a, b) => String(a.enrollmentNo).localeCompare(String(b.enrollmentNo), undefined, { numeric: true }));
};

module.exports = {
  getMstRoster,
  normalizeSection,
};
