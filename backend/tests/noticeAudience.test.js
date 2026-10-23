jest.mock('../src/models/Faculty', () => ({ findOne: jest.fn() }));
jest.mock('../src/models/FacultyTeachingAssignment', () => ({ find: jest.fn() }));
jest.mock('../src/models/Section', () => ({ findById: jest.fn(), findOne: jest.fn() }));

const mongoose = require('mongoose');
const FacultyTeachingAssignment = require('../src/models/FacultyTeachingAssignment');
const Section = require('../src/models/Section');
const {
  normalizeSection,
  buildAudienceOptions,
  resolveTargetSelection,
  buildStudentNoticeFilter,
  getFacultyAssignments,
  uniqueTargets,
  summarizeAudience,
} = require('../src/services/noticeAudienceService');

const makeTarget = (overrides = {}) => ({
  assignmentId: 'assignment-1',
  itemType: 'class',
  subjectId: 'subject-1',
  subjectCode: 'CS301',
  subjectName: 'DBMS',
  session: '2025-2026',
  term: 'july-december',
  semester: 5,
  branch: 'CSE',
  section: 'A',
  sectionLabel: 'Section A',
  ...overrides,
});

const assignment = (overrides = {}) => ({
  _id: 'assignment-1',
  itemType: 'class',
  session: '2025-2026',
  term: 'july-december',
  semester: 5,
  section: 'a',
  subjectId: { _id: 'subject-1', code: 'CS301', name: 'DBMS', branch: 'CSE', semester: 5 },
  labId: null,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  Section.findById.mockReturnValue({ lean: async () => null });
  Section.findOne.mockReturnValue({ lean: async () => null });
});

describe('notice audience service', () => {
  test('normalizes section names and builds uppercase audience snapshots', () => {
    expect(normalizeSection(' a ')).toBe('A');
    const [target] = buildAudienceOptions([assignment()]);
    expect(target).toMatchObject({
      assignmentId: 'assignment-1',
      branch: 'CSE',
      section: 'A',
      semester: 5,
      subjectCode: 'CS301',
      sectionLabel: 'Section A',
    });
  });

  test('deduplicates targets and summarizes unique class sections', () => {
    const a = makeTarget();
    const duplicate = makeTarget();
    const b = makeTarget({ assignmentId: 'assignment-2', section: 'B', sectionLabel: 'Section B' });
    expect(uniqueTargets([a, duplicate, b])).toHaveLength(2);
    expect(summarizeAudience([a, duplicate, b])).toBe('2 classes/sections');
    expect(summarizeAudience([a])).toBe('CSE · Semester 5 · Section A');
  });

  test('All My Classes resolves only the server-provided authorized options', () => {
    const options = [makeTarget(), makeTarget({ assignmentId: 'assignment-2', subjectId: 'subject-2' })];
    const result = resolveTargetSelection({
      mode: 'all-my-classes',
      assignmentIds: ['attacker-supplied-id'],
      options,
    });
    expect(result.error).toBeUndefined();
    expect(result.targets.map((target) => target.assignmentId)).toEqual(['assignment-1', 'assignment-2']);
  });

  test('selected mode rejects assignments not owned by the faculty member', () => {
    const result = resolveTargetSelection({
      mode: 'selected',
      assignmentIds: ['assignment-1', 'not-mine'],
      options: [makeTarget()],
    });
    expect(result.error).toMatch(/not assigned to you/i);
  });

  test('selected mode requires a selection and returns only authorized targets', () => {
    const empty = resolveTargetSelection({ mode: 'selected', assignmentIds: [], options: [makeTarget()] });
    expect(empty.error).toMatch(/select at least one/i);

    const selected = resolveTargetSelection({
      mode: 'selected',
      assignmentIds: ['assignment-1'],
      options: [makeTarget(), makeTarget({ assignmentId: 'assignment-2', subjectId: 'subject-2' })],
    });
    expect(selected.targets).toHaveLength(1);
    expect(selected.targets[0].assignmentId).toBe('assignment-1');
  });

  test('rejects an invalid audience mode and an empty assignment list', () => {
    expect(resolveTargetSelection({ mode: 'everyone', options: [makeTarget()] }).error).toMatch(/invalid/i);
    expect(resolveTargetSelection({ mode: 'all-my-classes', options: [] }).error).toMatch(/no teaching assignments/i);
  });

  test('student filter preserves admin visibility and adds faculty class matching', async () => {
    const studentId = new mongoose.Types.ObjectId();
    const filter = await buildStudentNoticeFilter({
      student: { _id: studentId, section: 'A', branch: 'CSE', currentSemester: 5 },
      academic: {
        session: '2025-2026',
        term: 'july-december',
        branch: 'CSE',
        semester: 5,
        section: 'A',
      },
    });

    expect(filter.$or).toHaveLength(2);
    const admin = filter.$or[0].$and;
    expect(admin).toEqual(expect.arrayContaining([
      { audience: { $in: ['all', 'students'] } },
      { session: '2025-2026' },
      { $or: [{ targetStudentIds: { $exists: false } }, { targetStudentIds: { $size: 0 } }, { targetStudentIds: studentId }] },
    ]));

    const faculty = filter.$or[1].$and;
    expect(faculty).toEqual(expect.arrayContaining([
      { authorRole: 'faculty' },
      { 'audienceTargets.0': { $exists: true } },
    ]));
    const targetMatch = faculty.find((condition) => condition.audienceTargets);
    expect(targetMatch.audienceTargets.$elemMatch).toMatchObject({
      session: '2025-2026',
      term: 'july-december',
      branch: 'CSE',
      semester: 5,
      section: { $in: ['', 'A'] },
    });
  });

  test('student filter never matches faculty notices when the student has no section', async () => {
    const filter = await buildStudentNoticeFilter({
      student: { _id: 'student-1', branch: 'CSE', currentSemester: 5 },
      academic: { session: '2025-2026', term: 'july-december', branch: 'CSE', semester: 5 },
    });
    const faculty = filter.$or[1].$and;
    const targetMatch = faculty.find((condition) => condition.audienceTargets);
    expect(targetMatch.audienceTargets.$elemMatch.section).toEqual({ $in: [''] });
  });

  test('faculty assignment lookup is scoped to the authenticated faculty id', async () => {
    const lean = jest.fn().mockResolvedValue([]);
    const chain = {
      populate: jest.fn(() => chain),
      sort: jest.fn(() => chain),
      lean,
    };
    FacultyTeachingAssignment.find.mockReturnValue(chain);

    await getFacultyAssignments('faculty-123', { session: '2025-2026', term: 'july-december' });

    expect(FacultyTeachingAssignment.find).toHaveBeenCalledWith({
      facultyId: 'faculty-123',
      session: '2025-2026',
      term: 'july-december',
    });
    expect(chain.populate).toHaveBeenCalledWith('subjectId', 'code name branch semester');
    expect(chain.populate).toHaveBeenCalledWith('labId', 'code name branch semester');
  });
});
