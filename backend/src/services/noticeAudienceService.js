const mongoose = require('mongoose');
const Faculty = require('../models/Faculty');
const FacultyTeachingAssignment = require('../models/FacultyTeachingAssignment');
const { normalizeSession } = require('../utils/academicSession');
const { resolveStudentSection } = require('../utils/sectionResolver');

const normalizeSection = (value) => String(value ?? '').trim().toUpperCase();
const normalizeBranch = (value) => String(value ?? '').trim().toUpperCase();

const sectionLabel = (section) => (section ? `Section ${section}` : 'All sections');

const itemFromAssignment = (assignment) => (
  assignment?.itemType === 'lab' ? assignment.labId : assignment.subjectId
);

const toAudienceTarget = (assignment) => {
  const item = itemFromAssignment(assignment);
  if (!assignment || !item) return null;
  const section = normalizeSection(assignment.section);
  const semester = Number(assignment.semester || item.semester);
  if (!Number.isInteger(semester) || semester < 1 || semester > 8) return null;
  const branch = normalizeBranch(item.branch || assignment.branch);
  if (!branch || !assignment.session) return null;
  return {
    assignmentId: assignment._id,
    itemType: assignment.itemType === 'lab' ? 'lab' : 'class',
    subjectId: assignment.itemType === 'lab' ? undefined : item._id,
    labId: assignment.itemType === 'lab' ? item._id : undefined,
    subjectCode: item.code || '',
    subjectName: item.name || '',
    session: normalizeSession(assignment.session),
    term: assignment.term,
    semester,
    branch,
    section,
    sectionLabel: sectionLabel(section),
  };
};

const targetClassKey = (target) => [
  normalizeSession(target.session),
  target.term || '',
  normalizeBranch(target.branch),
  Number(target.semester),
  normalizeSection(target.section),
].join('|');

const targetKey = (target) => [
  targetClassKey(target),
  target.itemType || 'class',
  String(target.subjectId || target.labId || ''),
].join('|');

const uniqueTargets = (targets = []) => {
  const seen = new Set();
  return targets.filter((target) => {
    if (!target) return false;
    const key = targetKey(target);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const summarizeAudience = (targets = []) => {
  const classes = new Map();
  targets.forEach((target) => {
    if (!target) return;
    classes.set(targetClassKey(target), target);
  });
  const count = classes.size;
  if (count === 0) return '';
  if (count === 1) {
    const [target] = [...classes.values()];
    return `${target.branch} · Semester ${target.semester} · ${target.sectionLabel}`;
  }
  return `${count} classes/sections`;
};

/**
 * Resolve the authenticated faculty member's persisted teaching assignments.
 * Section '' is preserved and means "all sections" throughout the ERP.
 */
const getFacultyAssignments = async (facultyId, { session, term } = {}) => {
  if (!facultyId) return [];
  const filter = { facultyId };
  if (session) filter.session = normalizeSession(session);
  if (term) filter.term = term;
  return FacultyTeachingAssignment.find(filter)
    .populate('subjectId', 'code name branch semester')
    .populate('labId', 'code name branch semester')
    .sort({ session: -1, semester: 1, section: 1, itemType: 1 })
    .lean();
};

const buildAudienceOptions = (assignments = []) => uniqueTargets(
  assignments.map(toAudienceTarget).filter(Boolean),
);

/**
 * Pure target resolver used by the controller and unit tests.
 * mode: 'all-my-classes' or 'selected'
 */
const resolveTargetSelection = ({ mode, assignmentIds = [], options = [] }) => {
  const authorized = Array.isArray(options) ? options.filter(Boolean) : [];
  if (authorized.length === 0) {
    return { error: 'No teaching assignments were found for your account in this session and term.' };
  }

  if (mode === 'all-my-classes') {
    return { targets: uniqueTargets(authorized) };
  }

  if (mode !== 'selected') {
    return { error: 'Invalid audience selection mode.' };
  }

  const allowed = new Map(authorized.map((target) => [String(target.assignmentId), target]));
  const requested = [...new Set((assignmentIds || []).map(String).filter(Boolean))];
  if (requested.length === 0) {
    return { error: 'Select at least one class/section, or choose All My Classes.' };
  }
  const invalid = requested.filter((id) => !allowed.has(id));
  if (invalid.length > 0) {
    return { error: 'One or more selected classes are not assigned to you. Refresh the page and try again.' };
  }
  const targets = uniqueTargets(requested.map((id) => allowed.get(id)));
  if (targets.length === 0) {
    return { error: 'No valid authorized audience was selected.' };
  }
  return { targets };
};

/**
 * Build the complete Mongo filter for notices a student may see.
 * Admin/legacy notice behavior is preserved exactly, while faculty notices
 * require an explicit audience snapshot match.
 */
const buildStudentNoticeFilter = async ({ student, academic }) => {
  if (!student || !academic?.session) return { _id: null };

  const session = normalizeSession(academic.session);
  const adminConditions = [
    { $or: [{ authorRole: { $exists: false } }, { authorRole: 'admin' }, { authorRole: null }] },
    { audience: { $in: ['all', 'students'] } },
    { session },
    { $or: [{ term: academic.term }, { term: { $exists: false } }, { term: null }] },
    {
      $or: [
        { targetStudentIds: { $exists: false } },
        { targetStudentIds: { $size: 0 } },
        { targetStudentIds: student._id },
      ],
    },
  ];

  const resolvedSection = await resolveStudentSection({
    ...student,
    section: academic.section ?? student.section,
    branch: academic.branch ?? student.branch,
    currentSemester: academic.semester ?? student.currentSemester,
  });
  const studentSection = normalizeSection(resolvedSection.sectionName);
  const facultyFacultyConditions = [
    { authorRole: 'faculty' },
    { audience: { $in: ['students', 'all'] } },
    { 'audienceTargets.0': { $exists: true } },
    {
      audienceTargets: {
        $elemMatch: {
          session,
          term: academic.term,
          branch: normalizeBranch(academic.branch || student.branch),
          semester: Number(academic.semester || student.currentSemester),
          section: { $in: ['', ...(studentSection ? [studentSection] : [])] },
        },
      },
    },
  ];

  return {
    $or: [
      { $and: adminConditions },
      { $and: facultyFacultyConditions },
    ],
  };
};

const getFacultyFromRequest = async (userId) => {
  if (!userId) return null;
  return Faculty.findOne({ userId }).lean();
};

const isValidObjectId = (value) => mongoose.isValidObjectId(value);

module.exports = {
  normalizeSection,
  normalizeBranch,
  sectionLabel,
  targetClassKey,
  targetKey,
  uniqueTargets,
  summarizeAudience,
  getFacultyAssignments,
  buildAudienceOptions,
  resolveTargetSelection,
  buildStudentNoticeFilter,
  getFacultyFromRequest,
  isValidObjectId,
};
