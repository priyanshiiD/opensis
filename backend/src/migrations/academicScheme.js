const Subject = require('../models/Subject');
const Lab = require('../models/Lab');
const FacultyTeachingAssignment = require('../models/FacultyTeachingAssignment');
const Result = require('../models/Result');
const {
  validateSubjectCode,
  normalizeSubjectCodeForScheme,
} = require('../utils/subjectCode');

const SCHEME_INDEX_NAME = 'scheme_session_branch_semester_code';
const SCHEME_INDEX_KEYS = { session: 1, branch: 1, semester: 1, code: 1 };
const ASSIGNMENT_INDEX_NAME = 'teaching_assignment_unique';
const ASSIGNMENT_INDEX_KEYS = {
  facultyId: 1, itemType: 1, subjectId: 1, labId: 1, session: 1, term: 1, section: 1,
};

// listIndexes throws NamespaceNotFound (26) when the collection does not exist yet.
const safeIndexes = async (collection) => {
  try {
    return await collection.indexes();
  } catch (err) {
    if (err.code === 26 || err.codeName === 'NamespaceNotFound') return [];
    throw err;
  }
};

const indexNames = async (collection) => (await safeIndexes(collection)).map((index) => index.name);

const dropLegacyCodeIndex = async (collection, label) => {
  const names = await indexNames(collection);
  if (names.includes('code_1')) {
    await collection.dropIndex('code_1');
    console.log(`[migration] Dropped legacy unique index code_1 on ${label}`);
  }
};

