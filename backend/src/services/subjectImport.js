const path = require('path');
const mongoose = require('mongoose');
const xlsx = require('xlsx');
const ExcelJS = require('exceljs');
const Subject = require('../models/Subject');
const Lab = require('../models/Lab');
const Faculty = require('../models/Faculty');
const academicConfig = require('../../../shared/academicConfig.json');
const { normalizeSession } = require('../utils/academicSession');
const { departmentMatches, departmentValues } = require('../utils/departments');
const {
  isValidSchemeBranch,
  createSubjectRecord,
  updateSubjectRecord,
  createLabRecord,
  updateLabRecord,
} = require('./academicSchemeService');

const MAX_IMPORT_ROWS = 500;
const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv', '.pdf'];
const UPDATE_MODES = ['skip', 'update'];

const TEMPLATE_COLUMNS = [
  { header: 'Code', key: 'code', width: 16 },
  { header: 'Subject Name', key: 'name', width: 34 },
  { header: 'Type (Subject or Lab)', key: 'type', width: 22 },
  { header: 'L-T-P', key: 'ltp', width: 12 },
  { header: 'Credits', key: 'credits', width: 10 },
  { header: 'Theory End', key: 'theoryEnd', width: 13 },
  { header: 'CW', key: 'cw', width: 10 },
  { header: 'Practical End', key: 'practicalEnd', width: 14 },
  { header: 'SW', key: 'sw', width: 10 },
  { header: 'Total', key: 'total', width: 10 },
  { header: 'Faculty (comma-separated names or emails)', key: 'faculty', width: 42 },
  { header: 'Semester (optional)', key: 'semester', width: 20 },
  { header: 'Year (optional)', key: 'year', width: 15 },
  { header: 'Syllabus (optional)', key: 'syllabus', width: 40 },
];

const HEADER_ALIASES = {
  code: ['code', 'subjectcode', 'subcode', 'coursecode', 'papercode'],
  name: ['subjectname', 'subname', 'name', 'coursename', 'title'],
  type: ['type', 'subjecttype', 'itemtype', 'category', 'kind'],
  ltp: ['ltp', 'ltpweek', 'hoursweek', 'hours', 'lecturetutorialpractical'],
  l: ['l', 'lecture', 'lecturehours', 'theoryhours'],
  t: ['t', 'tutorial', 'tutorialhours'],
  p: ['p', 'practical', 'practicalhours', 'labhours'],
  credits: ['credits', 'credit', 'cr'],
  theoryEnd: ['theoryend', 'thend', 'theoryendmax', 'theoryendsem', 'endsem', 'endsemtheory', 'theory'],
  cw: ['cw', 'cwmax', 'internal', 'internalmarks', 'continuousassessment'],
  practicalEnd: [
    'practicalend', 'prend', 'practicalendmax', 'practicalendsem', 'endsempractical', 'practical', 'labend',
  ],
  sw: ['sw', 'swmax', 'sessionalwork', 'sessionalmarks', 'sessionals'],
  total: ['total', 'totalmarks', 'maximummarks', 'maxmarks'],
  faculty: ['faculty', 'faculties', 'facultyname', 'facultyemail', 'teacher', 'teachers', 'facultynames'],
  semester: ['semester', 'sem', 'semesternumber'],
  year: ['year', 'studyyear', 'yearofstudy'],
  syllabus: ['syllabus', 'syllabustext', 'coursecontent'],
};

const HEADER_FIELD_BY_TOKEN = Object.entries(HEADER_ALIASES).reduce((map, [field, aliases]) => {
  aliases.forEach((alias) => map.set(alias, field));
  return map;
}, new Map());

const normalizeHeaderToken = (value) => String(value || '')
  .replace(/\([^)]*\)/g, ' ')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

const createImportError = (statusCode, message, code) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
};

const normalizeText = (value) => String(value ?? '').trim();

const normalizeKey = (value) => normalizeText(value).replace(/\s+/g, ' ').toLowerCase();

const hasValue = (value) => normalizeText(value) !== '';

const unique = (items) => [...new Set(items.filter(Boolean))];

const normalizeUpdateMode = (value) => (UPDATE_MODES.includes(value) ? value : 'skip');

