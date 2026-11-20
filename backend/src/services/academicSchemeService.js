const Subject = require('../models/Subject');
const Lab = require('../models/Lab');
const Faculty = require('../models/Faculty');
const FacultyTeachingAssignment = require('../models/FacultyTeachingAssignment');
const academicConfig = require('../../../shared/academicConfig.json');
const { normalizeSession } = require('../utils/academicSession');
const { departmentMatches } = require('../utils/departments');
const {
  termForSemester,
  normalizeFacultyIds,
  normalizeElectiveOptions,
  planAssignmentReconciliation,
} = require('../utils/scheme');
const {
  syncFacultySubjectsTaught: syncFacultySubjectsTaughtFromAssignments,
} = require('../utils/facultyAssignments');

const normalizeAcademicCode = (value) => String(value || '').trim().toUpperCase();
const ACADEMIC_CODE_CONFLICT_MESSAGE = 'This code is already in use. Please enter a different code.';
const DEPARTMENT_CODES = (academicConfig.DEPARTMENTS || []).map((dept) => String(dept).toUpperCase());

const isValidSchemeBranch = (branch) => DEPARTMENT_CODES.includes(String(branch || '').trim().toUpperCase());

const createServiceError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const withSession = (query, mongoSession) => (mongoSession ? query.session(mongoSession) : query);

const createDocument = async (Model, doc, mongoSession) => {
  if (!mongoSession) return Model.create(doc);
  const [created] = await Model.create([doc], { session: mongoSession });
  return created;
};

const validateFacultyIds = async (facultyIds, branch, { allowCrossDepartment = false, mongoSession } = {}) => {
  if (!facultyIds || facultyIds.length === 0) return null;
  const query = Faculty.find({ _id: { $in: facultyIds } }).select('_id department').lean();
  const found = await withSession(query, mongoSession);
  if (found.length !== facultyIds.length) return 'One or more selected faculty were not found';
  if (allowCrossDepartment) return null;
  const mismatch = found.find(
    (faculty) => faculty.department && !departmentMatches(faculty.department, branch),
  );
  if (mismatch) return 'Assigned faculty must belong to the selected branch';
  return null;
};

const parseSchemeFields = (payload = {}) => {
  const fields = {};
  if (payload.session !== undefined) fields.session = normalizeSession(payload.session) || undefined;
  ['l', 't', 'p'].forEach((key) => {
    if (payload[key] !== undefined) fields[key] = Number(payload[key]) || 0;
  });
  if (payload.credits !== undefined) fields.credits = Number(payload.credits) || 0;
  ['theoryEndMax', 'cwMax', 'practicalEndMax', 'swMax'].forEach((key) => {
    if (payload[key] !== undefined) fields[key] = Number(payload[key]) || 0;
  });
  if (payload.syllabusText !== undefined) fields.syllabusText = String(payload.syllabusText || '').trim();
  if (payload.syllabusFile !== undefined) fields.syllabusFile = String(payload.syllabusFile || '').trim();
  if (payload.electiveOptions !== undefined) fields.electiveOptions = normalizeElectiveOptions(payload.electiveOptions);
  return fields;
};

const resolveSyllabusFile = (uploadedFile, payload, fallback) => {
  if (uploadedFile) return `/uploads/${uploadedFile.filename}`;
  if (payload && payload.syllabusFile !== undefined) return String(payload.syllabusFile || '').trim();
  return fallback;
};

const findAcademicCodeConflict = async (
  code,
  { subjectId, labId, session, branch, semester, mongoSession } = {},
) => {
  const normalizedCode = normalizeAcademicCode(code);
  if (!normalizedCode) return null;

  const scope = {};
  if (session) scope.session = normalizeSession(session);
  if (branch) scope.branch = String(branch).trim().toUpperCase();
  if (semester !== undefined && semester !== null && semester !== '') scope.semester = Number(semester);

  const [subject, lab] = await Promise.all([
    withSession(Subject.findOne({ code: normalizedCode, ...scope }).select('_id name').lean(), mongoSession),
    withSession(Lab.findOne({ code: normalizedCode, ...scope }).select('_id name').lean(), mongoSession),
  ]);

  if (subject && String(subject._id) !== String(subjectId || '')) {
    return ACADEMIC_CODE_CONFLICT_MESSAGE;
  }
  if (lab && String(lab._id) !== String(labId || '')) {
    return ACADEMIC_CODE_CONFLICT_MESSAGE;
  }
  return null;
};

