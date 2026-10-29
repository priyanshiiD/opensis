const xlsx = require('xlsx');
const ExcelJS = require('exceljs');
const Subject = require('../models/Subject');
const Lab = require('../models/Lab');
const {
  createSubjectRecord,
  updateSubjectRecord,
  createLabRecord,
  updateLabRecord,
  isValidSchemeBranch,
  normalizeAcademicCode,
} = require('./academicSchemeService');
const { normalizeSession } = require('../utils/academicSession');
const { departmentMatches, departmentLabel } = require('../utils/departments');

const CANONICAL_HEADERS = [
  'course_code',
  'course_nomenclature',
  'INT',
  'EXT',
  'TOTAL',
  'CREDITS',
  'Name of program and branch(SGSITS)',
];

const normalizeHeaderKey = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[\s_\-]+/g, '');

const inferType = (code, name) => {
  const normalizedCode = String(code || '').trim().toUpperCase();
  const normalizedName = String(name || '').trim().toLowerCase();

  const codeEndsWithP = normalizedCode.endsWith('P');
  const codeEndsWithT = normalizedCode.endsWith('T');
  const nameHasLab = /\b(lab|laboratory|practical)\b/i.test(normalizedName);
  const nameHasTheory = /\b(theory)\b/i.test(normalizedName);

  if (nameHasLab && (codeEndsWithP || !codeEndsWithT)) {
    return { type: 'lab', warning: null };
  }
  if (!nameHasLab && (codeEndsWithT || nameHasTheory)) {
    return { type: 'theory', warning: null };
  }
  if (nameHasLab && codeEndsWithT) {
    return {
      type: 'lab',
      warning: 'Type conflict: Nomenclature mentions Lab but course code ends with T. Inferred as Lab.',
    };
  }
  if (!nameHasLab && codeEndsWithP) {
    return {
      type: 'lab',
      warning: 'Type conflict: Course code ends with P but nomenclature does not mention Lab. Inferred as Lab.',
    };
  }

  // Clear default case without doubt
  return { type: 'theory', warning: null };
};

const defaultLtpForType = (type, credits) => {
  const cr = Number(credits) || 0;
  if (type === 'lab') {
    return { l: 0, t: 0, p: cr * 2 };
  }
  return { l: cr, t: 0, p: 0 };
};