const parseImportSelection = ({ session, branch, year, semester }) => {
  const normalizedSession = normalizeSession(session);
  if (!normalizedSession) {
    throw createImportError(400, 'Academic year is required.');
  }
  const normalizedBranch = normalizeText(branch).toUpperCase();
  if (!isValidSchemeBranch(normalizedBranch)) {
    throw createImportError(400, 'Select a valid department.');
  }
  const selectedSemester = parseSemesterValue(semester);
  if (selectedSemester === null) {
    throw createImportError(400, 'Select a valid semester (1-8).');
  }
  const selectedYear = parseYearValue(year);
  if (year !== undefined && year !== null && String(year).trim() !== '' && selectedYear === null) {
    throw createImportError(400, 'Select a valid year (1-4).');
  }
  const expectedYear = selectedYear || Math.ceil(selectedSemester / 2);
  if (!semesterBelongsToYear(selectedSemester, expectedYear)) {
    throw createImportError(400, `Semester ${selectedSemester} does not belong to Year ${expectedYear}.`);
  }
  return {
    session: normalizedSession,
    branch: normalizedBranch,
    selectedSemester,
    selectedYear: expectedYear,
  };
};

const validateImportFileMeta = ({ buffer, originalname, size }) => {
  const filename = String(originalname || '');
  const extension = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    throw createImportError(400, 'Invalid file type. Upload an .xlsx, .xls, .csv or .pdf file.');
  }
  const fileSize = Number(size ?? (buffer ? buffer.length : 0));
  if (!fileSize) {
    throw createImportError(400, 'No file was uploaded.');
  }
  if (fileSize > MAX_IMPORT_FILE_SIZE) {
    throw createImportError(400, 'File size limit exceeded. Maximum size is 5 MB.');
  }
  return extension;
};

const semesterBelongsToYear = (semester, year) => {
  const allowed = academicConfig.SEMESTERS_BY_YEAR?.[String(Number(year))] || [];
  return allowed.includes(Number(semester));
};

const ROMAN_VALUES = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8,
};

const parseSemesterValue = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 1 && value <= 8 ? value : null;
  }
  const text = normalizeText(value);
  if (!text) return null;
  const normalized = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normalized === 'a') return 1;
  if (normalized === 'b') return 2;
  if (ROMAN_VALUES[normalized]) return ROMAN_VALUES[normalized];
  const numericMatch = normalized.match(/\d+/);
  if (numericMatch) {
    const parsed = Number(numericMatch[0]);
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 8 ? parsed : null;
  }
  return null;
};

const YEAR_WORDS = {
  first: 1, second: 2, third: 3, fourth: 4,
};

const parseYearValue = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 1 && value <= 4 ? value : null;
  }
  const text = normalizeText(value);
  if (!text) return null;
  const normalized = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (ROMAN_VALUES[normalized] && ROMAN_VALUES[normalized] <= 4) return ROMAN_VALUES[normalized];
  const word = Object.keys(YEAR_WORDS).find((key) => normalized.startsWith(key));
  if (word) return YEAR_WORDS[word];
  const numericMatch = normalized.match(/\d+/);
  if (numericMatch) {
    const parsed = Number(numericMatch[0]);
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 4 ? parsed : null;
  }
  return null;
};

const parseTypeValue = (value) => {
  const normalized = normalizeKey(value);
  if (!normalized) return null;
  if (['subject', 'theory', 'class', 'lecture', 'course'].includes(normalized)) return 'subject';
  if (['lab', 'laboratory', 'practical', 'workshop'].includes(normalized)) return 'lab';
  return 'invalid';
};

const parseLtpValue = (raw) => {
  const ltpValue = raw.ltp;
  if (hasValue(ltpValue)) {
    const parts = String(ltpValue).trim().split(/[^0-9.]+/).filter((part) => part !== '');
    if (parts.length > 3) {
      return { error: 'L-T-P must contain at most three numbers, for example 3-1-0.' };
    }
    const numbers = parts.map(Number);
    if (numbers.some((number) => !Number.isFinite(number) || number < 0)) {
      return { error: 'L-T-P must contain valid non-negative numbers.' };
    }
    return {
      l: numbers[0] ?? 0,
      t: numbers[1] ?? 0,
      p: numbers[2] ?? 0,
      provided: true,
    };
  }

  const separate = [raw.l, raw.t, raw.p];
  const provided = separate.some((value) => hasValue(value));
  if (!provided) return { l: null, t: null, p: null, provided: false };

  const numbers = separate.map((value) => {
    if (!hasValue(value)) return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : NaN;
  });
  if (numbers.some((number) => !Number.isFinite(number))) {
    return { error: 'L, T and P must contain valid non-negative numbers.' };
  }
  return { l: numbers[0], t: numbers[1], p: numbers[2], provided: true };
};

const parseNumericField = (value, label) => {
  if (!hasValue(value)) return { value: null };
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return { error: `${label} must be a valid number.` };
  }
  if (parsed < 0) {
    return { error: `${label} cannot be negative.` };
  }
  return { value: parsed };
};

const defaultMarksForType = (type) => (type === 'lab'
  ? { theoryEndMax: 0, cwMax: 0, practicalEndMax: 60, swMax: 40 }
  : { theoryEndMax: 70, cwMax: 30, practicalEndMax: 0, swMax: 0 });