const syncTeachingAssignments = async ({
  facultyIds,
  session,
  semester,
  branch,
  note,
  itemType,
  subjectId,
  labId,
  mongoSession,
}) => {
  const term = termForSemester(semester);
  const desired = [...new Set((facultyIds || []).map(String).filter(Boolean))];
  const itemFilter = itemType === 'lab' ? { labId } : { subjectId };
  const existingQuery = FacultyTeachingAssignment.find({ ...itemFilter, itemType, session }).lean();
  const existing = await withSession(existingQuery, mongoSession);
  const { toAdd, toRemove } = planAssignmentReconciliation(desired, existing);
  const writeOptions = mongoSession ? { ordered: false, session: mongoSession } : { ordered: false };

  if (toAdd.length) {
    const operations = toAdd.map((facultyId) => {
      const update = { $set: { semester, branch } };
      if (note !== undefined && note !== null && String(note).trim()) update.$set.note = String(note).trim();
      return {
        updateOne: {
          filter: { facultyId, itemType, ...itemFilter, session, term, section: '' },
          update,
          upsert: true,
        },
      };
    });
    await FacultyTeachingAssignment.bulkWrite(operations, writeOptions);
  }

  if (toRemove.length) {
    await FacultyTeachingAssignment.deleteMany(
      { _id: { $in: toRemove } },
      mongoSession ? { session: mongoSession } : undefined,
    );
  }

  const removedFaculty = existing
    .filter((assignment) => toRemove.some((id) => String(id) === String(assignment._id)))
    .map((assignment) => String(assignment.facultyId && assignment.facultyId._id
      ? assignment.facultyId._id
      : assignment.facultyId))
    .filter(Boolean);

  return { added: toAdd, removed: removedFaculty };
};

const syncFacultySubjectsTaught = async (subjectId, addedFacultyIds, removedFacultyIds, mongoSession) => {
  await syncFacultySubjectsTaughtFromAssignments(
    [...(addedFacultyIds || []), ...(removedFacultyIds || [])],
    mongoSession ? { session: mongoSession } : undefined,
  );
};

const attachFacultyLists = async (items, itemType, mongoSession) => {
  if (!items.length) return items;
  const ids = items.map((item) => item._id);
  const filter = itemType === 'lab'
    ? { itemType: 'lab', labId: { $in: ids } }
    : { itemType: 'class', subjectId: { $in: ids } };
  const query = FacultyTeachingAssignment.find(filter)
    .populate('facultyId', 'firstName lastName department')
    .lean();
  const assignments = await withSession(query, mongoSession);

  const byItem = new Map();
  assignments.forEach((assignment) => {
    if (!assignment.facultyId) return;
    const key = String(itemType === 'lab' ? assignment.labId : assignment.subjectId);
    const list = byItem.get(key) || [];
    list.push({
      _id: assignment.facultyId._id,
      firstName: assignment.facultyId.firstName,
      lastName: assignment.facultyId.lastName,
      department: assignment.facultyId.department,
      note: assignment.note,
    });
    byItem.set(key, list);
  });

  return items.map((item) => {
    const list = byItem.get(String(item._id));
    if (list && list.length) return { ...item, facultyList: list };
    if (item.facultyId) {
      const primary = item.facultyId._id ? item.facultyId : { _id: item.facultyId };
      return {
        ...item,
        facultyList: [{
          _id: primary._id,
          firstName: primary.firstName,
          lastName: primary.lastName,
          department: primary.department,
        }],
      };
    }
    return { ...item, facultyList: [] };
  });
};

