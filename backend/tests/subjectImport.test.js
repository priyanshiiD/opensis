jest.mock('../src/services/academicSchemeService', () => ({
  isValidSchemeBranch: jest.fn(() => true),
  createSubjectRecord: jest.fn(),
  updateSubjectRecord: jest.fn(),
  createLabRecord: jest.fn(),
  updateLabRecord: jest.fn(),
}));
jest.mock('../src/models/Subject', () => ({ find: jest.fn() }));
jest.mock('../src/models/Lab', () => ({ find: jest.fn() }));
jest.mock('../src/models/Faculty', () => ({ find: jest.fn() }));

const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const mongoose = require('mongoose');
const Subject = require('../src/models/Subject');
const Lab = require('../src/models/Lab');
const Faculty = require('../src/models/Faculty');
const academicSchemeService = require('../src/services/academicSchemeService');
const {
  parseImportFile,
  preparePreview,
  confirmSubjectImport,
  createSubjectImportTemplateWorkbook,
} = require('../src/services/subjectImport');

const chain = (result) => {
  const query = {
    select: jest.fn(() => query),
    populate: jest.fn(() => query),
    session: jest.fn(() => query),
    lean: jest.fn(async () => result),
  };
  return query;
};

const buildWorkbook = (rows) => {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Import');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

const buildTextPdf = () => new Promise((resolve, reject) => {
  const document = new PDFDocument({ size: [842, 595], margin: 20 });
  const chunks = [];
  document.on('data', (chunk) => chunks.push(chunk));
  document.on('end', () => resolve(Buffer.concat(chunks)));
  document.on('error', reject);

  const columns = [30, 90, 250, 330, 380, 430, 490, 540, 610, 650, 700];
  const headers = [
    'Code', 'Subject Name', 'Type', 'L-T-P', 'Credits',
    'Theory End', 'CW', 'Practical End', 'SW', 'Total', 'Faculty',
  ];
  headers.forEach((header, index) => {
    document.text(header, columns[index], 40, { lineBreak: false });
  });
  const values = [
    'IT301', 'Database Management Systems', 'Subject', '3-1-0', '4',
    '70', '30', '0', '0', '100', 'Anita Sharma',
  ];
  values.forEach((value, index) => {
    document.text(value, columns[index], 70, { lineBreak: false });
  });
  document.end();
});

const buildBlankPdf = () => new Promise((resolve, reject) => {
  const document = new PDFDocument({ size: 'A4', margin: 20 });
  const chunks = [];
  document.on('data', (chunk) => chunks.push(chunk));
  document.on('end', () => resolve(Buffer.concat(chunks)));
  document.on('error', reject);
  document.end();
});

const facultyFixture = () => [
  {
    _id: 'faculty-1',
    firstName: 'Anita',
    lastName: 'Sharma',
    department: 'IT',
    userId: { email: 'anita.sharma@college.edu', role: 'faculty' },
  },
  {
    _id: 'faculty-2',
    firstName: 'Rahul',
    lastName: 'Verma',
    department: 'IT',
    userId: { email: 'rahul.verma@college.edu', role: 'faculty' },
  },
  {
    _id: 'faculty-3',
    firstName: 'Sameer',
    lastName: 'Khan',
    department: 'IT',
    userId: { email: 'sameer.khan@college.edu', role: 'faculty' },
  },
  {
    _id: 'faculty-4',
    firstName: 'Sameer',
    lastName: 'Khan',
    department: 'IT',
    userId: { email: 'sameer.khan2@college.edu', role: 'faculty' },
  },
];

const mockImportContext = ({ subjects = [], labs = [], faculties = facultyFixture() } = {}) => {
  Subject.find.mockReturnValue(chain(subjects));
  Lab.find.mockReturnValue(chain(labs));
  Faculty.find.mockReturnValue(chain(faculties));
};

const templateHeaders = [
  'Code', 'Subject Name', 'Type (Subject or Lab)', 'L-T-P', 'Credits',
  'Theory End', 'CW', 'Practical End', 'SW', 'Total',
  'Faculty (comma-separated names or emails)', 'Semester (optional)',
  'Year (optional)', 'Syllabus (optional)',
];

beforeEach(() => {
  jest.clearAllMocks();
  academicSchemeService.isValidSchemeBranch.mockReturnValue(true);
  academicSchemeService.createSubjectRecord.mockResolvedValue({ _id: 'created-subject' });
  academicSchemeService.createLabRecord.mockResolvedValue({ _id: 'created-lab' });
  academicSchemeService.updateSubjectRecord.mockResolvedValue({ _id: 'updated-subject' });
  academicSchemeService.updateLabRecord.mockResolvedValue({ _id: 'updated-lab' });
  jest.spyOn(mongoose, 'startSession').mockRejectedValue(
    Object.assign(new Error('Transactions are not supported on this deployment.'), { code: 20 }),
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('parses Excel headers case-insensitively and tolerates common header variations', async () => {
  const buffer = buildWorkbook([
    ['Code', 'Sub Name', 'Th.End', 'CW', 'Pr.End', 'SW', 'Total', 'L-T-P', 'Cr', 'Type', 'Faculty', 'Semester', 'Year', 'Syllabus'],
    ['IT301', 'Database Management Systems', 70, 30, 0, 0, 100, '3-1-0', 4, 'Subject', 'Anita Sharma', '', '', 'Unit 1'],
  ]);

  const parsed = await parseImportFile({ buffer, originalname: 'subjects.xlsx', size: buffer.length });
  expect(parsed.fileType).toBe('excel');
  expect(parsed.rows).toHaveLength(1);
  expect(parsed.rows[0]).toMatchObject({
    code: 'IT301',
    name: 'Database Management Systems',
    type: 'Subject',
    ltp: '3-1-0',
    credits: 4,
    theoryEnd: 70,
    cw: 30,
    practicalEnd: 0,
    sw: 0,
    total: 100,
    faculty: 'Anita Sharma',
    syllabus: 'Unit 1',
  });
});

test('preview validates faculty, duplicates, totals, required fields and existing codes', async () => {
  mockImportContext({
    subjects: [{ _id: 'existing-1', code: 'IT301', name: 'Data Structures', semester: 3 }],
  });
  const buffer = buildWorkbook([
    templateHeaders,
    ['IT301', 'Data Structures', 'Subject', '3-1-0', 4, 70, 30, 0, 0, 100, 'Anita Sharma', 3, 2, ''],
    ['IT302', 'Operating Systems', 'Subject', '3-0-0', 3, 70, 30, 0, 0, 100, 'Anita Sharma, rahul.verma@college.edu', 3, 2, ''],
    ['IT303', '', 'Subject', '3-0-0', 3, 70, 30, 0, 0, 100, 'Missing Person', 3, 2, ''],
    ['IT304', 'Computer Networks', '', '0-0-2', 1, 0, 0, 60, 40, 90, 'Sameer Khan', 3, 2, ''],
    ['IT305', 'Elective', 'Elective', '3-0-0', 3, 70, 30, 0, 0, 100, '', 3, 2, ''],
    ['IT307', 'Software Engineering', 'Subject', '3-0-0', 3, 70, 30, 0, 0, 100, '', 3, 2, ''],
    ['IT307', 'Software Engineering Duplicate', 'Subject', '3-0-0', 3, 70, 30, 0, 0, 100, '', 3, 2, ''],
  ]);

  const preview = await preparePreview({
    buffer,
    originalname: 'subjects.xlsx',
    size: buffer.length,
    session: '2025-2026',
    branch: 'IT',
    year: 2,
    semester: 3,
    updateMode: 'skip',
  });

  expect(preview.summary.total).toBe(7);
  expect(preview.summary.duplicates).toBe(2);
  expect(preview.summary.errors).toBe(4);
  expect(preview.summary.valid).toBe(3);

  const existingRow = preview.rows[0];
  expect(existingRow.action).toBe('skip');
  expect(existingRow.warnings.join(' ')).toMatch(/skipped/i);

  const matchedFacultyRow = preview.rows[1];
  expect(matchedFacultyRow.values.facultyIds).toEqual(['faculty-1', 'faculty-2']);
  expect(matchedFacultyRow.status).toBe('valid');

  const duplicateRows = preview.rows.filter((row) => row.duplicate);
  expect(duplicateRows).toHaveLength(2);
  expect(duplicateRows.every((row) => row.status === 'error')).toBe(true);
  expect(duplicateRows[0].errors.join(' ')).toMatch(/Duplicate code in file/i);

  const missingFacultyRow = preview.rows[2];
  expect(missingFacultyRow.status).toBe('error');
  expect(missingFacultyRow.errors.join(' ')).toMatch(/Subject name is required/);
  expect(missingFacultyRow.errors.join(' ')).toMatch(/Faculty not found: Missing Person/);

  const inferredLabRow = preview.rows[3];
  expect(inferredLabRow.values.type).toBe('lab');
  expect(inferredLabRow.status).toBe('warning');
  expect(inferredLabRow.warnings.join(' ')).toMatch(/suggests a Lab/i);
  expect(inferredLabRow.warnings.join(' ')).toMatch(/Total marks/i);
  expect(inferredLabRow.warnings.join(' ')).toMatch(/Ambiguous faculty name: Sameer Khan/);

  const invalidTypeRow = preview.rows[4];
  expect(invalidTypeRow.status).toBe('error');
  expect(invalidTypeRow.errors.join(' ')).toMatch(/Type must be Subject or Lab/);
});

test('confirm skips existing codes when the skip option is selected', async () => {
  mockImportContext({
    subjects: [{ _id: 'existing-1', code: 'IT301', name: 'Data Structures', semester: 3 }],
  });

  const result = await confirmSubjectImport({
    session: '2025-2026',
    branch: 'IT',
    year: 2,
    semester: 3,
    updateMode: 'skip',
    rows: [
      {
        rowNumber: 2,
        values: {
          code: 'IT301', name: 'Data Structures', type: 'subject', ltp: '3-1-0',
          credits: 4, theoryEnd: 70, cw: 30, practicalEnd: 0, sw: 0, total: 100,
          faculty: 'Anita Sharma', semester: 3, year: 2, syllabus: '',
        },
      },
      {
        rowNumber: 3,
        values: {
          code: 'IT302', name: 'Operating Systems', type: 'subject', ltp: '3-0-0',
          credits: 3, theoryEnd: 70, cw: 30, practicalEnd: 0, sw: 0, total: 100,
          faculty: '', semester: 3, year: 2, syllabus: '',
        },
      },
    ],
  });

  expect(result.summary).toMatchObject({ created: 1, updated: 0, skipped: 1 });
  expect(academicSchemeService.createSubjectRecord).toHaveBeenCalledTimes(1);
  expect(academicSchemeService.updateSubjectRecord).not.toHaveBeenCalled();
});

test('confirm creates labs with the selected scope and matched faculty', async () => {
  mockImportContext();

  const result = await confirmSubjectImport({
    session: '2025-2026',
    branch: 'IT',
    year: 2,
    semester: 3,
    updateMode: 'skip',
    rows: [
      {
        rowNumber: 2,
        values: {
          code: 'IT351', name: 'Networks Lab', type: 'lab', ltp: '0-0-2',
          credits: 1, theoryEnd: 0, cw: 0, practicalEnd: 60, sw: 40, total: 100,
          faculty: 'Anita Sharma', semester: 3, year: 2, syllabus: '',
        },
      },
    ],
  });

  expect(result.summary).toMatchObject({ created: 1, updated: 0, skipped: 0 });
  expect(academicSchemeService.createLabRecord).toHaveBeenCalledWith(
    expect.objectContaining({
      code: 'IT351',
      name: 'Networks Lab',
      branch: 'IT',
      semester: 3,
      session: '2025-2026',
      facultyIds: ['faculty-1'],
      practicalEndMax: 60,
      swMax: 40,
    }),
    expect.objectContaining({ mongoSession: null, academicSession: '2025-2026' }),
  );
});

test('confirm updates existing records without changing their internal ID', async () => {
  mockImportContext({
    subjects: [{ _id: 'existing-1', code: 'IT301', name: 'Data Structures', semester: 3 }],
  });

  const result = await confirmSubjectImport({
    session: '2025-2026',
    branch: 'IT',
    year: 2,
    semester: 3,
    updateMode: 'update',
    rows: [
      {
        rowNumber: 2,
        values: {
          code: 'IT301', name: 'Data Structures and Algorithms', type: 'subject', ltp: '3-1-0',
          credits: 4, theoryEnd: 70, cw: 30, practicalEnd: 0, sw: 0, total: 100,
          faculty: 'Anita Sharma', semester: 3, year: 2, syllabus: 'Updated syllabus',
        },
      },
    ],
  });

  expect(result.summary).toMatchObject({ created: 0, updated: 1, skipped: 0 });
  expect(academicSchemeService.createSubjectRecord).not.toHaveBeenCalled();
  expect(academicSchemeService.updateSubjectRecord).toHaveBeenCalledWith(
    'existing-1',
    expect.objectContaining({
      name: 'Data Structures and Algorithms',
      facultyIds: ['faculty-1'],
      syllabusText: 'Updated syllabus',
    }),
    expect.objectContaining({ mongoSession: null }),
  );
});

test('uses the data sheet of a workbook that has an instructions sheet first', async () => {
  mockImportContext();
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([['Instructions'], ['Fill in the Import Template sheet.']]),
    'Instructions',
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      templateHeaders,
      ['IT401', 'Machine Learning', 'Subject', '3-0-0', 3, 70, 30, 0, 0, 100, '', 5, '', ''],
    ]),
    'Import Template',
  );
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  const preview = await preparePreview({
    buffer,
    originalname: 'filled-template.xlsx',
    size: buffer.length,
    session: '2025-2026',
    branch: 'IT',
    year: 2,
    semester: 3,
    updateMode: 'skip',
  });

  expect(preview.rows).toHaveLength(1);
  expect(preview.rows[0].values).toMatchObject({ code: 'IT401', semester: 5, year: 3 });
  expect(preview.rows[0].status).toBe('valid');
});

test('rejects imports that exceed the 500 row limit', async () => {
  mockImportContext();
  const rows = [templateHeaders];
  for (let index = 0; index < 501; index += 1) {
    rows.push([`IT${index}`, `Subject ${index}`, 'Subject', '3-0-0', 3, 70, 30, 0, 0, 100, '', 3, 2, '']);
  }
  const buffer = buildWorkbook(rows);

  await expect(preparePreview({
    buffer,
    originalname: 'large.xlsx',
    size: buffer.length,
    session: '2025-2026',
    branch: 'IT',
    year: 2,
    semester: 3,
    updateMode: 'skip',
  })).rejects.toThrow(/maximum of 500 rows/i);
});

test('parses a text-based PDF into previewable rows', async () => {
  const buffer = await buildTextPdf();
  const parsed = await parseImportFile({ buffer, originalname: 'scheme.pdf', size: buffer.length });
  expect(parsed.fileType).toBe('pdf');
  expect(parsed.rows.length).toBeGreaterThanOrEqual(1);
  expect(parsed.rows[0].code).toBe('IT301');
  expect(parsed.rows[0].name).toMatch(/Database Management Systems/i);
});

test('returns a friendly error for a scanned or image-only PDF', async () => {
  const buffer = await buildBlankPdf();
  await expect(parseImportFile({
    buffer,
    originalname: 'scanned.pdf',
    size: buffer.length,
  })).rejects.toThrow('This PDF appears to be scanned. Please upload an Excel file.');
});

test('generates an Excel template with an instructions sheet', () => {
  const workbook = createSubjectImportTemplateWorkbook();
  expect(workbook.getWorksheet('Instructions')).toBeTruthy();
  const template = workbook.getWorksheet('Import Template');
  expect(template).toBeTruthy();
  expect(template.getCell('A1').value).toBe('Code');
  expect(template.getCell('B1').value).toBe('Subject Name');
  expect(template.getCell('C1').value).toBe('Type (Subject or Lab)');
});