const defaultLtpForType = (type) => (type === 'lab'
  ? { l: 0, t: 0, p: 2 }
  : { l: 3, t: 0, p: 0 });

const defaultCreditsForType = (type) => (type === 'lab' ? 1 : 3);

const splitFacultyTokens = (value) => String(value ?? '')
  .split(/[,;\n]+/)
  .map((token) => normalizeText(token))
  .filter(Boolean);

const buildFacultyIndex = (faculties) => {
  const byName = new Map();
  const byEmail = new Map();

  (faculties || []).forEach((faculty) => {
    if (faculty.userId && faculty.userId.role && faculty.userId.role !== 'faculty') return;
    const name = normalizeKey(`${faculty.firstName || ''} ${faculty.lastName || ''}`);
    if (name) {
      const list = byName.get(name) || [];
      list.push(faculty);
      byName.set(name, list);
    }
    const email = normalizeKey(faculty.userId?.email || faculty.personalEmail || '');
    if (email) {
      const list = byEmail.get(email) || [];
      list.push(faculty);
      byEmail.set(email, list);
    }
  });

  return { byName, byEmail };
};

const resolveFacultyTokens = (rawValue, facultyIndex) => {
  const errors = [];
  const warnings = [];
  const facultyIds = [];

  splitFacultyTokens(rawValue).forEach((token) => {
    const email = token.includes('@') ? normalizeKey(token) : '';
    const candidates = email
      ? (facultyIndex.byEmail.get(email) || [])
      : (facultyIndex.byName.get(normalizeKey(token)) || []);
    const uniqueCandidates = [...new Map(candidates.map((item) => [String(item._id), item])).values()];

    if (uniqueCandidates.length === 0) {
      errors.push(`Faculty not found: ${token}`);
      return;
    }
    if (uniqueCandidates.length > 1) {
      warnings.push(`Ambiguous faculty name: ${token}`);
      return;
    }
    facultyIds.push(String(uniqueCandidates[0]._id));
  });

  return {
    facultyIds: unique(facultyIds),
    errors,
    warnings,
  };
};

const rowKey = (semester, code) => `${Number(semester)}:${String(code || '').toUpperCase()}`;

const normalizeIncomingRow = (input, index) => {
  const values = input && input.values ? input.values : (input || {});
  const ltp = values.ltp !== undefined
    ? values.ltp
    : (values.l !== undefined || values.t !== undefined || values.p !== undefined
      ? `${values.l ?? ''}-${values.t ?? ''}-${values.p ?? ''}`
      : '');
  return {
    rowNumber: Number(input?.rowNumber) || index + 2,
    raw: values,
    code: values.code,
    name: values.name,
    type: values.type,
    ltp,
    l: values.l,
    t: values.t,
    p: values.p,
    credits: values.credits,
    theoryEnd: values.theoryEnd !== undefined ? values.theoryEnd : values.theoryEndMax,
    cw: values.cw !== undefined ? values.cw : values.cwMax,
    practicalEnd: values.practicalEnd !== undefined ? values.practicalEnd : values.practicalEndMax,
    sw: values.sw !== undefined ? values.sw : values.swMax,
    total: values.total,
    faculty: values.faculty,
    semester: values.semester,
    year: values.year,
    syllabus: values.syllabus !== undefined ? values.syllabus : values.syllabusText,
  };
};

const buildExistingMap = (subjects, labs) => {
  const map = new Map();
  (subjects || []).forEach((subject) => {
    map.set(rowKey(subject.semester, subject.code), {
      id: subject._id,
      kind: 'subject',
      code: subject.code,
      name: subject.name,
    });
  });
  (labs || []).forEach((lab) => {
    map.set(rowKey(lab.semester, lab.code), {
      id: lab._id,
      kind: 'lab',
      code: lab.code,
      name: lab.name,
    });
  });
  return map;
};

