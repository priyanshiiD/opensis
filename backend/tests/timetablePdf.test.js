const { buildFacultySubjectSummary } = require('../src/utils/timetablePdf');

test('combines repeated sections and includes lab hours without duplicate counting', () => {
  const entries = [
    {
      _id: 'theory-a',
      day: 1,
      startSlot: 2,
      slotCount: 1,
      subject: { _id: 'os', code: 'IT301T', name: 'Operating Systems' },
      section: { _id: 'section-a' },
    },
    {
      _id: 'theory-b',
      day: 2,
      startSlot: 4,
      slotCount: 1,
      subject: { _id: 'os', code: 'IT301T', name: 'Operating Systems' },
      section: { _id: 'section-b' },
    },
    {
      _id: 'lab-a1',
      day: 3,
      startSlot: 5,
      slotCount: 2,
      batch: 'A1',
      subject: { _id: 'lab', code: 'IT302P', name: 'Operating Systems Lab' },
      section: { _id: 'section-a' },
    },
    {
      _id: 'lab-a1',
      day: 3,
      startSlot: 5,
      slotCount: 2,
      batch: 'A1',
      subject: { _id: 'lab', code: 'IT302P', name: 'Operating Systems Lab' },
      section: { _id: 'section-a' },
    },
  ];

  expect(buildFacultySubjectSummary(entries)).toEqual([
    { subjectId: 'os', name: 'Operating Systems', code: 'IT301T', hours: 2 },
    { subjectId: 'lab', name: 'Operating Systems Lab', code: 'IT302P', hours: 2 },
  ]);
});