const parseImportBuffer = (buffer) => {
  const workbook = xlsx.read(buffer, { type: 'buffer', raw: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Uploaded file contains no worksheets');

  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: '',
    blankrows: false,
  });

  if (!rows || rows.length === 0) {
    throw new Error('Uploaded file is empty');
  }

  // Find header row by searching top 15 rows for "code" and "nomenclature" / "name"
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const rowStr = rows[i].map(c => normalizeHeaderKey(c)).join('|');
    if ((rowStr.includes('coursecode') || rowStr.includes('code')) &&
        (rowStr.includes('nomenclature') || rowStr.includes('coursenomenclature') || rowStr.includes('name'))) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    throw new Error(
      'Invalid file headers. Expected columns: course_code, course_nomenclature, INT, EXT, TOTAL, CREDITS, Name of program and branch(SGSITS)'
    );
  }

  const headerRow = rows[headerIdx];
  const nextRow = rows[headerIdx + 1] || [];
  const nextRowHasSubHeaders = nextRow.some(cell => {
    const s = String(cell || '').toLowerCase();
    return s.includes('max') || s.includes('min');
  });

  const subHeaderRow = nextRowHasSubHeaders ? nextRow : null;
  const dataStartIdx = nextRowHasSubHeaders ? headerIdx + 2 : headerIdx + 1;

  // Map column indices
  let codeCol = -1;
  let nameCol = -1;
  let intCol = -1;
  let extCol = -1;
  let totalCol = -1;
  let creditsCol = -1;
  let programCol = -1;

  for (let c = 0; c < headerRow.length; c++) {
    const h = normalizeHeaderKey(headerRow[c]);
    const sub = subHeaderRow ? String(subHeaderRow[c] || '').toLowerCase() : '';

    if (codeCol === -1 && (h === 'coursecode' || h === 'code')) codeCol = c;
    else if (nameCol === -1 && (h === 'coursenomenclature' || h === 'nomenclature' || h === 'subjectname' || h === 'name')) nameCol = c;
    else if (creditsCol === -1 && (h === 'credits' || h === 'credit' || h === 'cr')) creditsCol = c;
    else if (programCol === -1 && (h.includes('program') || h.includes('branch'))) programCol = c;
    else if (h.includes('int') && !h.includes('point')) {
      // Pick MAX marks column, ignore MIN marks
      if (!sub.includes('min') && intCol === -1) intCol = c;
    } else if (h.includes('ext')) {
      if (!sub.includes('min') && extCol === -1) extCol = c;
    } else if (h.includes('total')) {
      if (!sub.includes('min') && totalCol === -1) totalCol = c;
    }
  }

  // Fallback: If subHeaderRow had INT/EXT/TOTAL above merged columns, search adjacent subheader columns
  if (intCol !== -1 && subHeaderRow && subHeaderRow[intCol].toLowerCase().includes('min')) {
    if (intCol > 0 && subHeaderRow[intCol - 1].toLowerCase().includes('max')) intCol = intCol - 1;
    else if (intCol + 1 < subHeaderRow.length && subHeaderRow[intCol + 1].toLowerCase().includes('max')) intCol = intCol + 1;
  }
  if (extCol !== -1 && subHeaderRow && subHeaderRow[extCol].toLowerCase().includes('min')) {
    if (extCol > 0 && subHeaderRow[extCol - 1].toLowerCase().includes('max')) extCol = extCol - 1;
    else if (extCol + 1 < subHeaderRow.length && subHeaderRow[extCol + 1].toLowerCase().includes('max')) extCol = extCol + 1;
  }
  if (totalCol !== -1 && subHeaderRow && subHeaderRow[totalCol].toLowerCase().includes('min')) {
    if (totalCol > 0 && subHeaderRow[totalCol - 1].toLowerCase().includes('max')) totalCol = totalCol - 1;
    else if (totalCol + 1 < subHeaderRow.length && subHeaderRow[totalCol + 1].toLowerCase().includes('max')) totalCol = totalCol + 1;
  }

  if (codeCol === -1 || nameCol === -1) {
    throw new Error('Required columns "course_code" and "course_nomenclature" were not found in the file.');
  }

  const parsedRows = [];
  for (let r = dataStartIdx; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.length) continue;

    const rawCode = String(row[codeCol] !== undefined ? row[codeCol] : '').trim();
    // Silent skip for heading rows, empty code cells, or repeated subheaders
    if (!rawCode) continue;
    if (['COURSE CODE', 'CODE', 'MAX MARKS', 'MIN MARKS', 'SL NO', 'S.NO.'].includes(rawCode.toUpperCase())) continue;

    const rawName = String(row[nameCol] !== undefined ? row[nameCol] : '').trim();
    const rawProgram = programCol !== -1 ? String(row[programCol] !== undefined ? row[programCol] : '').trim() : '';

    const parseNum = (val) => {
      if (val === undefined || val === null || val === '') return 0;
      const num = Number(String(val).replace(/[^0-9.]/g, ''));
      return Number.isFinite(num) ? num : 0;
    };

    const intVal = intCol !== -1 ? parseNum(row[intCol]) : 0;
    const extVal = extCol !== -1 ? parseNum(row[extCol]) : 0;
    const totalVal = totalCol !== -1 ? parseNum(row[totalCol]) : (intVal + extVal);
    const creditsVal = creditsCol !== -1 ? parseNum(row[creditsCol]) : 0;

    parsedRows.push({
      originalRowIndex: r + 1,
      code: rawCode.toUpperCase(),
      name: rawName,
      int: intVal,
      ext: extVal,
      total: totalVal,
      credits: creditsVal,
      programAndBranch: rawProgram,
    });
  }

  return parsedRows;
};