const validateImportRows = (incomingRows, context) => {
  const {
    session,
    branch,
    selectedSemester,
    selectedYear,
    updateMode,
    facultyIndex,
    existingMap,
  } = context;
  const seenCodes = new Map();

  const rows = incomingRows.map((input, index) => {
    const raw = normalizeIncomingRow(input, index);
    const errors = [];
    const warnings = [];
    let action = 'create';
    let existing = null;
    let duplicate = false;

    const code = String(raw.code || '').trim().toUpperCase();
    const name = normalizeText(raw.name);
    if (!code) errors.push('Code is required.');
    if (!name) errors.push('Subject name is required.');

    const parsedType = parseTypeValue(raw.type);
    const ltpResult = parseLtpValue(raw);
    if (ltpResult.error) errors.push(ltpResult.error);

    let type = null;
    if (parsedType === 'invalid') {
      errors.push('Type must be Subject or Lab.');
    } else if (parsedType) {
      type = parsedType;
    } else if (ltpResult.l === 0 && ltpResult.t === 0 && ltpResult.p > 0) {
      type = 'lab';
      warnings.push('Type is empty. The L-T-P value suggests a Lab, so the row is treated as a Lab.');
    } else {
      errors.push('Type is required. Enter Subject or Lab.');
    }

    const effectiveType = type || 'subject';
    const ltpDefaults = defaultLtpForType(effectiveType);
    const l = ltpResult.l ?? ltpDefaults.l;
    const t = ltpResult.t ?? ltpDefaults.t;
    const p = ltpResult.p ?? ltpDefaults.p;

    const creditsResult = parseNumericField(raw.credits, 'Credits');
    if (creditsResult.error) errors.push(creditsResult.error);
    const credits = creditsResult.value ?? defaultCreditsForType(effectiveType);

    const marksDefaults = defaultMarksForType(effectiveType);
    const theoryEndResult = parseNumericField(raw.theoryEnd, 'Theory End');
    const cwResult = parseNumericField(raw.cw, 'CW');
    const practicalEndResult = parseNumericField(raw.practicalEnd, 'Practical End');
    const swResult = parseNumericField(raw.sw, 'SW');
    [theoryEndResult, cwResult, practicalEndResult, swResult]
      .filter((result) => result.error)
      .forEach((result) => errors.push(result.error));

    const theoryEnd = theoryEndResult.value ?? marksDefaults.theoryEndMax;
    const cw = cwResult.value ?? marksDefaults.cwMax;
    const practicalEnd = practicalEndResult.value ?? marksDefaults.practicalEndMax;
    const sw = swResult.value ?? marksDefaults.swMax;
    const expectedTotal = theoryEnd + cw + practicalEnd + sw;

    const totalResult = parseNumericField(raw.total, 'Total');
    if (totalResult.error) errors.push(totalResult.error);
    if (totalResult.value !== null && totalResult.value !== expectedTotal) {
      warnings.push(`Total marks (${totalResult.value}) do not match the sum of Theory End, CW, Practical End and SW (${expectedTotal}).`);
    }

    let semester = parseSemesterValue(raw.semester);
    const semesterProvided = hasValue(raw.semester);
    if (semesterProvided && semester === null) {
      errors.push('Semester must be a valid semester (1-8).');
    }

    let year = parseYearValue(raw.year);
    const yearProvided = hasValue(raw.year);
    if (yearProvided && year === null) {
      errors.push('Year must be a valid year (1-4).');
    }

    if (semester === null && !semesterProvided) semester = selectedSemester;
    if (year === null && !yearProvided) {
      year = semesterProvided && semester !== null ? Math.ceil(semester / 2) : selectedYear;
    }
    if (semester === null && year !== null) {
      const yearSemesters = academicConfig.SEMESTERS_BY_YEAR?.[String(Number(year))] || [];
      semester = yearSemesters.includes(selectedSemester) ? selectedSemester : (yearSemesters[0] ?? null);
    }

    if (semester !== null && year !== null && !semesterBelongsToYear(semester, year)) {
      errors.push(`Semester ${semester} does not belong to Year ${year}.`);
    }
    if (semester !== null && !semesterBelongsToYear(semester, Math.ceil(semester / 2))) {
      errors.push('Semester must be between 1 and 8.');
    }

    const facultyResult = resolveFacultyTokens(raw.faculty, facultyIndex);
    errors.push(...facultyResult.errors);
    warnings.push(...facultyResult.warnings);

    const key = rowKey(semester, code);
    if (code && semester !== null) {
      const entries = seenCodes.get(key) || [];
      entries.push({ index, code });
      seenCodes.set(key, entries);
    }

    existing = code && semester !== null ? existingMap.get(key) : null;
    if (existing) {
      if (existing.kind !== effectiveType) {
        errors.push(`Code ${code} already exists as a ${existing.kind === 'lab' ? 'Lab' : 'Subject'} in this academic year, department and semester.`);
      } else if (updateMode === 'update') {
        action = 'update';
        warnings.push(`Existing ${existing.kind === 'lab' ? 'lab' : 'subject'} with this code will be updated. Its internal ID will be preserved.`);
      } else {
        action = 'skip';
        warnings.push('An existing record with this code will be skipped.');
      }
    }

    return {
      rowNumber: raw.rowNumber,
      status: 'valid',
      action,
      duplicate,
      errors: unique(errors),
      warnings: unique(warnings),
      existingId: existing ? String(existing.id) : null,
      existingKind: existing ? existing.kind : null,
      values: {
        code,
        name,
        type: effectiveType,
        l,
        t,
        p,
        ltp: `${l}-${t}-${p}`,
        credits,
        theoryEnd,
        cw,
        practicalEnd,
        sw,
        total: totalResult.value ?? expectedTotal,
        expectedTotal,
        faculty: normalizeText(raw.faculty),
        facultyIds: facultyResult.facultyIds,
        semester,
        year,
        syllabus: String(raw.syllabus ?? '').trim(),
        session,
        branch,
      },
    };
  });

  seenCodes.forEach((entries, key) => {
    if (entries.length < 2) return;
    const code = key.split(':').slice(1).join(':');
    entries.forEach(({ index }) => {
      rows[index].duplicate = true;
      rows[index].errors.push(`Duplicate code in file: ${code} appears ${entries.length} times.`);
      rows[index].action = 'error';
    });
  });

  rows.forEach((row) => {
    row.errors = unique(row.errors);
    row.warnings = unique(row.warnings);
    if (row.errors.length) {
      row.status = 'error';
      row.action = 'error';
    } else if (row.warnings.length) {
      row.status = 'warning';
    } else {
      row.status = 'valid';
    }
  });

  return rows;
};

