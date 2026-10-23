const {
  normalizeAssessment,
  assessmentLabel,
  validateMstRows,
  canSyncMstMark,
  buildMstSubjectMark,
} = require('../src/utils/mstMarks');

const roster = [
  { _id: 'student-1', enrollmentNo: 'CS001', firstName: 'Asha', lastName: 'Rao' },
  { _id: 'student-2', enrollmentNo: 'CS002', firstName: 'Vikram', lastName: 'Shah' },
];

describe('MST marks utilities', () => {
  test('normalizes assessment aliases', () => {
    expect(normalizeAssessment('MST 1')).toBe('mst1');
    expect(normalizeAssessment('mid-term-2')).toBe('mst2');
    expect(normalizeAssessment('mst2')).toBe('mst2');
    expect(normalizeAssessment('quiz')).toBeNull();
    expect(assessmentLabel('mst2')).toBe('MST 2');
  });

  test('validates rows against the authorized roster and assessment-specific column', () => {
    const result = validateMstRows({
      assessment: 'mst1',
      roster,
      rows: [
        { enrollmentNo: 'CS001', 'MST 1': 18 },
        { enrollmentNo: 'CS002', 'MST 1': '' },
      ],
    });
    expect(result.error).toBeUndefined();
    expect(result.failed).toEqual([]);
    expect(result.valid).toEqual([
      { row: 2, studentId: 'student-1', enrollmentNo: 'CS001', studentName: 'Asha Rao', marks: 18 },
      { row: 3, studentId: 'student-2', enrollmentNo: 'CS002', studentName: 'Vikram Shah', marks: 0 },
    ]);
  });

  test('reports unknown students, out-of-range marks, and duplicate enrollments', () => {
    const result = validateMstRows({
      assessment: 'mst2',
      roster,
      rows: [
        { enrollmentNo: 'CS001', 'MST 2': 21 },
        { enrollmentNo: 'CS999', 'MST 2': 10 },
        { enrollmentNo: 'CS002', 'MST 2': 12 },
        { enrollmentNo: 'CS002', 'MST 2': 13 },
      ],
    });
    expect(result.valid).toEqual([]);
    expect(result.failed).toEqual(expect.arrayContaining([
      expect.objectContaining({ enrollmentNo: 'CS001', reason: expect.stringMatching(/between 0 and 20/i) }),
      expect.objectContaining({ enrollmentNo: 'CS999', reason: expect.stringMatching(/active roster/i) }),
      expect.objectContaining({ enrollmentNo: 'CS002', reason: expect.stringMatching(/Duplicate/i) }),
    ]));
  });

  test('rejects a file that has no marks column', () => {
    const result = validateMstRows({
      assessment: 'mst1',
      roster,
      rows: [{ enrollmentNo: 'CS001', studentName: 'Asha Rao' }],
    });
    expect(result.error).toMatch(/no MST 1 marks column/i);
  });

  test('blocks syncing into published results or approved subject marks', () => {
    expect(canSyncMstMark({ result: { isPublished: true }, existingMark: null })).toMatch(/published/i);
    expect(canSyncMstMark({ result: { isPublished: false }, existingMark: { submissionStatus: 'approved' } })).toMatch(/approved/i);
    expect(canSyncMstMark({ result: { isPublished: false }, existingMark: { submissionStatus: 'pending' } })).toBeNull();
    expect(canSyncMstMark({ result: null, existingMark: null })).toBeNull();
  });

  test('builds a Result mark by preserving the other MST and recalculating CW/total/grade', () => {
    const mark = buildMstSubjectMark({
      existingMark: {
        subjectId: 'subject-1',
        midTerm2: 15,
        midTermMode: 'average',
        assignmentMarks: 8,
        theory: 50,
        credits: 4,
        submissionStatus: 'pending',
      },
      item: { _id: 'subject-1', code: 'CS301', name: 'DBMS', credits: 4 },
      assessment: 'mst1',
      marks: 18,
      facultyId: 'faculty-1',
      now: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(mark).toMatchObject({
      subjectId: 'subject-1',
      itemType: 'class',
      itemCode: 'CS301',
      midTerm1: 18,
      midTerm2: 15,
      midTermMode: 'average',
      midTermAverage: 16.5,
      assignmentMarks: 8,
      cw: 24.5,
      internalMarks: 24.5,
      theory: 50,
      externalMarks: 50,
      totalMarks: 74.5,
      grade: 'B',
      gradePoints: 9,
      credits: 4,
      creditPoints: 36,
      submissionStatus: 'pending',
      submittedBy: 'faculty-1',
    });
    expect(mark.reviewedBy).toBeUndefined();
    expect(mark.rejectionReason).toBeUndefined();
  });

  test('uses best-of-two when the existing result uses best mode', () => {
    const mark = buildMstSubjectMark({
      existingMark: {
        midTerm1: 0,
        midTerm2: 14,
        midTermMode: 'best',
        assignmentMarks: 5,
        theory: 40,
        credits: 3,
      },
      item: { _id: 'subject-1', code: 'CS301', name: 'DBMS', credits: 3 },
      assessment: 'mst1',
      marks: 17,
      facultyId: 'faculty-1',
    });
    expect(mark.midTermAverage).toBe(17);
    expect(mark.cw).toBe(22);
    expect(mark.totalMarks).toBe(62);
    expect(mark.grade).toBe('C');
    expect(mark.gradePoints).toBe(8);
  });

  test('rejects invalid MST values when building a result mark', () => {
    expect(() => buildMstSubjectMark({
      item: { _id: 'subject-1', code: 'CS301', name: 'DBMS' },
      assessment: 'mst1',
      marks: 20.5,
      facultyId: 'faculty-1',
    })).toThrow(/between 0 and 20/i);
  });
});