const previewImport = async ({ buffer, originalname, session, branch, semester, updateMode }) => {
  const normSession = normalizeSession(session);
  if (!normSession) throw new Error('Academic session is required');
  const normBranch = String(branch || '').trim().toUpperCase();
  if (!isValidSchemeBranch(normBranch)) throw new Error('Select a valid department');
  const semNum = Number(semester);
  if (!Number.isInteger(semNum) || semNum < 1 || semNum > 8) throw new Error('Select a valid semester (1-8)');

  const parsedList = parseImportBuffer(buffer);
  if (parsedList.length === 0) {
    throw new Error('No valid subject rows found in the uploaded file');
  }
  if (parsedList.length > 500) {
    throw new Error('Import exceeds maximum row limit of 500 rows per file');
  }

  // Fetch existing subjects and labs in this session + branch + semester
  const [existingSubjects, existingLabs] = await Promise.all([
    Subject.find({ session: normSession, branch: normBranch, semester: semNum }).select('_id code name').lean(),
    Lab.find({ session: normSession, branch: normBranch, semester: semNum }).select('_id code name').lean(),
  ]);

  const existingMap = new Map();
  existingSubjects.forEach(s => existingMap.set(String(s.code).toUpperCase(), { _id: s._id, kind: 'subject', name: s.name }));
  existingLabs.forEach(l => existingMap.set(String(l.code).toUpperCase(), { _id: l._id, kind: 'lab', name: l.name }));

  const seenInFile = new Set();
  const previewRows = [];

  for (let idx = 0; idx < parsedList.length; idx++) {
    const item = parsedList[idx];
    const warnings = [];
    const errors = [];

    // Validation 1: Course code format
    const code = normalizeAcademicCode(item.code);
    if (!code) {
      errors.push('Course code is required');
    } else if (seenInFile.has(code)) {
      errors.push(`Duplicate course code "${code}" found in import file`);
    } else {
      seenInFile.add(code);
    }

    // Validation 2: Course nomenclature
    const name = String(item.name || '').trim();
    if (!name) {
      errors.push('Course nomenclature is required');
    }

    // Validation 3: Non-negative marks & credits
    if (item.int < 0) errors.push('INT marks cannot be negative');
    if (item.ext < 0) errors.push('EXT marks cannot be negative');
    if (item.total < 0) errors.push('TOTAL marks cannot be negative');
    if (item.credits < 0) errors.push('Credits cannot be negative');

    // Warning: Marks total check
    const calculatedTotal = item.int + item.ext;
    if (item.total !== calculatedTotal) {
      warnings.push(`TOTAL marks (${item.total}) differs from INT + EXT (${calculatedTotal})`);
    }

    // Type detection & LTP
    const typeInference = inferType(code, name);
    if (typeInference.warning) {
      warnings.push(typeInference.warning);
    }
    const defaultLtp = defaultLtpForType(typeInference.type, item.credits);

    // Program and Branch verification
    if (item.programAndBranch && !departmentMatches(item.programAndBranch, normBranch)) {
      warnings.push(
        `Program "${item.programAndBranch}" does not match selected department "${normBranch}". Record will be assigned to "${normBranch}".`
      );
    }

    // Existing record detection
    let action = 'create';
    let existingRecord = null;
    if (existingMap.has(code)) {
      existingRecord = existingMap.get(code);
      if (updateMode === 'update') {
        action = 'update';
        warnings.push(`Course code "${code}" already exists in ${normBranch} Sem ${semNum}. Record will be updated.`);
      } else {
        action = 'skip';
        warnings.push(`Course code "${code}" already exists in ${normBranch} Sem ${semNum}. Record will be skipped.`);
      }
    }

    const status = errors.length > 0 ? 'error' : (warnings.length > 0 ? 'warning' : 'valid');

    previewRows.push({
      rowIndex: idx + 1,
      code,
      name,
      type: typeInference.type, // 'theory' or 'lab'
      l: defaultLtp.l,
      t: defaultLtp.t,
      p: defaultLtp.p,
      credits: item.credits,
      int: item.int,
      ext: item.ext,
      total: calculatedTotal,
      programAndBranch: item.programAndBranch || departmentLabel(normBranch),
      status,
      action,
      existingId: existingRecord?._id || null,
      existingKind: existingRecord?.kind || null,
      warnings,
      errors,
    });
  }

  const summary = {
    total: previewRows.length,
    valid: previewRows.filter(r => r.status === 'valid').length,
    warnings: previewRows.filter(r => r.status === 'warning').length,
    errors: previewRows.filter(r => r.status === 'error').length,
    duplicates: previewRows.filter(r => r.errors.some(e => e.includes('Duplicate'))).length,
  };

  return { summary, rows: previewRows };
};

