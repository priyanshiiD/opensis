jest.mock('../src/services/subjectImportService', () => ({
  previewImport: jest.fn(),
  confirmImport: jest.fn(),
  createImportTemplateWorkbook: jest.fn(),
  createSubjectsExportWorkbook: jest.fn(),
}));
jest.mock('../src/models/Subject', () => ({ find: jest.fn() }));
jest.mock('../src/models/Lab', () => ({ find: jest.fn() }));

const controller = require('../src/controllers/subjectImportController');
const service = require('../src/services/subjectImportService');
const Subject = require('../src/models/Subject');
const Lab = require('../src/models/Lab');

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  return res;
};

describe('subjectImportController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('previewImport returns 400 if no file uploaded', async () => {
    const req = { body: {}, file: null };
    const res = createMockRes();

    await controller.previewImport(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Please select a file to upload' });
  });

  test('previewImport passes file buffer and parameters to service', async () => {
    const req = {
      body: { session: '2025-2026', branch: 'IT', semester: '3', updateMode: 'update' },
      file: { buffer: Buffer.from('test'), originalname: 'test.xlsx' },
    };
    const res = createMockRes();
    service.previewImport.mockResolvedValue({ summary: { total: 1 }, rows: [] });

    await controller.previewImport(req, res);

    expect(service.previewImport).toHaveBeenCalledWith({
      buffer: req.file.buffer,
      originalname: 'test.xlsx',
      session: '2025-2026',
      branch: 'IT',
      semester: '3',
      updateMode: 'update',
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test('confirmImport calls service and returns summary message', async () => {
    const req = {
      body: {
        session: '2025-2026',
        branch: 'IT',
        semester: '3',
        updateMode: 'skip',
        rows: [{ code: 'IT301T' }],
      },
    };
    const res = createMockRes();
    service.confirmImport.mockResolvedValue({ created: 1, updated: 0, skipped: 0 });

    await controller.confirmImport(req, res);

    expect(service.confirmImport).toHaveBeenCalledWith(req.body);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          created: 1,
          message: 'Import complete: 1 created, 0 updated, 0 skipped.',
        }),
      })
    );
  });

  test('downloadTemplate writes workbook to response stream', async () => {
    const req = {};
    const res = createMockRes();
    const mockWb = { xlsx: { write: jest.fn().mockResolvedValue() } };
    service.createImportTemplateWorkbook.mockReturnValue(mockWb);

    await controller.downloadTemplate(req, res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', expect.stringContaining('spreadsheetml'));
    expect(mockWb.xlsx.write).toHaveBeenCalledWith(res);
    expect(res.end).toHaveBeenCalled();
  });

  test('exportSubjects validates session and branch and writes export workbook', async () => {
    const req = { query: { session: '2025-2026', branch: 'IT' } };
    const res = createMockRes();
    Subject.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([{ code: 'IT101', branch: 'IT' }]) });
    Lab.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    const mockWb = { xlsx: { write: jest.fn().mockResolvedValue() } };
    service.createSubjectsExportWorkbook.mockReturnValue(mockWb);

    await controller.exportSubjects(req, res);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="Scheme_IT_2025-2026.xlsx"'
    );
    expect(mockWb.xlsx.write).toHaveBeenCalledWith(res);
    expect(res.end).toHaveBeenCalled();
  });
});