const createSubjectRecord = async (payload = {}, options = {}) => {
  const { uploadedFile, academicSession, mongoSession } = options;
  const code = normalizeAcademicCode(payload.code);
  if (!code) throw createServiceError(400, 'Subject code is required');
  const name = String(payload.name || '').trim();
  if (!name) throw createServiceError(400, 'Subject name is required');
  const branch = String(payload.branch || '').trim().toUpperCase();
  if (!isValidSchemeBranch(branch)) {
    throw createServiceError(400, 'Select a valid department');
  }
  const semester = Number(payload.semester);
  if (!Number.isInteger(semester) || semester < 1 || semester > 8) {
    throw createServiceError(400, 'Select a valid semester (1-8)');
  }
  const session = normalizeSession(payload.session) || normalizeSession(academicSession);
  if (!session) throw createServiceError(400, 'Academic session is required');

  const codeConflict = await findAcademicCodeConflict(code, {
    session, branch, semester, mongoSession,
  });
  if (codeConflict) throw createServiceError(400, codeConflict);

  const isCommon = payload.isCommon === true || payload.isCommon === 'true';
  const facultyIds = normalizeFacultyIds(
    payload.facultyIds !== undefined ? payload.facultyIds : payload.facultyId,
  );
  const facultyError = await validateFacultyIds(facultyIds, branch, {
    allowCrossDepartment: isCommon,
    mongoSession,
  });
  if (facultyError) throw createServiceError(400, facultyError);

  const schemeFields = parseSchemeFields(payload);
  const subject = await createDocument(Subject, {
    code,
    name,
    type: ['theory', 'lab'].includes(payload.type) ? payload.type : 'theory',
    branch,
    semester,
    session,
    isCommon,
    ...schemeFields,
    syllabusFile: resolveSyllabusFile(uploadedFile, payload, schemeFields.syllabusFile),
    facultyId: facultyIds[0],
  }, mongoSession);

  if (facultyIds.length) {
    try {
      const result = await syncTeachingAssignments({
        facultyIds,
        session,
        semester,
        branch,
        note: payload.note,
        itemType: 'class',
        subjectId: subject._id,
        mongoSession,
      });
      await syncFacultySubjectsTaught(subject._id, result.added, result.removed, mongoSession);
    } catch (syncErr) {
      console.error('Teaching assignment sync failed for subject', String(subject._id), syncErr.message);
    }
  }

  const createdQuery = Subject.findById(subject._id)
    .populate('facultyId', 'firstName lastName department').lean();
  const created = await withSession(createdQuery, mongoSession);
  const [subjectWithFaculty] = await attachFacultyLists([created], 'class', mongoSession);
  return subjectWithFaculty;
};

const updateSubjectRecord = async (id, payload = {}, options = {}) => {
  const { uploadedFile, mongoSession } = options;
  const subjectQuery = Subject.findById(id);
  const subject = await withSession(subjectQuery, mongoSession);
  if (!subject) throw createServiceError(404, 'Subject not found');

  if (payload.code !== undefined) {
    const normalizedCode = normalizeAcademicCode(payload.code);
    if (!normalizedCode) throw createServiceError(400, 'Subject code is required');
    const codeConflict = await findAcademicCodeConflict(normalizedCode, {
      subjectId: subject._id,
      session: subject.session,
      branch: subject.branch,
      semester: subject.semester,
      mongoSession,
    });
    if (codeConflict) throw createServiceError(400, codeConflict);
    subject.code = normalizedCode;
  }
  if (payload.name !== undefined) subject.name = String(payload.name).trim();
  if (payload.credits !== undefined) subject.credits = Number(payload.credits) || 0;
  if (['theory', 'lab'].includes(payload.type)) subject.type = payload.type;
  if (payload.isCommon !== undefined) subject.isCommon = payload.isCommon === true || payload.isCommon === 'true';

  const schemeFields = parseSchemeFields(payload);
  const settingLegacySession = !subject.session && schemeFields.session;
  delete schemeFields.session;
  Object.assign(subject, schemeFields);
  if (settingLegacySession) subject.session = normalizeSession(payload.session);
  subject.syllabusFile = resolveSyllabusFile(uploadedFile, payload, subject.syllabusFile);

  const hasFacultyUpdate = payload.facultyIds !== undefined || payload.facultyId !== undefined;
  let facultyIds = null;
  if (hasFacultyUpdate) {
    facultyIds = normalizeFacultyIds(
      payload.facultyIds !== undefined ? payload.facultyIds : payload.facultyId,
    );
    const facultyError = await validateFacultyIds(facultyIds, subject.branch, {
      allowCrossDepartment: !!subject.isCommon,
      mongoSession,
    });
    if (facultyError) throw createServiceError(400, facultyError);
    if (facultyIds.length && !subject.session) {
      throw createServiceError(400, 'Set an academic session for this subject before assigning faculty');
    }
    subject.facultyId = facultyIds[0];
  }

  await subject.save(mongoSession ? { session: mongoSession } : undefined);

  if (facultyIds) {
    try {
      const result = await syncTeachingAssignments({
        facultyIds,
        session: subject.session,
        semester: subject.semester,
        branch: subject.branch,
        note: payload.note,
        itemType: 'class',
        subjectId: subject._id,
        mongoSession,
      });
      await syncFacultySubjectsTaught(subject._id, result.added, result.removed, mongoSession);
    } catch (syncErr) {
      console.error('Teaching assignment sync failed on subject update', String(subject._id), syncErr.message);
    }
  }

  const updatedQuery = Subject.findById(subject._id)
    .populate('facultyId', 'firstName lastName department').lean();
  const updated = await withSession(updatedQuery, mongoSession);
  const [subjectWithFaculty] = await attachFacultyLists([updated], 'class', mongoSession);
  return subjectWithFaculty;
};