const summarizeRows = (rows) => {
  const valid = rows.filter((row) => row.status !== 'error').length;
  const warnings = rows.filter((row) => row.status === 'warning').length;
  const errors = rows.filter((row) => row.status === 'error').length;
  const duplicates = rows.filter((row) => row.duplicate).length;
  const create = rows.filter((row) => row.status !== 'error' && row.action === 'create').length;
  const update = rows.filter((row) => row.status !== 'error' && row.action === 'update').length;
  const skip = rows.filter((row) => row.status !== 'error' && row.action === 'skip').length;
  return {
    total: rows.length,
    valid,
    warnings,
    errors,
    duplicates,
    create,
    update,
    skip,
  };
};

const loadImportContext = async (selection, updateMode, mongoSession) => {
  const { session, branch, selectedSemester, selectedYear } = selection;
  const aliases = departmentValues(branch);
  const facultyQuery = Faculty.find({ department: { $in: aliases.length ? aliases : [branch] } })
    .populate('userId', 'email role')
    .lean();
  const subjectQuery = Subject.find({ session, branch })
    .select('_id code name semester credits')
    .lean();
  const labQuery = Lab.find({ session, branch })
    .select('_id code name semester credits')
    .lean();

  if (mongoSession) {
    facultyQuery.session(mongoSession);
    subjectQuery.session(mongoSession);
    labQuery.session(mongoSession);
  }

  const [faculties, subjects, labs] = await Promise.all([facultyQuery, subjectQuery, labQuery]);
  const departmentFaculty = (faculties || []).filter(
    (faculty) => !faculty.department || departmentMatches(faculty.department, branch),
  );

  return {
    session,
    branch,
    selectedSemester,
    selectedYear,
    updateMode,
    facultyIndex: buildFacultyIndex(departmentFaculty),
    existingMap: buildExistingMap(subjects, labs),
  };
};

const matrixToRows = (matrix) => {
  if (!Array.isArray(matrix) || !matrix.length) {
    throw createImportError(400, 'The uploaded file does not contain any data rows.');
  }

  let headerIndex = -1;
  let headerMap = null;
  const searchLimit = Math.min(matrix.length, 10);
  for (let index = 0; index < searchLimit; index += 1) {
    const candidate = matrix[index] || [];
    const mapped = {};
    candidate.forEach((cell, columnIndex) => {
      const field = HEADER_FIELD_BY_TOKEN.get(normalizeHeaderToken(cell));
      if (field && mapped[field] === undefined) mapped[field] = columnIndex;
    });
    if (mapped.code !== undefined && mapped.name !== undefined) {
      headerIndex = index;
      headerMap = mapped;
      break;
    }
  }

  if (headerIndex < 0) {
    throw createImportError(
      400,
      'Could not find a valid header row. Please use the template and keep columns such as Code and Subject Name.',
    );
  }

  const rows = [];
  for (let index = headerIndex + 1; index < matrix.length; index += 1) {
    const source = matrix[index] || [];
    const get = (field) => (headerMap[field] === undefined ? '' : source[headerMap[field]]);
    const row = {
      rowNumber: index + 1,
      code: get('code'),
      name: get('name'),
      type: get('type'),
      ltp: get('ltp'),
      l: get('l'),
      t: get('t'),
      p: get('p'),
      credits: get('credits'),
      theoryEnd: get('theoryEnd'),
      cw: get('cw'),
      practicalEnd: get('practicalEnd'),
      sw: get('sw'),
      total: get('total'),
      faculty: get('faculty'),
      semester: get('semester'),
      year: get('year'),
      syllabus: get('syllabus'),
    };
    const hasAnyValue = Object.entries(row)
      .filter(([key]) => key !== 'rowNumber')
      .some(([, value]) => hasValue(value));
    if (hasAnyValue) rows.push(row);
  }

  if (!rows.length) {
    throw createImportError(400, 'The uploaded file does not contain any data rows.');
  }
  return rows;
};