const confirmImport = async ({ session, branch, semester, updateMode, rows }) => {
  const normSession = normalizeSession(session);
  if (!normSession) throw new Error('Academic session is required');
  const normBranch = String(branch || '').trim().toUpperCase();
  if (!isValidSchemeBranch(normBranch)) throw new Error('Select a valid department');
  const semNum = Number(semester);
  if (!Number.isInteger(semNum) || semNum < 1 || semNum > 8) throw new Error('Select a valid semester (1-8)');

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('No rows to import');
  }

  // Fresh lookup of existing records
  const [existingSubjects, existingLabs] = await Promise.all([
    Subject.find({ session: normSession, branch: normBranch, semester: semNum }).select('_id code').lean(),
    Lab.find({ session: normSession, branch: normBranch, semester: semNum }).select('_id code').lean(),
  ]);
  const existingMap = new Map();
  existingSubjects.forEach(s => existingMap.set(String(s.code).toUpperCase(), { _id: s._id, kind: 'subject' }));
  existingLabs.forEach(l => existingMap.set(String(l.code).toUpperCase(), { _id: l._id, kind: 'lab' }));

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const details = [];

  for (const row of rows) {
    const code = normalizeAcademicCode(row.code);
    const name = String(row.name || '').trim();

    if (!code || !name) {
      skipped++;
      details.push({ code: code || 'UNKNOWN', status: 'skipped', reason: 'Missing code or name' });
      continue;
    }

    const isLab = row.type === 'lab';
    const credits = Math.max(0, Number(row.credits) || 0);
    const intMarks = Math.max(0, Number(row.int) || 0);
    const extMarks = Math.max(0, Number(row.ext) || 0);
    const l = Math.max(0, Number(row.l) || 0);
    const t = Math.max(0, Number(row.t) || 0);
    const p = Math.max(0, Number(row.p) || 0);

    const existing = existingMap.get(code);

    if (existing) {
      if (updateMode !== 'update') {
        skipped++;
        details.push({ code, status: 'skipped', reason: 'Already exists (skip mode)' });
        continue;
      }

      // Update existing record using academicSchemeService (preserves _id)
      const updatePayload = {
        name,
        credits,
        l, t, p,
        cwMax: isLab ? 0 : intMarks,
        theoryEndMax: isLab ? 0 : extMarks,
        swMax: isLab ? intMarks : 0,
        practicalEndMax: isLab ? extMarks : 0,
        type: isLab ? 'lab' : 'theory',
      };

      try {
        if (existing.kind === 'lab' && isLab) {
          await updateLabRecord(existing._id, updatePayload);
        } else if (existing.kind === 'subject' && !isLab) {
          await updateSubjectRecord(existing._id, updatePayload);
        } else {
          // Changed from Subject to Lab or vice versa while updating
          if (existing.kind === 'subject') {
            await Subject.findByIdAndDelete(existing._id);
            await createLabRecord({
              code,
              name,
              branch: normBranch,
              semester: semNum,
              session: normSession,
              ...updatePayload,
            });
          } else {
            await Lab.findByIdAndDelete(existing._id);
            await createSubjectRecord({
              code,
              name,
              branch: normBranch,
              semester: semNum,
              session: normSession,
              ...updatePayload,
            });
          }
        }
        updated++;
        details.push({ code, status: 'updated', kind: isLab ? 'lab' : 'subject' });
      } catch (err) {
        details.push({ code, status: 'error', reason: err.message });
      }
      continue;
    }

    // Create new record using academicSchemeService
    const createPayload = {
      code,
      name,
      branch: normBranch,
      semester: semNum,
      session: normSession,
      credits,
      l, t, p,
      cwMax: isLab ? 0 : intMarks,
      theoryEndMax: isLab ? 0 : extMarks,
      swMax: isLab ? intMarks : 0,
      practicalEndMax: isLab ? extMarks : 0,
      type: isLab ? 'lab' : 'theory',
    };

    try {
      if (isLab) {
        await createLabRecord(createPayload);
      } else {
        await createSubjectRecord(createPayload);
      }
      created++;
      details.push({ code, status: 'created', kind: isLab ? 'lab' : 'subject' });
      existingMap.set(code, { kind: isLab ? 'lab' : 'subject' });
    } catch (err) {
      details.push({ code, status: 'error', reason: err.message });
    }
  }

  return { created, updated, skipped, details };
};