const normalizeLabPayload = (payload = {}) => {
  const semester = Number(payload.semester);
  const fields = {
    code: String(payload.code || '').trim().toUpperCase(),
    name: String(payload.name || '').trim(),
    branch: String(payload.branch || '').trim().toUpperCase(),
    semester,
    year: Math.ceil(semester / 2),
    credits: Number(payload.credits || 1),
    facultyId: payload.facultyId || undefined,
  };
  if (payload.session !== undefined) fields.session = normalizeSession(payload.session) || undefined;
  ['l', 't', 'p'].forEach((key) => {
    if (payload[key] !== undefined) fields[key] = Number(payload[key]) || 0;
  });
  ['theoryEndMax', 'cwMax', 'practicalEndMax', 'swMax'].forEach((key) => {
    if (payload[key] !== undefined) fields[key] = Number(payload[key]) || 0;
  });
  if (payload.syllabusText !== undefined) fields.syllabusText = String(payload.syllabusText || '').trim();
  if (payload.syllabusFile !== undefined) fields.syllabusFile = String(payload.syllabusFile || '').trim();
  if (payload.isCommon !== undefined) fields.isCommon = payload.isCommon === true || payload.isCommon === 'true';
  return fields;
};

const createLabRecord = async (payload = {}, options = {}) => {
  const { uploadedFile, academicSession, mongoSession } = options;
  const labPayload = normalizeLabPayload(payload);
  if (!labPayload.code || !labPayload.name || !labPayload.branch
    || !Number.isInteger(labPayload.semester) || labPayload.semester < 1 || labPayload.semester > 8) {
    throw createServiceError(400, 'Code, name, branch and a valid semester (1-8) are required');
  }
  if (!isValidSchemeBranch(labPayload.branch)) {
    throw createServiceError(400, 'Select a valid department');
  }
  const session = normalizeSession(payload.session) || normalizeSession(academicSession);
  if (!session) throw createServiceError(400, 'Academic session is required');
  labPayload.session = session;

  const codeConflict = await findAcademicCodeConflict(labPayload.code, {
    session,
    branch: labPayload.branch,
    semester: labPayload.semester,
    mongoSession,
  });
  if (codeConflict) throw createServiceError(400, codeConflict);

  const facultyIds = normalizeFacultyIds(
    payload.facultyIds !== undefined ? payload.facultyIds : payload.facultyId,
  );
  const facultyError = await validateFacultyIds(facultyIds, labPayload.branch, {
    allowCrossDepartment: !!labPayload.isCommon,
    mongoSession,
  });
  if (facultyError) throw createServiceError(400, facultyError);

  labPayload.facultyId = facultyIds[0];
  labPayload.syllabusFile = resolveSyllabusFile(uploadedFile, payload, labPayload.syllabusFile);
  const lab = await createDocument(Lab, labPayload, mongoSession);

  if (facultyIds.length) {
    try {
      await syncTeachingAssignments({
        facultyIds,
        session,
        semester: lab.semester,
        branch: lab.branch,
        note: payload.note,
        itemType: 'lab',
        labId: lab._id,
        mongoSession,
      });
    } catch (syncErr) {
      console.error('Teaching assignment sync failed for lab', String(lab._id), syncErr.message);
    }
  }

  const createdQuery = Lab.findById(lab._id)
    .populate('facultyId', 'firstName lastName department').lean();
  const created = await withSession(createdQuery, mongoSession);
  const [labWithFaculty] = await attachFacultyLists([created], 'lab', mongoSession);
  return labWithFaculty;
};