const parseWorkbookRows = (buffer) => {
  let workbook;
  try {
    workbook = xlsx.read(buffer, {
      type: 'buffer',
      cellFormula: false,
      cellHTML: false,
      cellNF: false,
      cellStyles: false,
      sheetStubs: false,
    });
  } catch {
    throw createImportError(400, 'The uploaded file could not be read. Please upload a valid Excel or CSV file.');
  }
  const sheetNames = workbook.SheetNames || [];
  if (!sheetNames.length) {
    throw createImportError(400, 'The uploaded workbook does not contain a worksheet.');
  }

  let lastError = null;
  for (const sheetName of sheetNames) {
    const matrix = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      defval: '',
      raw: true,
      blankrows: false,
    });
    try {
      return matrixToRows(matrix);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || createImportError(400, 'The uploaded workbook does not contain any data rows.');
};

const splitPdfTableLine = (line) => {
  if (line.includes('\t')) {
    return line.split('\t').map((cell) => normalizeText(cell));
  }
  if (line.includes('|')) {
    return line.split('|').map((cell) => normalizeText(cell)).filter((cell, index, arr) => !(cell === '' && (index === 0 || index === arr.length - 1)));
  }
  return line.split(/\s{2,}/).map((cell) => normalizeText(cell));
};

const extractPdfLines = async (buffer) => {
  let pdfjs;
  try {
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  } catch {
    throw createImportError(400, 'PDF parsing is currently unavailable. Please upload an Excel file.');
  }

  let document;
  try {
    document = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
      disableFontFace: true,
      useSystemFonts: true,
    }).promise;
  } catch {
    throw createImportError(400, 'The PDF could not be read. Please upload a text-based PDF or an Excel file.');
  }

  try {
    const lines = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const items = (content.items || [])
        .filter((item) => normalizeText(item.str))
        .map((item) => ({
          text: item.str,
          x: Number(item.transform?.[4] || 0),
          y: Number(item.transform?.[5] || 0),
        }))
        .sort((left, right) => (right.y - left.y) || (left.x - right.x));

      const groupedLines = [];
      items.forEach((item) => {
        const current = groupedLines[groupedLines.length - 1];
        if (!current || Math.abs(current.y - item.y) > 2) {
          groupedLines.push({ y: item.y, items: [item] });
        } else {
          current.items.push(item);
        }
      });

      groupedLines.forEach((group) => {
        const ordered = group.items.sort((left, right) => left.x - right.x);
        let line = '';
        let previousEnd = null;
        ordered.forEach((item) => {
          const gap = previousEnd === null ? null : item.x - previousEnd;
          const separator = gap !== null && gap > 12 ? '\t' : ' ';
          line += `${line ? separator : ''}${item.text}`;
          previousEnd = item.x + Math.max(1, String(item.text).length * 4);
        });
        const cleaned = normalizeText(line);
        if (cleaned) lines.push(cleaned);
      });
    }

    const extractedCharacters = lines.join('').replace(/\s/g, '').length;
    if (!lines.length || extractedCharacters < 20) {
      throw createImportError(
        400,
        'This PDF appears to be scanned. Please upload an Excel file.',
        'SCANNED_PDF',
      );
    }
    return lines;
  } finally {
    if (document && typeof document.destroy === 'function') {
      await document.destroy();
    }
  }
};

const pdfLinesToRows = (lines) => {
  let headerIndex = -1;
  let headerMap = null;

  for (let index = 0; index < Math.min(lines.length, 8); index += 1) {
    const cells = splitPdfTableLine(lines[index]);
    const mapped = {};
    cells.forEach((cell, columnIndex) => {
      const field = HEADER_FIELD_BY_TOKEN.get(normalizeHeaderToken(cell));
      if (field && mapped[field] === undefined) mapped[field] = columnIndex;
    });
    if (mapped.code !== undefined && mapped.name !== undefined) {
      headerIndex = index;
      headerMap = mapped;
      break;
    }
  }

  if (headerIndex < 0) {
    throw createImportError(
      400,
      'The PDF table header could not be detected. Please upload an Excel file or correct the PDF.',
    );
  }

  const rows = [];
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const cells = splitPdfTableLine(lines[index]);
    if (!cells.length) continue;
    const get = (field) => (headerMap[field] === undefined ? '' : (cells[headerMap[field]] ?? ''));
    const row = {
      rowNumber: index + 1,
      code: get('code'),
      name: get('name'),
      type: get('type'),
      ltp: get('ltp'),
      l: get('l'),
      t: get('t'),
      p: get('p'),
      credits: get('credits'),
      theoryEnd: get('theoryEnd'),
      cw: get('cw'),
      practicalEnd: get('practicalEnd'),
      sw: get('sw'),
      total: get('total'),
      faculty: get('faculty'),
      semester: get('semester'),
      year: get('year'),
      syllabus: get('syllabus'),
    };
    const hasAnyValue = Object.entries(row)
      .filter(([key]) => key !== 'rowNumber')
      .some(([, value]) => hasValue(value));
    if (hasAnyValue) rows.push(row);
  }

  if (!rows.length) {
    throw createImportError(
      400,
      'No table rows could be read from this PDF. Please upload an Excel file or correct the PDF.',
    );
  }
  return rows;
};