const createImportTemplateWorkbook = () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Import Template');

  sheet.columns = [
    { header: 'course_code', key: 'course_code', width: 16 },
    { header: 'course_nomenclature', key: 'course_nomenclature', width: 36 },
    { header: 'INT', key: 'INT', width: 12 },
    { header: 'EXT', key: 'EXT', width: 12 },
    { header: 'TOTAL', key: 'TOTAL', width: 12 },
    { header: 'CREDITS', key: 'CREDITS', width: 12 },
    { header: 'Name of program and branch(SGSITS)', key: 'program_and_branch', width: 38 },
  ];

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2E8F0' },
  };

  // Sample guidance rows
  sheet.addRow({
    course_code: 'IT301T',
    course_nomenclature: 'Operating Systems',
    INT: 30,
    EXT: 70,
    TOTAL: 100,
    CREDITS: 4,
    program_and_branch: 'Information Technology',
  });
  sheet.addRow({
    course_code: 'IT302P',
    course_nomenclature: 'Operating Systems Lab',
    INT: 40,
    EXT: 60,
    TOTAL: 100,
    CREDITS: 2,
    program_and_branch: 'Information Technology',
  });

  return workbook;
};

const createSubjectsExportWorkbook = ({ subjects = [], labs = [], departmentName }) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Subjects & Labs');

  sheet.columns = [
    { header: 'Course Code', key: 'code', width: 16 },
    { header: 'Course Nomenclature', key: 'name', width: 36 },
    { header: 'INT', key: 'int', width: 12 },
    { header: 'EXT', key: 'ext', width: 12 },
    { header: 'TOTAL', key: 'total', width: 12 },
    { header: 'CREDITS', key: 'credits', width: 12 },
    { header: 'Name of program and branch (SGSITS)', key: 'program', width: 38 },
  ];

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2E8F0' },
  };

  const allItems = [
    ...subjects.map(s => ({ ...s, _isLab: false })),
    ...labs.map(l => ({ ...l, _isLab: true })),
  ].sort((a, b) => {
    if (a.semester !== b.semester) return (a.semester || 0) - (b.semester || 0);
    return String(a.code || '').localeCompare(String(b.code || ''));
  });

  allItems.forEach(item => {
    const intMarks = (item.cwMax || 0) + (item.swMax || 0);
    const extMarks = (item.theoryEndMax || 0) + (item.practicalEndMax || 0);
    const totalMarks = intMarks + extMarks;
    const progLabel = departmentLabel(item.branch) || departmentName || item.branch || '';

    sheet.addRow({
      code: item.code,
      name: item.name,
      int: intMarks,
      ext: extMarks,
      total: totalMarks,
      credits: item.credits ?? 0,
      program: progLabel,
    });
  });

  return workbook;
};

module.exports = {
  CANONICAL_HEADERS,
  inferType,
  defaultLtpForType,
  parseImportBuffer,
  previewImport,
  confirmImport,
  createImportTemplateWorkbook,
  createSubjectsExportWorkbook,
};