const ensureSchemeUniqueIndex = async (Model, label) => {
  const collection = Model.collection;
  await dropLegacyCodeIndex(collection, label);

  const names = await indexNames(collection);
  if (names.includes(SCHEME_INDEX_NAME)) return;

  const duplicates = await Model.aggregate([
    {
      $group: {
        _id: { session: '$session', branch: '$branch', semester: '$semester', code: '$code' },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $limit: 5 },
  ]);

  if (duplicates.length) {
    console.warn(
      `[migration] Skipped unique scheme index on ${label}: ${duplicates.length} duplicate key group(s) found. `
      + 'Resolve duplicates and restart the server.',
    );
    return;
  }

  await collection.createIndex(SCHEME_INDEX_KEYS, { unique: true, name: SCHEME_INDEX_NAME });
  console.log(`[migration] Created unique scheme index on ${label}`);
};

const ensureAssignmentIndex = async () => {
  const collection = FacultyTeachingAssignment.collection;

  // Backfill itemType for rows created before labs were assignable.
  const backfill = await FacultyTeachingAssignment.updateMany(
    { itemType: { $exists: false } },
    { $set: { itemType: 'class' } },
  );
  if (backfill.modifiedCount) {
    console.log(`[migration] Backfilled itemType on ${backfill.modifiedCount} teaching assignment(s)`);
  }

  // Drop the old subject-only unique index if present.
  const names = await indexNames(collection);
  const legacy = names.filter((name) => name.startsWith('facultyId_1_subjectId_1_'));
  for (const name of legacy) {
    await collection.dropIndex(name);
    console.log(`[migration] Dropped legacy teaching assignment index ${name}`);
  }

  const current = await indexNames(collection);
  if (current.includes(ASSIGNMENT_INDEX_NAME)) return;

  const duplicates = await FacultyTeachingAssignment.aggregate([
    {
      $group: {
        _id: {
          facultyId: '$facultyId',
          itemType: '$itemType',
          subjectId: '$subjectId',
          labId: '$labId',
          session: '$session',
          term: '$term',
          section: '$section',
        },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $limit: 5 },
  ]);

  if (duplicates.length) {
    console.warn(
      `[migration] Skipped unique teaching assignment index: ${duplicates.length} duplicate group(s) found. `
      + 'Resolve duplicates and restart the server.',
    );
    return;
  }

  await collection.createIndex(ASSIGNMENT_INDEX_KEYS, { unique: true, name: ASSIGNMENT_INDEX_NAME });
  console.log('[migration] Created unique teaching assignment index');
};

const repairMislabeledLabAssignments = async () => {
  // Older seed scripts stored lab assignments in subjectId with itemType 'lab'.
  // Move them to labId so lab lookups (faculty/student views) find them.
  const labDocs = await Lab.find({}).select('_id').lean();
  const labIds = new Set(labDocs.map((lab) => String(lab._id)));

  const mislabeled = await FacultyTeachingAssignment.find({
    itemType: 'lab',
    labId: null,
    subjectId: { $ne: null },
  }).lean();

  let repaired = 0;
  let removed = 0;
  for (const assignment of mislabeled) {
    if (!labIds.has(String(assignment.subjectId))) continue;

    const duplicate = await FacultyTeachingAssignment.findOne({
      _id: { $ne: assignment._id },
      itemType: 'lab',
      labId: assignment.subjectId,
      facultyId: assignment.facultyId,
      session: assignment.session,
      term: assignment.term,
      section: assignment.section || '',
    }).lean();

    if (duplicate) {
      await FacultyTeachingAssignment.deleteOne({ _id: assignment._id });
      removed += 1;
      continue;
    }

    await FacultyTeachingAssignment.updateOne(
      { _id: assignment._id },
      { $set: { labId: assignment.subjectId }, $unset: { subjectId: '' } },
    );
    repaired += 1;
  }

  if (repaired || removed) {
    console.log(`[migration] Repaired ${repaired} lab assignment(s), removed ${removed} duplicate(s)`);
  }
};

const auditSubjectCodeFormats = async () => {
  for (const [Model, label] of [[Subject, 'subject'], [Lab, 'lab']]) {
    const records = await Model.find({}).select('_id code branch semester isCommon').lean();
    const invalid = records.filter((record) =>
      validateSubjectCode(record.code, record.branch, record.semester, { isCommon: !!record.isCommon }),
    );
    if (invalid.length) {
      console.warn(
        `[migration] Found ${invalid.length} ${label}(s) with invalid branch/year code format. `
        + `Fix through the admin ${label} form before reuse.`,
      );
    }
  }
};

const normalizeExistingSubjectCodes = async () => {
  let normalizedCount = 0;
  let conflictCount = 0;

  for (const [Model, label, idField, itemType] of [
    [Subject, 'subject', 'subjectId', 'class'],
    [Lab, 'lab', 'labId', 'lab'],
  ]) {
    const records = await Model.find({}).select('_id code branch semester session isCommon').lean();

    for (const record of records) {
      const normalized = normalizeSubjectCodeForScheme(record.code, record.branch, record.semester);
      if (!normalized || normalized === String(record.code || '').trim().toUpperCase()) continue;

      const codeError = validateSubjectCode(normalized, record.branch, record.semester, {
        isCommon: !!record.isCommon,
      });
      if (codeError) {
        conflictCount += 1;
        continue;
      }

      const duplicateScope = {
        code: normalized,
        session: record.session,
        branch: record.branch,
        semester: record.semester,
        _id: { $ne: record._id },
      };
      const duplicate = await Model.findOne(duplicateScope).select('_id').lean();
      if (duplicate) {
        console.warn(
          `[migration] Skipped ${label} code ${record.code}: normalized code ${normalized} is already used.`,
        );
        conflictCount += 1;
        continue;
      }

      await Model.updateOne({ _id: record._id }, { $set: { code: normalized } });

      await Result.updateMany(
        { 'subjectMarks': { $elemMatch: { [idField]: record._id } } },
        { $set: { 'subjectMarks.$[item].itemCode': normalized } },
        { arrayFilters: [{ [`item.${idField}`]: record._id }] },
      );

      normalizedCount += 1;
      console.log(`[migration] Normalized ${label} code ${record.code} -> ${normalized}`);
    }
  }

  if (normalizedCount || conflictCount) {
    console.log(
      `[migration] Subject/lab code normalization: ${normalizedCount} updated, ${conflictCount} skipped/conflicted.`,
    );
  }
};

// Idempotent, non-destructive. Safe to run on every startup.
const migrateAcademicScheme = async () => {
  try {
    await normalizeExistingSubjectCodes();
    await ensureSchemeUniqueIndex(Subject, 'Subject');
    await ensureSchemeUniqueIndex(Lab, 'Lab');
    await repairMislabeledLabAssignments();
    await auditSubjectCodeFormats();
    await ensureAssignmentIndex();
  } catch (err) {
    console.error('[migration] Academic scheme migration error:', err.message);
  }
};

module.exports = { migrateAcademicScheme };