const updateLabRecord = async (id, payload = {}, options = {}) => {
  const { uploadedFile, mongoSession } = options;
  const labQuery = Lab.findById(id);
  const lab = await withSession(labQuery, mongoSession);
  if (!lab) throw createServiceError(404, 'Lab not found');

  if (payload.code !== undefined) {
    const normalizedCode = normalizeAcademicCode(payload.code);
    if (!normalizedCode) throw createServiceError(400, 'Lab code is required');
    const codeConflict = await findAcademicCodeConflict(normalizedCode, {
      labId: lab._id,
      session: lab.session,
      branch: lab.branch,
      semester: lab.semester,
      mongoSession,
    });
    if (codeConflict) throw createServiceError(400, codeConflict);
    lab.code = normalizedCode;
  }
  if (payload.name !== undefined) lab.name = String(payload.name).trim();
  if (payload.credits !== undefined) lab.credits = Number(payload.credits) || 0;
  if (payload.isCommon !== undefined) lab.isCommon = payload.isCommon === true || payload.isCommon === 'true';
  if (payload.semester !== undefined) {
    const semester = Number(payload.semester);
    if (Number.isInteger(semester) && semester >= 1 && semester <= 8) {
      lab.semester = semester;
      lab.year = Math.ceil(semester / 2);
    }
  }

  const schemeFields = parseSchemeFields(payload);
  const settingLegacySession = !lab.session && schemeFields.session;
  delete schemeFields.session;
  Object.assign(lab, schemeFields);
  if (settingLegacySession) lab.session = normalizeSession(payload.session);
  lab.syllabusFile = resolveSyllabusFile(uploadedFile, payload, lab.syllabusFile);

  const hasFacultyUpdate = payload.facultyIds !== undefined || payload.facultyId !== undefined;
  let facultyIds = null;
  if (hasFacultyUpdate) {
    facultyIds = normalizeFacultyIds(
      payload.facultyIds !== undefined ? payload.facultyIds : payload.facultyId,
    );
    const facultyError = await validateFacultyIds(facultyIds, lab.branch, {
      allowCrossDepartment: !!lab.isCommon,
      mongoSession,
    });
    if (facultyError) throw createServiceError(400, facultyError);
    if (facultyIds.length && !lab.session) {
      throw createServiceError(400, 'Set an academic session for this lab before assigning faculty');
    }
    lab.facultyId = facultyIds[0];
  }

  await lab.save(mongoSession ? { session: mongoSession } : undefined);

  if (facultyIds) {
    try {
      await syncTeachingAssignments({
        facultyIds,
        session: lab.session,
        semester: lab.semester,
        branch: lab.branch,
        note: payload.note,
        itemType: 'lab',
        labId: lab._id,
        mongoSession,
      });
    } catch (syncErr) {
      console.error('Teaching assignment sync failed on lab update', String(lab._id), syncErr.message);
    }
  }

  const updatedQuery = Lab.findById(lab._id)
    .populate('facultyId', 'firstName lastName department').lean();
  const updated = await withSession(updatedQuery, mongoSession);
  const [labWithFaculty] = await attachFacultyLists([updated], 'lab', mongoSession);
  return labWithFaculty;
};

module.exports = {
  ACADEMIC_CODE_CONFLICT_MESSAGE,
  normalizeAcademicCode,
  isValidSchemeBranch,
  parseSchemeFields,
  findAcademicCodeConflict,
  syncTeachingAssignments,
  syncFacultySubjectsTaught,
  attachFacultyLists,
  createSubjectRecord,
  updateSubjectRecord,
  createLabRecord,
  updateLabRecord,
};
