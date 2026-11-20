const xlsx = require('xlsx');

// Mock mongoose models and academicSchemeService
jest.mock('../src/models/Subject', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  findByIdAndDelete: jest.fn(),
}));

jest.mock('../src/models/Lab', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  findByIdAndDelete: jest.fn(),
}));

jest.mock('../src/services/academicSchemeService', () => ({
  createSubjectRecord: jest.fn(),
  updateSubjectRecord: jest.fn(),
  createLabRecord: jest.fn(),
  updateLabRecord: jest.fn(),
  isValidSchemeBranch: jest.fn().mockReturnValue(true),
  normalizeAcademicCode: jest.fn((code) => String(code || '').trim().toUpperCase()),
}));

const Subject = require('../src/models/Subject');
const Lab = require('../src/models/Lab');
const academicSchemeService = require('../src/services/academicSchemeService');
const {
  inferType,
  parseImportBuffer,
  previewImport,
  confirmImport,
  createImportTemplateWorkbook,
  createSubjectsExportWorkbook,
} = require('../src/services/subjectImportService');

const buildWorkbookBuffer = (rows) => {
  const ws = xlsx.utils.aoa_to_sheet(rows);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Scheme');
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
};

describe('Subject Import V2 (7-column format)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Type Inference', () => {
    test('identifies clear subject without warning when code ends with T', () => {
      const res = inferType('IT301T', 'Operating Systems');
      expect(res.type).toBe('theory');
      expect(res.warning).toBeNull();
    });

    test('identifies clear lab without warning when name mentions Lab and code ends with P', () => {
      const res = inferType('IT302P', 'Operating Systems Lab');
      expect(res.type).toBe('lab');
      expect(res.warning).toBeNull();
    });

    test('identifies clear subject without warning when neither has lab indicator', () => {
      const res = inferType('IT303', 'Database Management');
      expect(res.type).toBe('theory');
      expect(res.warning).toBeNull();
    });

    test('emits warning when nomenclature mentions Lab but code ends with T', () => {
      const res = inferType('IT304T', 'Network Programming Lab');
      expect(res.type).toBe('lab');
      expect(res.warning).toMatch(/Type conflict/);
    });

    test('emits warning when code ends with P but nomenclature lacks lab indicator', () => {
      const res = inferType('IT305P', 'Compiler Design');
      expect(res.type).toBe('lab');
      expect(res.warning).toMatch(/Type conflict/);
    });
  });

  describe('File Parsing & Sub-header Handling', () => {
    test('parses standard 7-column spreadsheet correctly', () => {
      const sheetData = [
        ['course_code', 'course_nomenclature', 'INT', 'EXT', 'TOTAL', 'CREDITS', 'Name of program and branch(SGSITS)'],
        ['IT301T', 'Operating Systems', 30, 70, 100, 4, 'Information Technology'],
        ['IT302P', 'Operating Systems Lab', 40, 60, 100, 2, 'Information Technology'],
      ];

      const buffer = buildWorkbookBuffer(sheetData);
      const parsed = parseImportBuffer(buffer);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].code).toBe('IT301T');
      expect(parsed[0].int).toBe(30);
      expect(parsed[0].ext).toBe(70);
      expect(parsed[0].total).toBe(100);
      expect(parsed[0].credits).toBe(4);
      expect(parsed[1].code).toBe('IT302P');
    });

    test('silently ignores extra min marks column and sub-header row', () => {
      const sheetData = [
        ['course_code', 'course_nomenclature', 'INT', '', 'EXT', '', 'TOTAL', '', 'CREDITS', 'Name of program and branch(SGSITS)'],
        ['', '', 'MAX MARKS', 'MIN MARKS', 'MAX MARKS', 'MIN MARKS', 'MAX MARKS', 'MIN MARKS', '', ''],
        ['IT401T', 'Cloud Computing', 30, 12, 70, 28, 100, 40, 4, 'Information Technology'],
        ['', '', '', '', '', '', '', '', '', ''], // empty row
        ['IT402P', 'Cloud Lab', 40, 16, 60, 24, 100, 40, 2, 'Information Technology'],
      ];

      const buffer = buildWorkbookBuffer(sheetData);
      const parsed = parseImportBuffer(buffer);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].code).toBe('IT401T');
      expect(parsed[0].int).toBe(30);
      expect(parsed[0].ext).toBe(70);
      expect(parsed[1].code).toBe('IT402P');
      expect(parsed[1].int).toBe(40);
      expect(parsed[1].ext).toBe(60);
    });
  });

  describe('Preview & Validation', () => {
    test('flags errors for missing fields, negative marks, and duplicates', async () => {
      Subject.find.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) });
      Lab.find.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) });

      const sheetData = [
        ['course_code', 'course_nomenclature', 'INT', 'EXT', 'TOTAL', 'CREDITS', 'Name of program and branch(SGSITS)'],
        ['IT501T', '', 30, 70, 100, 4, 'Information Technology'], // missing name
        ['IT502T', 'Negative Marks Subject', -10, 70, 60, 4, 'Information Technology'], // negative INT
        ['IT503T', 'Original Course', 30, 70, 100, 4, 'Information Technology'],
        ['IT503T', 'Duplicate Course', 30, 70, 100, 4, 'Information Technology'], // duplicate in file
      ];

      const buffer = buildWorkbookBuffer(sheetData);
      const preview = await previewImport({
        buffer,
        session: '2025-2026',
        branch: 'IT',
        semester: 5,
        updateMode: 'skip',
      });

      expect(preview.summary.total).toBe(4);
      expect(preview.summary.errors).toBe(3); // rows 0, 1, and 3 have errors
      expect(preview.rows[0].errors).toContain('Course nomenclature is required');
      expect(preview.rows[1].errors).toContain('INT marks cannot be negative');
      expect(preview.rows[3].errors[0]).toMatch(/Duplicate course code/);
    });

    test('handles existing records: skip mode vs update mode', async () => {
      Subject.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ _id: 'subj-1', code: 'IT301T', name: 'Old OS' }]),
        }),
      });
      Lab.find.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) });

      const sheetData = [
        ['course_code', 'course_nomenclature', 'INT', 'EXT', 'TOTAL', 'CREDITS', 'Name of program and branch(SGSITS)'],
        ['IT301T', 'Operating Systems', 30, 70, 100, 4, 'Information Technology'],
      ];
      const buffer = buildWorkbookBuffer(sheetData);

      // In skip mode
      const skipPreview = await previewImport({
        buffer,
        session: '2025-2026',
        branch: 'IT',
        semester: 3,
        updateMode: 'skip',
      });
      expect(skipPreview.rows[0].action).toBe('skip');
      expect(skipPreview.rows[0].status).toBe('warning');

      // In update mode
      const updatePreview = await previewImport({
        buffer,
        session: '2025-2026',
        branch: 'IT',
        semester: 3,
        updateMode: 'update',
      });
      expect(updatePreview.rows[0].action).toBe('update');
      expect(updatePreview.rows[0].existingId).toBe('subj-1');
    });
  });

  describe('Confirm Import', () => {
    test('creates new subject and lab records using academicSchemeService', async () => {
      Subject.find.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) });
      Lab.find.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) });
      academicSchemeService.createSubjectRecord.mockResolvedValue({ _id: 'new-subj' });
      academicSchemeService.createLabRecord.mockResolvedValue({ _id: 'new-lab' });

      const rows = [
        { code: 'IT301T', name: 'Operating Systems', type: 'theory', int: 30, ext: 70, credits: 4, l: 4, t: 0, p: 0 },
        { code: 'IT302P', name: 'Operating Systems Lab', type: 'lab', int: 40, ext: 60, credits: 2, l: 0, t: 0, p: 4 },
      ];

      const result = await confirmImport({
        session: '2025-2026',
        branch: 'IT',
        semester: 3,
        updateMode: 'skip',
        rows,
      });

      expect(result.created).toBe(2);
      expect(academicSchemeService.createSubjectRecord).toHaveBeenCalledTimes(1);
      expect(academicSchemeService.createLabRecord).toHaveBeenCalledTimes(1);
    });

    test('updates existing records using academicSchemeService and preserves _id', async () => {
      Subject.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ _id: 'existing-subj-id', code: 'IT301T' }]),
        }),
      });
      Lab.find.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) });
      academicSchemeService.updateSubjectRecord.mockResolvedValue({ _id: 'existing-subj-id' });

      const rows = [
        { code: 'IT301T', name: 'Operating Systems (Updated)', type: 'theory', int: 30, ext: 70, credits: 4, l: 4, t: 0, p: 0 },
      ];

      const result = await confirmImport({
        session: '2025-2026',
        branch: 'IT',
        semester: 3,
        updateMode: 'update',
        rows,
      });

      expect(result.updated).toBe(1);
      expect(academicSchemeService.updateSubjectRecord).toHaveBeenCalledWith(
        'existing-subj-id',
        expect.objectContaining({ name: 'Operating Systems (Updated)' })
      );
    });
  });

  describe('Template & Export Workbooks', () => {
    test('generates valid template workbook with 7 headers', () => {
      const wb = createImportTemplateWorkbook();
      const ws = wb.getWorksheet('Import Template');
      expect(ws).toBeDefined();
      expect(ws.columns).toHaveLength(7);
      expect(ws.getRow(1).getCell(1).value).toBe('course_code');
    });

    test('generates valid export workbook with 7 columns', () => {
      const subjects = [{ code: 'IT101', name: 'Programming', cwMax: 30, theoryEndMax: 70, credits: 4, branch: 'IT' }];
      const labs = [{ code: 'IT102', name: 'Programming Lab', swMax: 40, practicalEndMax: 60, credits: 2, branch: 'IT' }];
      const wb = createSubjectsExportWorkbook({ subjects, labs, departmentName: 'Information Technology' });
      const ws = wb.getWorksheet('Subjects & Labs');
      expect(ws).toBeDefined();
      expect(ws.columns).toHaveLength(7);
      expect(ws.rowCount).toBe(3); // 1 header + 2 data rows
    });
  });
});