const parseImportFile = async ({ buffer, originalname, size }) => {
  const extension = validateImportFileMeta({ buffer, originalname, size });
  if (extension === '.pdf') {
    const lines = await extractPdfLines(buffer);
    return { fileType: 'pdf', rows: pdfLinesToRows(lines) };
  }
  const fileType = extension === '.csv' ? 'csv' : 'excel';
  return { fileType, rows: parseWorkbookRows(buffer) };
};

const preparePreview = async ({
  buffer,
  originalname,
  size,
  session,
  branch,
  year,
  semester,
  updateMode,
}) => {
  const selection = parseImportSelection({ session, branch, year, semester });
  const normalizedMode = normalizeUpdateMode(updateMode);
  const parsed = await parseImportFile({ buffer, originalname, size });
  if (parsed.rows.length > MAX_IMPORT_ROWS) {
    throw createImportError(400, `A maximum of ${MAX_IMPORT_ROWS} rows can be imported at a time.`);
  }

  const context = await loadImportContext(selection, normalizedMode);
  const rows = validateImportRows(parsed.rows, context);

  return {
    ...selection,
    updateMode: normalizedMode,
    fileType: parsed.fileType,
    maxRows: MAX_IMPORT_ROWS,
    maxFileSize: MAX_IMPORT_FILE_SIZE,
    summary: summarizeRows(rows),
    rows,
  };
};

const buildImportPayload = (values, selection) => ({
  code: values.code,
  name: values.name,
  type: values.type === 'lab' ? 'lab' : 'theory',
  branch: selection.branch,
  semester: values.semester,
  session: selection.session,
  l: values.l,
  t: values.t,
  p: values.p,
  credits: values.credits,
  theoryEndMax: values.theoryEnd,
  cwMax: values.cw,
  practicalEndMax: values.practicalEnd,
  swMax: values.sw,
  ...(values.syllabus ? { syllabusText: values.syllabus } : {}),
  facultyIds: values.facultyIds || [],
});

const buildUpdatePayload = (values) => ({
  name: values.name,
  type: values.type === 'lab' ? 'lab' : 'theory',
  l: values.l,
  t: values.t,
  p: values.p,
  credits: values.credits,
  theoryEndMax: values.theoryEnd,
  cwMax: values.cw,
  practicalEndMax: values.practicalEnd,
  swMax: values.sw,
  ...(values.syllabus ? { syllabusText: values.syllabus } : {}),
  facultyIds: values.facultyIds || [],
});

const isTransactionUnsupportedError = (error) => {
  if (!error) return false;
  if ([20, 251].includes(Number(error.code))) return true;
  return /transaction numbers are only allowed|transactions are not supported|replica set|mongos/i
    .test(String(error.message || ''));
};

const executeConfirm = async (rowsInput, selection, updateMode, mongoSession) => {
  const context = await loadImportContext(selection, updateMode, mongoSession);
  const rows = validateImportRows(rowsInput, context);
  const results = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    if (row.status === 'error') {
      skipped += 1;
      results.push({
        rowNumber: row.rowNumber,
        code: row.values.code,
        action: 'skipped',
        reason: row.errors.join(' '),
      });
      continue;
    }
    if (row.action === 'skip') {
      skipped += 1;
      results.push({
        rowNumber: row.rowNumber,
        code: row.values.code,
        action: 'skipped',
        reason: 'An existing record with this code was skipped.',
      });
      continue;
    }

    try {
      if (row.action === 'update') {
        if (!row.existingId) {
          skipped += 1;
          results.push({
            rowNumber: row.rowNumber,
            code: row.values.code,
            action: 'skipped',
            reason: 'The existing record could not be found during import.',
          });
          continue;
        }
        const payload = buildUpdatePayload(row.values);
        if (row.existingKind === 'lab') {
          await updateLabRecord(row.existingId, payload, { mongoSession });
        } else {
          await updateSubjectRecord(row.existingId, payload, { mongoSession });
        }
        updated += 1;
        results.push({
          rowNumber: row.rowNumber,
          code: row.values.code,
          action: 'updated',
          reason: null,
        });
      } else {
        const payload = buildImportPayload(row.values, selection);
        if (row.values.type === 'lab') {
          await createLabRecord(payload, { mongoSession, academicSession: selection.session });
        } else {
          await createSubjectRecord(payload, { mongoSession, academicSession: selection.session });
        }
        created += 1;
        results.push({
          rowNumber: row.rowNumber,
          code: row.values.code,
          action: 'created',
          reason: null,
        });
      }
    } catch (error) {
      skipped += 1;
      results.push({
        rowNumber: row.rowNumber,
        code: row.values.code,
        action: 'skipped',
        reason: error.message || 'The row could not be imported.',
      });
    }
  }

  return {
    summary: {
      total: rows.length,
      created,
      updated,
      skipped,
      errors: rows.filter((row) => row.status === 'error').length,
    },
    results,
  };
};

const confirmSubjectImport = async ({ session, branch, year, semester, updateMode, rows }) => {
  const selection = parseImportSelection({ session, branch, year, semester });
  const normalizedMode = normalizeUpdateMode(updateMode);
  const inputRows = Array.isArray(rows) ? rows : [];
  if (!inputRows.length) {
    throw createImportError(400, 'No rows were provided for import.');
  }
  if (inputRows.length > MAX_IMPORT_ROWS) {
    throw createImportError(400, `A maximum of ${MAX_IMPORT_ROWS} rows can be imported at a time.`);
  }

  let mongoSession;
  try {
    mongoSession = await mongoose.startSession();
    mongoSession.startTransaction();
    const result = await executeConfirm(inputRows, selection, normalizedMode, mongoSession);
    await mongoSession.commitTransaction();
    return result;
  } catch (error) {
    if (mongoSession && mongoSession.inTransaction()) {
      await mongoSession.abortTransaction();
    }
    if (isTransactionUnsupportedError(error)) {
      return executeConfirm(inputRows, selection, normalizedMode, null);
    }
    throw error;
  } finally {
    if (mongoSession) mongoSession.endSession();
  }
};

const createSubjectImportTemplateWorkbook = () => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'College ERP';
  workbook.created = new Date();

  const instructions = workbook.addWorksheet('Instructions');
  instructions.columns = [{ width: 110 }];
  const instructionLines = [
    'Subject and Lab Import - Instructions',
    '',
    '1. Enter data on the "Import Template" sheet. Do not rename or remove the header row.',
    '2. Required columns: Code, Subject Name, Type, Credits and Total marks fields as applicable.',
    '3. Type must be either Subject or Lab. If Type is empty and L-T-P shows 0-0-P, the row is treated as a Lab with a warning.',
    '4. L-T-P must use the format L-T-P, for example 3-1-0.',
    '5. Total marks are calculated as Theory End + CW + Practical End + SW. A mismatch is reported as a warning.',
    '6. Faculty must already exist in the selected department. Enter names or email addresses separated by commas.',
    '7. Semester and Year are optional. If provided, they override the selections made on the import screen.',
    '8. Semester must belong to the selected Year (Year 1: semesters 1-2, Year 2: 3-4, Year 3: 5-6, Year 4: 7-8).',
    '9. A maximum of 500 rows can be imported at a time. The maximum file size is 5 MB.',
    '10. Accepted file types: .xlsx, .xls, .csv and .pdf (text-based only).',
    '11. Existing codes are skipped by default. Select "Update existing" to update them instead.',
    '12. Nothing is saved until you review the preview and select "Confirm Import".',
    '',
    'Example row:',
    'IT301 | Database Management Systems | Subject | 3-1-0 | 4 | 70 | 30 | 0 | 0 | 100 | Dr. Anita Sharma, anita.sharma@college.edu | | | Unit 1: Introduction',
  ];
  instructionLines.forEach((line) => instructions.addRow([line]));
  instructions.getRow(1).font = { bold: true, size: 14, color: { argb: 'FF1E3A8A' } };
  instructions.eachRow((row) => {
    row.alignment = { vertical: 'top', wrapText: true };
  });

  const sheet = workbook.addWorksheet('Import Template');
  sheet.columns = TEMPLATE_COLUMNS;
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
  sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: 'A1', to: 'N1' };
  sheet.getRow(1).height = 32;

  return workbook;
};

module.exports = {
  MAX_IMPORT_ROWS,
  MAX_IMPORT_FILE_SIZE,
  ALLOWED_EXTENSIONS,
  TEMPLATE_COLUMNS,
  parseImportFile,
  parseImportSelection,
  validateImportRows,
  summarizeRows,
  preparePreview,
  confirmSubjectImport,
  createSubjectImportTemplateWorkbook,
};
